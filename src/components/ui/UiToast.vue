<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string
    kind?: 'info' | 'success' | 'warning' | 'error'
    duration?: number | null
    showUndo?: boolean
    showDismiss?: boolean
  }>(),
  { kind: 'info', duration: null, showUndo: true, showDismiss: true },
)

const emit = defineEmits<{
  (e: 'undo'): void
  (e: 'dismiss'): void
}>()

let timer: ReturnType<typeof setTimeout> | null = null
let remaining = 0
let start = 0

function ensurePortal(): void {
  if (typeof document === 'undefined') return
  if (!document.getElementById('mdr-toast-portal')) {
    const el = document.createElement('div')
    el.id = 'mdr-toast-portal'
    el.setAttribute('data-testid', 'toast-portal')
    el.className =
      'toast-viewport fixed bottom-4 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 flex-col gap-2'
    document.body.appendChild(el)
  }
}

ensurePortal()

function startTimer(ms: number) {
  remaining = ms
  start = Date.now()
  timer = setTimeout(() => emit('dismiss'), ms)
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function pause() {
  if (timer) {
    clearTimeout(timer)
    timer = null
    remaining = remaining - (Date.now() - start)
    if (remaining < 0) remaining = 0
  }
}

function resume() {
  if (remaining > 0 && !timer) {
    start = Date.now()
    timer = setTimeout(() => emit('dismiss'), remaining)
  }
}

onMounted(() => {
  if (props.duration !== null && props.duration !== undefined) {
    startTimer(props.duration)
  }
})

onBeforeUnmount(() => clearTimer())
</script>

<template>
  <Teleport to="#mdr-toast-portal">
    <div
      class="toast-item border-border-strong bg-bg-elev text-fg flex items-center gap-4 rounded-md border px-4 py-2 text-[0.9rem] shadow-md transition-all duration-200"
      role="status"
      :aria-live="kind === 'error' ? 'assertive' : 'polite'"
      @mouseenter="pause"
      @mouseleave="resume"
    >
      <span>{{ message }}</span>
      <button
        v-if="showUndo"
        type="button"
        class="bg-accent text-bg hover:opacity-90 active:opacity-70 focus-visible:outline-accent rounded-sm border-0 px-1.5 py-0.5 text-[0.85rem] focus-visible:outline-2 focus-visible:outline-offset-1"
        @click="emit('undo')"
      >
        Undo
      </button>
      <button
        v-if="showDismiss"
        type="button"
        class="border-border bg-bg-inset text-fg-muted hover:bg-bg-elev hover:text-fg active:bg-bg-inset focus-visible:outline-accent rounded-sm border px-1.5 py-0.5 text-[0.85rem] focus-visible:outline-2 focus-visible:outline-offset-1"
        @click="emit('dismiss')"
      >
        Dismiss
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-item {
  transition:
    opacity var(--duration-200) var(--ease-standard),
    transform var(--duration-200) var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .toast-item {
    transition: none !important;
    animation: none !important;
  }
}
</style>
