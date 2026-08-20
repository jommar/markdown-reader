<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { usePaste } from '../stores/paste.ts'
import UiButton from './ui/UiButton.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const paste = usePaste()
const draft = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)
let previousActive: Element | null = null

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousActive = document.activeElement
      draft.value = paste.raw ?? ''
      error.value = null
      submitting.value = false
      const app = document.querySelector('.app') as HTMLElement | null
      app?.setAttribute('inert', '')
      nextTick().then(() => textareaEl.value?.focus())
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

async function submit() {
  const text = draft.value
  if (!text.trim()) {
    error.value = 'Paste some markdown first'
    return
  }
  if (submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await paste.setRaw(text)
    if (paste.error) {
      error.value = paste.error
      return
    }
    close()
  } catch (e) {
    error.value = (e as Error).message ?? String(e)
  } finally {
    submitting.value = false
  }
}

async function handlePasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) draft.value = text
  } catch {
    error.value = 'Clipboard read failed — paste manually'
  }
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
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

function onClearDraft() {
  draft.value = ''
  error.value = null
  textareaEl.value?.focus()
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
        class="panel border-border-strong bg-bg-elev w-[min(92vw,48rem)] rounded-lg border p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Paste markdown"
        tabindex="-1"
        @keydown="onPanelKeydown"
      >
        <h2 class="text-fg mb-2 text-base font-semibold">Paste markdown</h2>
        <p class="text-fg-muted mb-3 text-[0.8rem]">
          Paste raw markdown below and preview it. This is ephemeral — not saved to disk or persisted.
        </p>
        <textarea
          ref="textareaEl"
          v-model="draft"
          class="bg-bg-inset text-fg border-border focus-visible:outline-accent min-h-[18rem] w-full resize-y rounded-sm border px-3 py-2 font-mono text-[0.85rem] leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-1"
          placeholder="# Paste markdown here...

- [x] GFM task lists
- code fences, tables, mermaid

> [!TIP] Callouts work too"
          aria-label="Markdown content"
          :disabled="submitting"
        />
        <div class="mt-2 flex items-center gap-2">
          <UiButton :disabled="submitting" @click="handlePasteFromClipboard"
            >Paste from clipboard</UiButton
          >
          <UiButton :disabled="submitting || !draft" @click="onClearDraft">Clear</UiButton>
          <span class="text-fg-faint ml-auto font-mono text-[0.72rem]">{{ draft.length }} chars</span>
        </div>
        <p v-if="error" class="text-danger mt-2 text-[0.8rem]" role="alert">{{ error }}</p>
        <p v-if="paste.error" class="text-danger mt-2 text-[0.8rem]" role="alert">{{ paste.error }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton @click="close">Cancel</UiButton>
          <UiButton variant="primary" :disabled="!draft.trim() || submitting" @click="submit"
            >Preview</UiButton
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>
