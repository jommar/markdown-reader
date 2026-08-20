import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  FileResult,
  OpenResult,
  RootInfo,
  RootsResponse,
  SearchFileResult,
  SearchResponse,
  TreeResponse,
} from '../../server/types.ts'

export type SearchMode = 'content' | 'files'

function getToken(): string | null {
  const el = document.querySelector('meta[name="mdr-token"]')
  return el?.getAttribute('content') ?? null
}

export const useWorkspace = defineStore('workspace', () => {
  const root = ref('')
  const dialogOpen = ref(false)
  const roots = ref<RootInfo[]>([])
  const tree = ref<TreeResponse['tree']>([])
  const files = ref<string[]>([])
  const fileCount = ref(0)
  const builtAt = ref(0)

  const fileSet = computed(() => new Set(files.value))

  const widenToast = ref<{ message: string; prevRoot: string; prevPath: string } | null>(null)

  const copyToast = ref<string | null>(null)
  let copyToastTimer: ReturnType<typeof setTimeout> | null = null

  function showCopyToast(message: string) {
    copyToast.value = message
    if (copyToastTimer) clearTimeout(copyToastTimer)
    copyToastTimer = setTimeout(() => {
      copyToast.value = null
      copyToastTimer = null
    }, 2000)
  }

  const searchQuery = ref('')
  const searchMode = ref<SearchMode>('content')
  const searchRegex = ref(false)
  const searchResults = ref<SearchFileResult[]>([])
  const searchLoading = ref(false)
  const searchTruncated = ref(false)
  const searchError = ref<string | null>(null)
  const currentMtimeMs = ref(0)
  const currentHeadings = ref<{ level: number; slug: string; text: string }[]>([])

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let searchAbort: AbortController | null = null

  async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  async function fetchRoots(): Promise<void> {
    try {
      const data = await api<RootsResponse>('/api/roots')
      roots.value = data.roots.sort((a, b) => b.lastOpened - a.lastOpened)
    } catch {
      /* server unreachable — keep the previous/empty roots list */
    }
  }

  async function openRoot(path: string): Promise<OpenResult> {
    const out = await api<OpenResult>('/api/roots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mdr-token': getToken() ?? '' },
      body: JSON.stringify({ path }),
    })
    root.value = out.root
    await loadTree()
    return out
  }

  async function widenRoot(upLevels: number): Promise<OpenResult> {
    const out = await api<OpenResult>('/api/roots/widen', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mdr-token': getToken() ?? '' },
      body: JSON.stringify({ root: root.value, upLevels }),
    })
    root.value = out.root
    await loadTree()
    return out
  }

  async function loadTree() {
    if (!root.value) return
    const data = await api<TreeResponse>(`/api/tree?root=${encodeURIComponent(root.value)}`)
    tree.value = data.tree
    files.value = data.files
    fileCount.value = data.fileCount
    builtAt.value = data.builtAt
  }

  async function refreshTree() {
    if (!root.value) return
    await api<{ ok: boolean }>('/api/tree/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mdr-token': getToken() ?? '' },
      body: JSON.stringify({ root: root.value }),
    })
    await loadTree()
  }

  async function loadFile(path: string, rootOverride?: string): Promise<FileResult> {
    const r = rootOverride ?? root.value
    if (!r) throw new Error('no root')
    return api<FileResult>(
      `/api/file?root=${encodeURIComponent(r)}&path=${encodeURIComponent(path)}`,
    )
  }

  function search(q: string, mode: SearchMode, regex: boolean) {
    searchQuery.value = q
    searchMode.value = mode
    searchRegex.value = regex
    if (searchTimer) clearTimeout(searchTimer)
    searchAbort?.abort()
    searchError.value = null
    if (!q.trim()) {
      searchResults.value = []
      searchTruncated.value = false
      searchLoading.value = false
      return
    }
    searchLoading.value = true
    searchTimer = setTimeout(() => runSearch(), 250)
  }

  async function runSearch() {
    if (!root.value) return
    const ctrl = new AbortController()
    searchAbort = ctrl
    const params = new URLSearchParams({
      root: root.value,
      q: searchQuery.value,
      mode: searchMode.value,
    })
    if (searchRegex.value) params.set('regex', '1')
    try {
      const data = await api<SearchResponse>(`/api/search?${params.toString()}`, {
        signal: ctrl.signal,
      })
      if (ctrl.signal.aborted) return
      searchResults.value = data.results
      searchTruncated.value = data.truncated
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (ctrl.signal.aborted) return
      searchError.value = (e as Error).message
      searchResults.value = []
      searchTruncated.value = false
    } finally {
      if (!ctrl.signal.aborted) searchLoading.value = false
    }
  }

  return {
    root,
    dialogOpen,
    roots,
    tree,
    files,
    fileCount,
    builtAt,
    fileSet,
    widenToast,
    copyToast,
    showCopyToast,
    searchQuery,
    searchMode,
    searchRegex,
    searchResults,
    searchLoading,
    searchTruncated,
    searchError,
    currentMtimeMs,
    currentHeadings,
    fetchRoots,
    openRoot,
    widenRoot,
    loadTree,
    refreshTree,
    loadFile,
    search,
  }
})
