<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useHistory, type HistoryEntry } from '../stores/history'
import { useWorkspace } from '../stores/workspace'
import { useTabs } from '../stores/tabs'
import UiButton from './ui/UiButton.vue'
import UiIcon from './ui/UiIcon.vue'

const history = useHistory()
const workspace = useWorkspace()
const tabs = useTabs()

const error = ref<string | null>(null)
const panelRef = ref<HTMLElement | null>(null)
let previousActive: Element | null = null

const HOUR = 3_600_000
const DAY = 24 * HOUR

function relativeTime(lastOpened: number): string {
  const diff = Date.now() - lastOpened
  if (diff >= 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  if (diff >= HOUR) return `${Math.floor(diff / HOUR)}h ago`
  if (diff >= 60_000) return `${Math.floor(diff / 60_000)}m ago`
  return 'just now'
}

function basename(path: string): string {
  return path.split('/').pop() ?? path
}

function togglePin(e: HistoryEntry) {
  history.togglePin(e.root, e.path)
}

function remove(e: HistoryEntry) {
  history.remove(e.root, e.path)
}

async function open(e: HistoryEntry) {
  error.value = null
  try {
    if (e.root !== workspace.root) await workspace.openRoot(e.root)
    tabs.navigate(e.path)
    history.dialogOpen = false
  } catch (err) {
    error.value = (err as Error).message
  }
}

watch(
  () => history.dialogOpen,
  (open) => {
    if (open) {
      previousActive = document.activeElement
      error.value = null
      const app = document.querySelector('.app') as HTMLElement | null
      app?.setAttribute('inert', '')
      nextTick().then(() => panelRef.value?.focus())
    } else {
      const app = document.querySelector('.app') as HTMLElement | null
      app?.removeAttribute('inert')
      if (previousActive instanceof HTMLElement) {
        previousActive.focus()
        previousActive = null
      }
    }
  },
)

function close() {
  history.dialogOpen = false
}

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab' && panelRef.value) {
    const focusable = Array.from(
      panelRef.value.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

function onEntryKeydown(e: KeyboardEvent, entry: HistoryEntry) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open(entry)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="history.dialogOpen"
      class="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
    >
      <div
        ref="panelRef"
        class="panel border-border-strong bg-bg-elev flex max-h-[80vh] w-[min(90vw,30rem)] flex-col rounded-lg border p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Recent files"
        tabindex="-1"
        @keydown="onPanelKeydown"
      >
        <h2 class="text-fg mb-3 text-base font-semibold">Recent files</h2>
        <p v-if="error" class="text-danger mb-2 text-[0.8rem]">{{ error }}</p>

        <div
          v-if="history.pinned.length === 0 && history.recent.length === 0"
          class="text-fg-muted py-6 text-center text-[0.85rem]"
        >
          No files read yet. Open a file and it will appear here.
        </div>

        <div v-else class="min-h-0 flex-1 overflow-y-auto">
          <template v-if="history.pinned.length">
            <p class="text-fg-muted mb-1 text-[0.72rem] font-semibold tracking-wide uppercase">
              Pinned
            </p>
            <ul class="mb-3" role="listbox" aria-label="Pinned files">
              <li
                v-for="e in history.pinned"
                :key="e.root + '|' + e.path"
                role="option"
                tabindex="0"
                :aria-selected="e.root === workspace.root ? 'true' : 'false'"
                class="border-border hover:bg-bg-inset flex cursor-pointer items-center gap-2 rounded border px-2 py-1"
                :class="{ 'border-accent': e.root === workspace.root }"
                @click="open(e)"
                @keydown="onEntryKeydown($event, e)"
              >
                <button
                  type="button"
                  class="text-accent hover:text-danger active:opacity-70 shrink-0"
                  :title="'Unpin'"
                  @click.stop="togglePin(e)"
                >
                  <UiIcon name="pin" />
                </button>
                <span
                  class="min-w-0 flex-1 truncate font-mono text-[0.8rem]"
                  :title="`${e.root}/${e.path}`"
                >
                  {{ basename(e.path) }}
                </span>
                <span class="text-fg-faint shrink-0 font-mono text-[0.68rem]" :title="e.path">
                  {{ e.root === workspace.root ? e.path : `…/${e.path}` }}
                </span>
                <span class="text-fg-muted shrink-0 text-[0.72rem]">
                  {{ relativeTime(e.lastOpened) }}
                </span>
                <button
                  type="button"
                  class="text-fg-faint hover:text-danger active:opacity-70 shrink-0"
                  title="Remove from history"
                  @click.stop="remove(e)"
                >
                  <UiIcon name="close" />
                </button>
              </li>
            </ul>
          </template>

          <template v-if="history.recent.length">
            <p class="text-fg-muted mb-1 text-[0.72rem] font-semibold tracking-wide uppercase">
              Recent
            </p>
            <ul role="listbox" aria-label="Recent files">
              <li
                v-for="e in history.recent"
                :key="e.root + '|' + e.path"
                role="option"
                tabindex="0"
                :aria-selected="e.root === workspace.root ? 'true' : 'false'"
                class="border-border hover:bg-bg-inset flex cursor-pointer items-center gap-2 rounded border px-2 py-1"
                :class="{ 'border-accent': e.root === workspace.root }"
                @click="open(e)"
                @keydown="onEntryKeydown($event, e)"
              >
                <button
                  type="button"
                  class="text-fg-faint hover:text-accent active:opacity-70 shrink-0"
                  :title="'Pin'"
                  @click.stop="togglePin(e)"
                >
                  <UiIcon name="unpin" />
                </button>
                <span
                  class="min-w-0 flex-1 truncate font-mono text-[0.8rem]"
                  :title="`${e.root}/${e.path}`"
                >
                  {{ basename(e.path) }}
                </span>
                <span class="text-fg-faint shrink-0 font-mono text-[0.68rem]" :title="e.path">
                  {{ e.root === workspace.root ? e.path : `…/${e.path}` }}
                </span>
                <span class="text-fg-muted shrink-0 text-[0.72rem]">
                  {{ relativeTime(e.lastOpened) }}
                </span>
                <button
                  type="button"
                  class="text-fg-faint hover:text-danger active:opacity-70 shrink-0"
                  title="Remove from history"
                  @click.stop="remove(e)"
                >
                  <UiIcon name="close" />
                </button>
              </li>
            </ul>
          </template>
        </div>

        <div class="mt-3 flex justify-end gap-2">
          <UiButton @click="close">Close</UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
