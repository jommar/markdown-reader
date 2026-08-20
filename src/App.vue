<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Reader from './components/Reader.vue'
import Sidebar from './components/Sidebar.vue'
import TabBar from './components/TabBar.vue'
import Breadcrumbs from './components/Breadcrumbs.vue'
import Toolbar from './components/Toolbar.vue'
import Toc from './components/Toc.vue'
import OpenRootDialog from './components/OpenRootDialog.vue'
import HistoryDialog from './components/HistoryDialog.vue'
import { useWorkspace } from './stores/workspace'
import { useTabs } from './stores/tabs'
import { usePrefs } from './stores/prefs'
import { useHistory } from './stores/history'
import { useScroller } from './composables/useScroller'
import { useShortcuts } from './composables/useShortcuts'
import { useUrlSync } from './composables/useUrlSync'
import UiToast from './components/ui/UiToast.vue'
import ShortcutOverlay from './components/ShortcutOverlay.vue'
import { decideBoot } from './boot.ts'
import type { RootsResponse } from '../server/types.ts'

const workspace = useWorkspace()
const tabs = useTabs()
const prefs = usePrefs()
const history = useHistory()
const { setScroller } = useScroller()
const scrollEl = ref<HTMLElement | null>(null)
const helpOpen = ref(false)

const theme = computed(() => prefs.theme)
const fontScale = computed(() => prefs.fontScale)
const wideMode = computed(() => prefs.wideMode || prefs.wideHint)
const readerMeasure = computed(() => (wideMode.value ? '100%' : '72ch'))
const tocVisible = computed(() => prefs.tocVisible && workspace.currentHeadings.length >= 3)
const shellCols = computed(() =>
  prefs.sidebarCollapsed ? '0px 0px 1fr' : `${prefs.sidebarWidth}px 6px 1fr`,
)
const mainCols = computed(() => (tocVisible.value ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)'))

function clampWidth(n: number): number {
  return Math.min(480, Math.max(280, Math.round(n)))
}

function startDrag(e: MouseEvent): void {
  if (prefs.sidebarCollapsed) return
  const startX = e.clientX
  const startW = prefs.sidebarWidth
  function onMove(ev: MouseEvent): void {
    prefs.sidebarWidth = clampWidth(startW + ev.clientX - startX)
  }
  function onUp(): void {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function focusFilter() {
  const el =
    document.querySelector<HTMLInputElement>('.filter-input input') ??
    document.querySelector<HTMLInputElement>('.filter-input')
  el?.focus()
}
function focusSearch() {
  const el =
    document.querySelector<HTMLInputElement>('.search-input input') ??
    document.querySelector<HTMLInputElement>('.search-input')
  el?.focus()
}
function clearFilter() {
  workspace.search('', workspace.searchMode, workspace.searchRegex)
  const f =
    document.querySelector<HTMLInputElement>('.filter-input input') ??
    document.querySelector<HTMLInputElement>('.filter-input')
  if (f) {
    f.value = ''
    f.dispatchEvent(new Event('input', { bubbles: true }))
  }
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}

async function openRootWithRestore(path: string): Promise<boolean> {
  try {
    await workspace.openRoot(path)
    return true
  } catch {
    return false
  }
}

onMounted(async () => {
  setScroller(scrollEl.value)
  tabs.attachListeners()

  const { parseUrl, initHistory, installPopstate, watchActive } = useUrlSync()
  initHistory()
  installPopstate()
  watchActive()

  const url = parseUrl()
  const saved = tabs.loadSaved()

  let initial: RootsResponse['initial'] | null = null
  try {
    const data = (await fetch('/api/roots').then((r) => r.json())) as RootsResponse
    initial = data.initial ?? null
  } catch {
    /* server unreachable */
  }

  const decision = decideBoot({ url, saved, initial })
  if (decision.kind === 'restore') {
    if (await openRootWithRestore(decision.saved.root)) {
      if (!tabs.restore(decision.saved) && url.path) {
        tabs.navigate(url.path, url.anchor ? { anchor: url.anchor } : undefined)
      }
    }
  } else if (decision.kind === 'open') {
    if ((await openRootWithRestore(decision.root)) && decision.path) {
      tabs.navigate(decision.path, decision.anchor ? { anchor: decision.anchor } : undefined)
    }
  }

  useShortcuts({
    newTab: () => tabs.newBlankTab(),
    closeTab: () => tabs.closeTab(),
    back: () => tabs.back(),
    forward: () => tabs.forward(),
    zoomIn: () => {
      prefs.fontScale = Math.min(2.0, Math.round((prefs.fontScale + 0.1) * 10) / 10)
    },
    zoomOut: () => {
      prefs.fontScale = Math.max(0.75, Math.round((prefs.fontScale - 0.1) * 10) / 10)
    },
    zoomReset: () => {
      prefs.fontScale = 1
    },
    toggleWide: () => {
      prefs.wideMode = !prefs.wideMode
    },
    toggleSidebar: () => {
      prefs.sidebarCollapsed = !prefs.sidebarCollapsed
    },
    toggleTheme: () => {
      prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'
    },
    focusFilter,
    focusSearch,
    clearFilter,
    openFolder: () => {
      workspace.dialogOpen = true
    },
    openHistory: () => {
      history.dialogOpen = true
    },
    toggleHelp: () => {
      helpOpen.value = !helpOpen.value
    },
  })

  workspace.searchMode = prefs.searchMode
  workspace.searchRegex = prefs.searchRegex
  watch(
    () => prefs.searchMode,
    (m) => {
      workspace.searchMode = m
    },
  )
  watch(
    () => prefs.searchRegex,
    (r) => {
      workspace.searchRegex = r
    },
  )
  watch(
    () => workspace.searchMode,
    (m) => {
      prefs.searchMode = m
    },
  )
  watch(
    () => workspace.searchRegex,
    (r) => {
      prefs.searchRegex = r
    },
  )
})

watch(theme, (t) => {
  document.documentElement.setAttribute('data-theme', t)
})

watch(
  () => workspace.builtAt,
  () => {
    if (workspace.root) history.prune(workspace.root, workspace.fileSet)
  },
)
</script>

<template>
  <div
    class="app grid h-full grid-rows-[minmax(0,1fr)]"
    :style="{ gridTemplateColumns: shellCols }"
  >
    <aside
      v-if="!prefs.sidebarCollapsed"
      class="border-border bg-bg min-w-0 overflow-x-hidden overflow-y-auto border-r"
    >
      <Sidebar />
    </aside>
    <div
      v-if="!prefs.sidebarCollapsed"
      class="bg-border hover:bg-border-strong cursor-col-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      @mousedown="startDrag"
    />
    <div v-else aria-hidden="true" />
    <div class="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)]">
      <div class="border-border border-b"><TabBar /></div>
      <div class="border-border flex items-center gap-2 border-b px-4 py-1.5">
        <Breadcrumbs />
        <Toolbar />
      </div>
      <div class="grid min-h-0" :style="{ gridTemplateColumns: mainCols }">
        <main
          id="main"
          ref="scrollEl"
          class="reader-scroll min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain"
          :style="{ '--reader-font-scale': fontScale, '--reader-measure': readerMeasure }"
        >
          <Reader />
        </main>
        <div
          v-if="tocVisible"
          class="border-border hidden w-60 overflow-y-auto border-l p-4 min-[1200px]:block"
        >
          <Toc />
        </div>
      </div>
    </div>
    <OpenRootDialog :open="workspace.dialogOpen" @close="workspace.dialogOpen = false" />
    <HistoryDialog />
    <ShortcutOverlay :open="helpOpen" @close="helpOpen = false" />
    <UiToast
      v-if="workspace.copyToast"
      :message="workspace.copyToast"
      :show-undo="false"
      :show-dismiss="false"
    />
    <UiToast
      v-if="history.toast"
      :message="history.toast.message"
      @undo="history.undoRemove()"
      @dismiss="history.dismissToast()"
    />
    <UiToast
      v-if="workspace.widenToast"
      :message="workspace.widenToast.message"
      @undo="
        async () => {
          const t = workspace.widenToast!
          workspace.widenToast = null
          if (await openRootWithRestore(t.prevRoot)) tabs.navigate(t.prevPath)
        }
      "
      @dismiss="workspace.widenToast = null"
    />
  </div>
</template>
