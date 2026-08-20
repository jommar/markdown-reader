<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const panelRef = ref<HTMLDivElement | null>(null)
let previousActive: Element | null = null

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousActive = document.activeElement
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
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabindex="-1"
        class="panel border-border-strong bg-bg-elev max-h-[80vh] w-[min(90vw,28rem)] overflow-y-auto rounded-lg border p-4 shadow-lg"
        @keydown="onKeydown"
      >
        <h2 class="text-fg mb-3 text-base font-semibold">Keyboard shortcuts</h2>
        <ul class="space-y-1 text-[0.85rem]">
          <li class="flex justify-between" aria-keyshortcuts="Control+P">
            <span>Focus filter</span><kbd class="font-mono">Ctrl+P</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+Shift+F">
            <span>Focus search</span><kbd class="font-mono">Ctrl+Shift+F</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+T">
            <span>New tab</span><kbd class="font-mono">Ctrl+T</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+W">
            <span>Close tab</span><kbd class="font-mono">Ctrl+W</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Alt+ArrowLeft">
            <span>Back</span><kbd class="font-mono">Alt+←</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Alt+ArrowRight">
            <span>Forward</span><kbd class="font-mono">Alt+→</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+Equal">
            <span>Zoom in</span><kbd class="font-mono">Ctrl+=</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+Minus">
            <span>Zoom out</span><kbd class="font-mono">Ctrl+-</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+0">
            <span>Zoom reset</span><kbd class="font-mono">Ctrl+0</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+Shift+Backslash">
            <span>Toggle wide</span><kbd class="font-mono">Ctrl+Shift+\</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+B">
            <span>Toggle sidebar</span><kbd class="font-mono">Ctrl+B</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Control+K">
            <span>Toggle theme</span><kbd class="font-mono">Ctrl+K</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="/">
            <span>Focus filter</span><kbd class="font-mono">/</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="Escape">
            <span>Clear filter</span><kbd class="font-mono">Esc</kbd>
          </li>
          <li class="flex justify-between" aria-keyshortcuts="?">
            <span>Show shortcuts</span><kbd class="font-mono">?</kbd>
          </li>
        </ul>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="border-border bg-bg-inset text-fg rounded-sm border px-3 py-1 text-[0.85rem]"
            @click="close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
