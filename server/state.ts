import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export interface StateRoot {
  root: string
  lastOpened: number
}
export interface State {
  roots: StateRoot[]
}

const MAX_ROOTS = 10

function configDir(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
}

function statePath(): string {
  return path.join(configDir(), 'markdown-reader', 'state.json')
}

let cache: State | null = null

export async function loadState(): Promise<State> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(statePath(), 'utf8')
    const parsed = JSON.parse(raw)
    cache = Array.isArray(parsed?.roots) ? { roots: parsed.roots } : { roots: [] }
  } catch {
    cache = { roots: [] }
  }
  return cache
}

export function getKnownRoots(): StateRoot[] {
  return cache?.roots ?? []
}

export async function storeRoot(real: string): Promise<void> {
  const state = (await loadState()).roots
  const existing = state.find((r) => r.root === real)
  if (existing) {
    existing.lastOpened = Date.now()
  } else {
    state.unshift({ root: real, lastOpened: Date.now() })
    if (state.length > MAX_ROOTS) state.length = MAX_ROOTS
  }
  await writeState()
}

export async function writeState(): Promise<void> {
  if (!cache) return
  const dir = path.dirname(statePath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(statePath(), JSON.stringify(cache, null, 2))
}
