import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useScroller } from '../composables/useScroller.ts'
import { useWorkspace } from './workspace.ts'

export interface HistoryEntry {
  root: string
  path: string
  scrollTop: number
  pendingAnchor?: string
  pendingLine?: number
  via?: number
}

export interface Tab {
  id: string
  entries: HistoryEntry[]
  index: number
}

export interface SavedSession {
  root: string
  activeId: string
  tabs: { id: string; index: number; entries: HistoryEntry[] }[]
}

const KEY = 'markdown-reader:session:v1'
const MAX_ENTRIES = 500

let seq = 0
function nextId(): string {
  seq++
  return `tab-${seq}`
}

function trailSet(t: Tab): Set<number> {
  const s = new Set<number>()
  let i = t.index
  for (;;) {
    if (i === undefined || i < 0 || i >= t.entries.length) break
    s.add(i)
    const via = t.entries[i]?.via
    if (via === undefined) break
    if (via === i) break
    i = via
  }
  return s
}

function assertInvariant(t: Tab): void {
  if (!(t.index >= 0 && t.index < t.entries.length)) {
    console.error('tabs invariant violated', { index: t.index, length: t.entries.length })
  }
}

function evict(t: Tab): void {
  while (t.entries.length > MAX_ENTRIES) {
    const trail = trailSet(t)
    let removeAt = -1
    for (let i = 1; i < t.entries.length; i++) {
      if (!trail.has(i)) {
        removeAt = i
        break
      }
    }
    if (removeAt === -1) break
    t.entries.splice(removeAt, 1)
    if (removeAt < t.index) t.index--
    for (let j = 0; j < t.entries.length; j++) {
      const v = t.entries[j].via
      if (v === undefined) continue
      if (v === removeAt) t.entries[j].via = undefined
      else if (v > removeAt) t.entries[j].via = v - 1
    }
    assertInvariant(t)
  }
}

function titleAtDepth(path: string, depth: number): string {
  const parts = path.split('/')
  return parts.slice(Math.max(0, parts.length - depth)).join('/')
}

function findUnambiguousTitle(path: string, allPaths: string[]): string {
  const base = path.split('/').pop() ?? path
  const baseStem = base.replace(/\.(md|markdown)$/i, '')
  const depth2Names = new Set(['index', 'README', 'SKILL', 'CLAUDE'])
  const startDepth = depth2Names.has(baseStem) ? 2 : 1
  const parts = path.split('/')
  for (let depth = startDepth; depth <= parts.length; depth++) {
    const candidate = titleAtDepth(path, depth)
    const collides = allPaths.some((p) => p !== path && titleAtDepth(p, depth) === candidate)
    if (!collides) return candidate
  }
  return path
}

export const useTabs = defineStore('tabs', () => {
  const workspace = useWorkspace()
  const { scroller } = useScroller()

  const tabs = ref<Tab[]>([])
  const activeId = ref('')

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value) ?? null)
  const currentEntry = computed(() => {
    const t = activeTab.value
    if (!t) return null
    return t.entries[t.index] ?? null
  })
  const canGoBack = computed(() => !!activeTab.value && activeTab.value.index > 0)
  const canGoForward = computed(
    () => !!activeTab.value && activeTab.value.index < activeTab.value.entries.length - 1,
  )

  function commitScroll(): void {
    const t = activeTab.value
    if (!t) return
    const el = scroller.value
    const entry = t.entries[t.index]
    if (entry && el) entry.scrollTop = el.scrollTop
  }

  function newTab(): Tab {
    return { id: nextId(), entries: [], index: -1 }
  }

  function navigate(path: string, opts?: { anchor?: string; line?: number }): void {
    commitScroll()
    let t = activeTab.value
    if (!t) {
      t = newTab()
      tabs.value.push(t)
      activeId.value = t.id
    }
    const cur = t.entries[t.index]
    if (cur && cur.path === path) {
      if (opts?.anchor) {
        cur.pendingAnchor = opts.anchor
        cur.pendingLine = undefined
      } else if (opts?.line) {
        cur.pendingLine = opts.line
        cur.pendingAnchor = undefined
      } else {
        cur.pendingAnchor = undefined
        cur.pendingLine = undefined
        if (scroller.value) scroller.value.scrollTop = 0
      }
      assertInvariant(t)
      persistSoon()
      return
    }
    t.entries = t.entries.slice(0, t.index + 1)
    const via = t.index
    t.entries.push({
      root: workspace.root,
      path,
      scrollTop: 0,
      pendingAnchor: opts?.anchor,
      pendingLine: opts?.line,
      via,
    })
    t.index = t.entries.length - 1
    evict(t)
    assertInvariant(t)
    persistSoon()
  }

  function back(): void {
    const t = activeTab.value
    if (!t) return
    commitScroll()
    if (t.index > 0) t.index--
    assertInvariant(t)
    persistSoon()
  }

  function forward(): void {
    const t = activeTab.value
    if (!t) return
    commitScroll()
    if (t.index < t.entries.length - 1) t.index++
    assertInvariant(t)
    persistSoon()
  }

  function goToIndex(i: number): void {
    const t = activeTab.value
    if (!t) return
    commitScroll()
    if (i >= 0 && i < t.entries.length) {
      t.index = i
      assertInvariant(t)
      persistSoon()
    }
  }

  function openTab(path: string): void {
    const existing = tabs.value.find((t) => t.entries[t.index]?.path === path)
    if (existing) {
      activeId.value = existing.id
      return
    }
    openInNewTab(path)
  }

  function openInNewTab(path: string): void {
    const t = newTab()
    t.entries.push({ root: workspace.root, path, scrollTop: 0, via: undefined })
    t.index = 0
    tabs.value.push(t)
    activeId.value = t.id
  }

  function newBlankTab(): void {
    const t = newTab()
    tabs.value.push(t)
    activeId.value = t.id
  }

  function closeTab(id?: string): void {
    const target = id ?? activeId.value
    const idx = tabs.value.findIndex((t) => t.id === target)
    if (idx === -1) return
    const t = tabs.value[idx]
    commitScroll()
    if (t.id === activeId.value) {
      tabs.value.splice(idx, 1)
      if (tabs.value.length > 0) {
        const neighbor = tabs.value[Math.min(idx, tabs.value.length - 1)]
        activeId.value = neighbor.id
      } else {
        activeId.value = ''
      }
    } else {
      tabs.value.splice(idx, 1)
    }
    persistSoon()
  }

  function setActiveTab(id: string): void {
    commitScroll()
    activeId.value = id
    persistSoon()
  }

  function replaceCurrent(entry: HistoryEntry): void {
    const t = activeTab.value
    if (!t) return
    commitScroll()
    t.entries[t.index] = entry
    assertInvariant(t)
    persistSoon()
  }

  function consumePending(): { anchor?: string; line?: number } {
    const t = activeTab.value
    const entry = t?.entries[t.index]
    if (!t || !entry) return {}
    if (entry.pendingLine !== undefined) {
      const line = entry.pendingLine
      entry.pendingLine = undefined
      entry.pendingAnchor = undefined
      return { line }
    }
    if (entry.pendingAnchor !== undefined) {
      const anchor = entry.pendingAnchor
      entry.pendingAnchor = undefined
      return { anchor }
    }
    return {}
  }

  function titles(): string[] {
    const allPaths = tabs.value.map((t) => t.entries[t.index]?.path).filter((p): p is string => !!p)
    return tabs.value.map((t) => {
      const p = t.entries[t.index]?.path
      if (!p) return ''
      return findUnambiguousTitle(p, allPaths)
    })
  }

  function trail(): { entry: HistoryEntry; index: number }[] {
    const t = activeTab.value
    if (!t) return []
    const out: { entry: HistoryEntry; index: number }[] = []
    let i = t.index
    const seen = new Set<number>()
    for (;;) {
      if (i < 0 || i >= t.entries.length || seen.has(i)) break
      seen.add(i)
      out.unshift({ entry: t.entries[i], index: i })
      const via = t.entries[i]?.via
      if (via === undefined) break
      i = via
    }
    return out
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
    if (!workspace.root) return
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          root: workspace.root,
          activeId: activeId.value,
          tabs: tabs.value.map((t) => ({ id: t.id, index: t.index, entries: t.entries })),
        } satisfies SavedSession),
      )
    } catch {
      /* ignore quota errors */
    }
  }

  function restore(saved: SavedSession | null): boolean {
    if (!saved || !saved.root) return false
    if (saved.root !== workspace.root) return false
    const fileSet = workspace.fileSet
    const restored: Tab[] = []
    for (const st of saved.tabs) {
      const kept: HistoryEntry[] = []
      for (const e of st.entries) {
        if (fileSet.has(e.path)) kept.push(e)
      }
      if (kept.length === 0) continue
      let index = Math.min(st.index, kept.length - 1)
      index = Math.max(0, index)
      restored.push({ id: st.id, entries: kept, index })
    }
    if (restored.length === 0) return false
    tabs.value = restored
    activeId.value = restored.some((t) => t.id === saved.activeId) ? saved.activeId : restored[0].id
    return true
  }

  function loadSaved(): SavedSession | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      return JSON.parse(raw) as SavedSession
    } catch {
      return null
    }
  }

  let listenersAttached = false
  function attachListeners(): void {
    if (listenersAttached) return
    listenersAttached = true
    let last = 0
    window.addEventListener(
      'scroll',
      () => {
        const now = Date.now()
        if (now - last >= 250) {
          last = now
          commitScroll()
          persistSoon()
        }
      },
      true,
    )
    window.addEventListener('pagehide', () => {
      commitScroll()
      flushPersist()
    })
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        commitScroll()
        flushPersist()
      }
    })
  }

  return {
    tabs,
    activeId,
    activeTab,
    currentEntry,
    canGoBack,
    canGoForward,
    navigate,
    back,
    forward,
    goToIndex,
    openTab,
    openInNewTab,
    newBlankTab,
    closeTab,
    setActiveTab,
    replaceCurrent,
    consumePending,
    titles,
    trail,
    commitScroll,
    restore,
    loadSaved,
    flushPersist,
    attachListeners,
  }
})
