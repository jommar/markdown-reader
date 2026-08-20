import fs from 'node:fs/promises'
import path from 'node:path'
import { loadState, storeRoot } from './state.ts'

export function status(code: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number }
  e.status = code
  return e
}

/** Resolve a root-relative path, guaranteeing containment. ASYNC — realpath is required. */
export async function safeJoin(root: string, rel: string): Promise<string> {
  const base = path.resolve(root)
  const abs = path.resolve(base, rel)
  assertInside(base, abs)
  let real: string
  try {
    real = await fs.realpath(abs)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    real = path.join(await realpathNearest(path.dirname(abs)), path.basename(abs))
  }
  assertInside(base, real)
  return abs
}

function assertInside(base: string, p: string) {
  if (p !== base && !p.startsWith(base + path.sep)) throw status(403, 'path escapes root')
}

async function realpathNearest(dir: string): Promise<string> {
  let d = dir
  for (;;) {
    try {
      return await fs.realpath(d)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      const parent = path.dirname(d)
      if (parent === d) throw status(403, 'path escapes root')
      d = parent
    }
  }
}

export async function assertKnownRoot(root: string): Promise<string> {
  const real = await fs.realpath(root)
  const state = await loadState()
  const known = state.roots.find((r) => r.root === real)
  if (!known) throw status(403, 'unknown root')
  return real
}

export async function registerRoot(real: string): Promise<void> {
  await storeRoot(real)
}
