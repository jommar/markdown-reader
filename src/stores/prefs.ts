import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { SearchMode } from './workspace'

const KEY = 'markdown-reader:prefs:v2'

export type Theme = 'dark' | 'light'

interface PrefsData {
  theme: Theme
  fontScale: number
  wideMode: boolean
  sidebarWidth: number
  sidebarCollapsed: boolean
  tocVisible: boolean
  searchMode: SearchMode
  searchRegex: boolean
}

export const usePrefs = defineStore('prefs', () => {
  const theme = ref<Theme>('dark')
  const fontScale = ref(1)
  const wideMode = ref(false)
  const wideHint = ref(false)
  const sidebarWidth = ref(320)
  const sidebarCollapsed = ref(false)
  const tocVisible = ref(true)
  const searchMode = ref<SearchMode>('content')
  const searchRegex = ref(false)

  function clampWidth(n: number): number {
    return Math.min(480, Math.max(280, Math.round(n)))
  }

  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<PrefsData>
      if (p.theme === 'light' || p.theme === 'dark') theme.value = p.theme
      if (typeof p.fontScale === 'number') fontScale.value = p.fontScale
      if (typeof p.wideMode === 'boolean') wideMode.value = p.wideMode
      if (typeof p.sidebarWidth === 'number') sidebarWidth.value = clampWidth(p.sidebarWidth)
      if (typeof p.sidebarCollapsed === 'boolean') sidebarCollapsed.value = p.sidebarCollapsed
      if (typeof p.tocVisible === 'boolean') tocVisible.value = p.tocVisible
      if (p.searchMode === 'content' || p.searchMode === 'files') searchMode.value = p.searchMode
      if (typeof p.searchRegex === 'boolean') searchRegex.value = p.searchRegex
    }
  } catch {
    /* ignore corrupt prefs */
  }

  watch(
    [
      theme,
      fontScale,
      wideMode,
      sidebarWidth,
      sidebarCollapsed,
      tocVisible,
      searchMode,
      searchRegex,
    ],
    () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            theme: theme.value,
            fontScale: fontScale.value,
            wideMode: wideMode.value,
            sidebarWidth: sidebarWidth.value,
            sidebarCollapsed: sidebarCollapsed.value,
            tocVisible: tocVisible.value,
            searchMode: searchMode.value,
            searchRegex: searchRegex.value,
          } satisfies PrefsData),
        )
      } catch {
        /* ignore quota */
      }
    },
  )

  return {
    theme,
    fontScale,
    wideMode,
    wideHint,
    sidebarWidth,
    sidebarCollapsed,
    tocVisible,
    searchMode,
    searchRegex,
  }
})
