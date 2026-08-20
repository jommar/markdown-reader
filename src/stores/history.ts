import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface HistoryEntry {
  root: string
  path: string
  lastOpened: number
  pinned: boolean
}

const KEY = 'markdown-reader:history:v1'
const MAX_UNPINNED = 100

function isEntry(v: unknown): v is HistoryEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<HistoryEntry>
  return (
    typeof e.root === 'string' &&
    typeof e.path === 'string' &&
    typeof e.lastOpened === 'number' &&
    typeof e.pinned === 'boolean'
  )
}

export const useHistory = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const dialogOpen = ref(false)
  const toast = ref<{ message: string; entry: HistoryEntry } | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { entries?: unknown }
      if (Array.isArray(parsed.entries)) {
        entries.value = parsed.entries.filter(isEntry)
      }
    }
  } catch {
    /* ignore corrupt history */
  }

  const pinned = computed(() =>
    entries.value.filter((e) => e.pinned).sort((a, b) => b.lastOpened - a.lastOpened),
  )
  const recent = computed(() =>
    entries.value.filter((e) => !e.pinned).sort((a, b) => b.lastOpened - a.lastOpened),
  )

  function enforceCap(): void {
    const unpinned = entries.value.filter((e) => !e.pinned)
    const over = unpinned.length - MAX_UNPINNED
    if (over <= 0) return
    const oldest = [...unpinned].sort((a, b) => a.lastOpened - b.lastOpened)
    const drop = new Set(oldest.slice(0, over))
    entries.value = entries.value.filter((e) => !drop.has(e))
  }

  function record(root: string, path: string): void {
    if (!root || !path) return
    const existing = entries.value.find((e) => e.root === root && e.path === path)
    if (existing) {
      existing.lastOpened = Date.now()
    } else {
      entries.value.push({ root, path, lastOpened: Date.now(), pinned: false })
    }
    enforceCap()
    persistSoon()
  }

  function togglePin(root: string, path: string): void {
    const e = entries.value.find((en) => en.root === root && en.path === path)
    if (e) {
      e.pinned = !e.pinned
      persistSoon()
    }
  }

  function isPinned(root: string, path: string): boolean {
    return entries.value.some((e) => e.root === root && e.path === path && e.pinned)
  }

  function pinnedPaths(root: string): Set<string> {
    return new Set(entries.value.filter((e) => e.root === root && e.pinned).map((e) => e.path))
  }

  function pinInRoot(root: string, path: string): void {
    const existing = entries.value.find((e) => e.root === root && e.path === path)
    if (existing) {
      existing.pinned = !existing.pinned
    } else {
      entries.value.push({ root, path, lastOpened: Date.now(), pinned: true })
    }
    persistSoon()
  }

  function remove(root: string, path: string): void {
    const idx = entries.value.findIndex((e) => e.root === root && e.path === path)
    if (idx === -1) return
    const [removed] = entries.value.splice(idx, 1)
    if (!removed) return
    toast.value = { message: 'Removed from history', entry: removed }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
      toastTimer = null
    }, 4000)
    persistSoon()
  }

  function undoRemove(): void {
    const t = toast.value
    if (!t) return
    entries.value.push(t.entry)
    toast.value = null
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
    persistSoon()
  }

  function dismissToast(): void {
    toast.value = null
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
  }

  function prune(root: string, fileSet: Set<string>): void {
    if (!root) return
    const before = entries.value.length
    entries.value = entries.value.filter((e) => e.root !== root || fileSet.has(e.path))
    if (entries.value.length !== before) persistSoon()
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  function persistSoon(): void {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(flushPersist, 500)
  }
  function flushPersist(): void {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    try {
      localStorage.setItem(KEY, JSON.stringify({ entries: entries.value }))
    } catch {
      /* ignore quota errors */
    }
  }

  return {
    entries,
    dialogOpen,
    toast,
    pinned,
    recent,
    record,
    togglePin,
    isPinned,
    pinnedPaths,
    pinInRoot,
    remove,
    undoRemove,
    dismissToast,
    prune,
    flushPersist,
  }
})
