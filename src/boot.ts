import type { OpenResult } from '../server/types.ts'
import type { ParsedUrl } from './composables/useUrlSync.ts'
import type { SavedSession } from './stores/tabs.ts'

export type BootDecision =
  | { kind: 'restore'; saved: SavedSession }
  | { kind: 'open'; root: string; path?: string; anchor?: string }
  | { kind: 'none' }

export interface BootInput {
  url: ParsedUrl
  saved: SavedSession | null
  initial: OpenResult | null
}

export function savedActivePath(saved: SavedSession): string | undefined {
  if (!saved.activeId) return undefined
  const tab = saved.tabs.find((t) => t.id === saved.activeId)
  if (!tab) return undefined
  const entry = tab.entries[tab.index]
  return entry?.path
}

function openDecision(root: string, path?: string, anchor?: string): BootDecision {
  const d: { kind: 'open'; root: string; path?: string; anchor?: string } = { kind: 'open', root }
  if (path !== undefined) d.path = path
  if (anchor !== undefined) d.anchor = anchor
  return d
}

export function decideBoot({ url, saved, initial }: BootInput): BootDecision {
  if (url.root) {
    const sameRoot = saved?.root === url.root
    const active = sameRoot ? savedActivePath(saved) : undefined
    if (sameRoot && (url.path === undefined || url.path === active)) {
      return { kind: 'restore', saved: saved! }
    }
    return openDecision(url.root, url.path, url.anchor)
  }
  if (initial?.root) {
    return openDecision(initial.root, initial.initialPath)
  }
  if (saved?.root) {
    return { kind: 'restore', saved }
  }
  return { kind: 'none' }
}
