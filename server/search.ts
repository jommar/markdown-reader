import { spawn } from 'node:child_process'
import readline from 'node:readline'
import type { SearchFileResult, SearchMatch, SearchResponse } from './types'
import { status } from './safe-path.ts'

const MAX_QUERY = 500
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const WINDOW = 500
const HALF = Math.floor(WINDOW / 2)

interface RgSubmatch {
  start?: number
  end?: number
}
interface RgLine {
  type?: string
  data?: {
    path?: { text?: string }
    lines?: { text?: string; bytes?: string }
    line_number?: number
    submatches?: RgSubmatch[]
  }
}

export function buildContentArgs(query: string, literal: boolean): string[] {
  return [
    '--json',
    '--smart-case',
    '--max-count',
    '5',
    '--hidden',
    '--no-ignore-vcs',
    '-g',
    '!.git',
    '-g',
    '!node_modules',
    '-g',
    '!**/node_modules/**',
    '-g',
    '*.md',
    '-g',
    '*.markdown',
    ...(literal ? ['--fixed-strings'] : []),
    '--',
    query,
  ]
}

export function searchContent(
  root: string,
  query: string,
  literal: boolean,
  limit: number,
): { promise: Promise<SearchResponse>; abort: () => void } {
  const child = spawn('rg', buildContentArgs(query, literal), {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stderr: string[] = []
  const results = new Map<string, SearchFileResult>()
  let totalBytes = 0
  let truncated = false
  let done = false

  const promise = new Promise<SearchResponse>((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve({
        results: [...results.values()],
        truncated,
        elapsedMs: 0,
      })
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      reject(status(400, msg))
    }

    child.stderr.on('data', (d: Buffer) => {
      stderr.push(d.toString('utf8'))
    })
    child.stdout.on('error', () => {})
    child.on('error', () => {})

    const stop = () => {
      if (done) return
      done = true
      rl.close()
      child.stdout.destroy()
      child.kill('SIGTERM')
    }

    const rl = readline.createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      if (done) return
      let data: RgLine
      try {
        data = JSON.parse(line)
      } catch {
        return
      }
      if (data.type !== 'match' || !data.data) return
      const d = data.data
      const p = d.path?.text
      if (!p) return
      const { text, toChar } = decodeLine(d.lines)
      const submatches = (d.submatches ?? []).map((s) => ({
        start: toChar(s.start ?? 0),
        end: toChar(s.end ?? 0),
      }))
      const first = submatches[0]
      if (!first) return
      const center = Math.floor((first.start + first.end) / 2)
      const winStart = Math.max(0, center - HALF)
      const winEnd = Math.min(text.length, winStart + WINDOW)
      const windowText = text.slice(winStart, winEnd)
      const ranges: [number, number][] = []
      for (const s of submatches) {
        if (s.start >= winEnd || s.end <= winStart) continue
        ranges.push([s.start - winStart, s.end - winStart])
      }
      const match: SearchMatch = {
        line: d.line_number ?? 0,
        text: windowText,
        ranges,
        prefixTruncated: winStart > 0,
        suffixTruncated: winEnd < text.length,
      }
      let entry = results.get(p)
      if (!entry) {
        entry = { path: p, matches: [] }
        results.set(p, entry)
      }
      entry.matches.push(match)
      totalBytes += windowText.length + p.length + 32
      if (results.size >= limit || totalBytes >= MAX_RESPONSE_BYTES) {
        truncated = true
        stop()
        finish()
      }
    })

    rl.on('close', () => {
      if (done) finish()
    })

    child.on('close', () => {
      rl.close()
      if (done) {
        finish()
        return
      }
      if (child.exitCode !== 0) {
        const msg = stderr.join('').trim().split('\n')[0]
        fail(msg || 'search failed')
        return
      }
      finish()
    })
  })

  return { promise, abort: () => child.kill('SIGTERM') }
}

export function decodeLine(lines?: { text?: string; bytes?: string }): {
  text: string
  toChar: (b: number) => number
} {
  const raw =
    lines?.text !== undefined
      ? Buffer.from(lines.text, 'utf8')
      : Buffer.from(lines?.bytes ?? '', 'base64')
  return {
    text: raw.toString('utf8').replace(/\n$/, ''),
    toChar: (b: number) => raw.subarray(0, b).toString('utf8').length,
  }
}

function scoreSubsequence(pathLower: string, q: string): number {
  const m = pathLower.length
  let pos = 0
  let maxRun = 0
  let run = 0
  let prev = -2
  let firstIdx = -1
  let lastIdx = -1
  for (const ch of q) {
    const idx = pathLower.indexOf(ch, pos)
    if (idx === -1) return -1
    if (firstIdx === -1) firstIdx = idx
    lastIdx = idx
    if (prev === idx - 1) run++
    else run = 1
    if (run > maxRun) maxRun = run
    pos = idx + 1
    prev = idx
  }
  const basenameStart = pathLower.lastIndexOf('/') + 1
  const inBasename = firstIdx >= basenameStart ? 1 : 0
  return -(maxRun * 1_000_000 + inBasename * 100_000) + (lastIdx - firstIdx) + m / 1_000_000
}

export function searchFiles(files: string[], query: string, limit: number): SearchFileResult[] {
  if (query.length > MAX_QUERY) throw status(400, 'query too long')
  const q = query.toLowerCase()
  const scored: { path: string; score: number }[] = []
  for (const f of files) {
    const score = scoreSubsequence(f.toLowerCase(), q)
    if (score !== -1) scored.push({ path: f, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((s) => ({ path: s.path, matches: [] }))
}
