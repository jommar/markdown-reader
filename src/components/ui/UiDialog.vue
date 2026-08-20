<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    closeOnOverlay?: boolean
  }>(),
  { open: false, title: undefined, closeOnOverlay: true },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panelRef = ref<HTMLDivElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close')
  }
}

function onOverlayClick() {
  if (props.closeOnOverlay) emit('close')
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onMounted(() => {
  if (props.open) document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center p-4">
      <div class="bg-bg/60 absolute inset-0 backdrop-blur-sm" @click="onOverlayClick" />
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="dialog-panel border-border-strong bg-bg-elev relative max-h-[80vh] w-[min(90vw,28rem)] overflow-auto rounded-lg border p-4 shadow-lg"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-panel {
  animation: dialog-in var(--duration-200) var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .dialog-panel {
    animation: none !important;
    transition: none !important;
  }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
