import express from 'express'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { makeGuard } from './guard.ts'
import { assertKnownRoot, registerRoot, safeJoin } from './safe-path.ts'
import { parseFrontmatter } from './frontmatter.ts'
import { loadState } from './state.ts'
import { getTree, refreshTree } from './scan.ts'
import { searchContent, searchFiles } from './search.ts'
import type { FileResult, OpenResult } from './types.ts'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export interface ApiConfig {
  port: number
  initial?: OpenResult
}

export function makeApiRouter(config: ApiConfig): express.Router {
  const router = express.Router()
  router.use(makeGuard(config.port))
  router.use(express.json({ limit: '64kb' }))

  router.get('/roots', async (_req, res) => {
    const roots = await loadState()
    res.set('Cache-Control', 'no-cache').json({ roots: roots.roots, initial: config.initial })
  })

  router.post('/roots', async (req, res) => {
    const p = (req.body as { path?: string } | undefined)?.path
    if (typeof p !== 'string' || p.trim() === '')
      return res.status(400).json({ error: 'path required' })
    if (p === '/') return res.status(400).json({ error: 'cannot open /' })
    if (p === os.homedir()) return res.status(400).json({ error: 'cannot open home' })
    let real: string
    try {
      real = await fs.realpath(p)
    } catch {
      return res.status(400).json({ error: 'path not found' })
    }
    const stat = await fs.stat(real).catch(() => null)
    if (!stat) return res.status(400).json({ error: 'path not found' })
    if (stat.isDirectory()) {
      await registerRoot(real)
      return res.json({ root: real })
    }
    const ext = path.extname(real).toLowerCase()
    if (ext !== '.md' && ext !== '.markdown')
      return res.status(400).json({ error: 'not a markdown file' })
    await registerRoot(path.dirname(real))
    return res.json({ root: path.dirname(real), initialPath: path.basename(real) })
  })

  router.post('/roots/widen', async (req, res) => {
    const body = req.body as { root?: string; upLevels?: number } | undefined
    const root = body?.root
    const upLevels = body?.upLevels
    if (typeof root !== 'string' || !root) return res.status(400).json({ error: 'root required' })
    if (typeof upLevels !== 'number' || !Number.isInteger(upLevels) || upLevels < 1 || upLevels > 6)
      return res.status(400).json({ error: 'invalid upLevels' })
    const base = await assertKnownRoot(root)
    let wider = base
    for (let i = 0; i < upLevels; i++) {
      const parent = path.dirname(wider)
      if (parent === wider) return res.status(400).json({ error: 'cannot widen above root' })
      if (parent === os.homedir() || parent === path.sep)
        return res.status(400).json({ error: 'cannot widen above home' })
      wider = parent
    }
    if (wider === path.sep) return res.status(400).json({ error: 'cannot open /' })
    await registerRoot(wider)
    return res.json({ root: wider })
  })

  router.get('/tree', async (req, res) => {
    const root = String(req.query.root ?? '')
    if (!root) return res.status(400).json({ error: 'root required' })
    await assertKnownRoot(root)
    const tree = await getTree(root)
    res.set('Cache-Control', 'no-cache').json(tree)
  })

  router.post('/tree/refresh', async (req, res) => {
    const root = (req.body as { root?: string } | undefined)?.root
    if (typeof root !== 'string' || !root) return res.status(400).json({ error: 'root required' })
    await assertKnownRoot(root)
    refreshTree(root)
    res.json({ ok: true })
  })

  router.get('/file', async (req, res) => {
    const root = String(req.query.root ?? '')
    const rel = String(req.query.path ?? '')
    if (!root) return res.status(400).json({ error: 'root required' })
    if (!rel) return res.status(400).json({ error: 'path required' })
    const base = await assertKnownRoot(root)
    const abs = await safeJoin(base, rel)
    const ext = path.extname(abs).toLowerCase()
    if (ext !== '.md' && ext !== '.markdown')
      return res.status(403).json({ error: 'unsupported file type' })
    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      return res.status(404).json({ error: 'not found' })
    }
    if (stat.size > MAX_FILE_BYTES) return res.status(413).json({ error: 'file too large' })
    const raw = await fs.readFile(abs, 'utf8')
    const { content, frontmatter, frontmatterLines } = parseFrontmatter(raw)
    const result: FileResult = {
      path: rel,
      content,
      frontmatter,
      frontmatterLines,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    }
    res.set('Cache-Control', 'no-cache').json(result)
  })

  router.get('/search', async (req, res) => {
    const root = String(req.query.root ?? '')
    const q = String(req.query.q ?? '')
    const mode = String(req.query.mode ?? 'content')
    const regex = req.query.regex === '1' || req.query.regex === 'true'
    if (!root) return res.status(400).json({ error: 'root required' })
    if (!q) return res.status(400).json({ error: 'query required' })
    if (q.length > 500) return res.status(400).json({ error: 'query too long' })
    const base = await assertKnownRoot(root)
    if (mode === 'files') {
      const tree = await getTree(base)
      const files = searchFiles(tree.files, q, 100)
      res
        .set('Cache-Control', 'no-cache')
        .json({ results: files, truncated: files.length >= 100, elapsedMs: 0 })
      return
    }
    const limit = 200
    const { promise, abort } = searchContent(base, q, !regex, limit)
    req.on('close', abort)
    try {
      const result = await promise
      res.set('Cache-Control', 'no-cache').json(result)
    } catch (e) {
      if ((e as { status?: number }).status === 400)
        return res.status(400).json({ error: (e as Error).message })
      throw e
    }
  })

  router.use((_req, res) => res.status(404).json({ error: 'not found' }))
  router.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const code = typeof err.status === 'number' && err.status >= 400 ? err.status : 500
      if (code >= 500) console.error(err)
      res.status(code).json({ error: err.message })
    },
  )

  return router
}
