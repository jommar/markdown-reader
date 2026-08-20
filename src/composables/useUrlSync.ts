import { watch } from 'vue'
import { useTabs } from '../stores/tabs.ts'

export interface ParsedUrl {
  root?: string
  path?: string
  anchor?: string
}

export function useUrlSync() {
  const tabs = useTabs()

  function parseUrl(): ParsedUrl {
    const q = new URLSearchParams(window.location.search)
    const root = q.get('root') ?? undefined
    const path = q.get('path') ?? undefined
    const hash = window.location.hash
    const anchor = hash ? decodeURIComponent(hash.slice(1)) : undefined
    return { root, path, anchor }
  }

  function initHistory(): void {
    history.replaceState({ mdr: 'base' }, '')
    history.pushState({ mdr: 'app' }, '')
  }

  function installPopstate(): void {
    window.addEventListener('popstate', () => {
      if (tabs.canGoBack) {
        tabs.back()
        history.pushState({ mdr: 'app' }, '')
      }
    })
  }

  function syncUrl(): void {
    const e = tabs.currentEntry
    if (!e) return
    const q = new URLSearchParams()
    if (e.root) q.set('root', e.root)
    if (e.path) q.set('path', e.path)
    const base = window.location.pathname + '?' + q.toString()
    const hash = window.location.hash
    history.replaceState({ mdr: 'app' }, '', base + hash)
  }

  function watchActive(): void {
    watch(
      () => [tabs.activeId, tabs.currentEntry?.root, tabs.currentEntry?.path],
      () => syncUrl(),
    )
  }

  return { parseUrl, initHistory, installPopstate, syncUrl, watchActive }
}
