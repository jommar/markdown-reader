<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useWorkspace } from '../stores/workspace'
import UiButton from './ui/UiButton.vue'
import UiInput from './ui/UiInput.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const workspace = useWorkspace()
const path = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const inputEl = ref<InstanceType<typeof UiInput> | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)
let previousActive: Element | null = null

const canSubmit = computed(() => path.value.trim() !== '' && !submitting.value)

function reset() {
  path.value = ''
  error.value = null
  submitting.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousActive = document.activeElement
      reset()
      void workspace.fetchRoots()
      const app = document.querySelector('.app') as HTMLElement | null
      app?.setAttribute('inert', '')
      nextTick().then(() => inputEl.value?.focus())
    } else {
      const app = document.querySelector('.app') as HTMLElement | null
      app?.removeAttribute('inert')
      // return focus
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

const HOUR = 3_600_000
const DAY = 24 * HOUR

function relativeTime(lastOpened: number): string {
  const diff = Date.now() - lastOpened
  if (diff >= 30 * DAY) return ''
  if (diff >= 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  if (diff >= HOUR) return `${Math.floor(diff / HOUR)}h ago`
  if (diff >= 60_000) return `${Math.floor(diff / 60_000)}m ago`
  return 'just now'
}

async function openRecent(root: string) {
  if (root === workspace.root) {
    close()
    return
  }
  try {
    await workspace.openRoot(root)
    close()
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function submit() {
  const p = path.value.trim()
  if (!p || submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await workspace.openRoot(p)
    close()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
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

function onRecentKeydown(e: KeyboardEvent, root: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openRecent(root)
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
        class="panel border-border-strong bg-bg-elev w-[min(90vw,28rem)] rounded-lg border p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Open folder"
        tabindex="-1"
        @keydown="onPanelKeydown"
      >
        <h2 class="text-fg mb-3 text-base font-semibold">Open folder</h2>
        <UiInput
          ref="inputEl"
          v-model="path"
          class="font-mono text-[0.85rem]"
          placeholder="/path/to/folder"
          aria-label="Directory path"
          :disabled="submitting"
          :invalid="!!error"
          :described-by="error ? 'open-root-error' : undefined"
          @enter="submit"
        />
        <p v-if="error" id="open-root-error" class="text-danger mt-2 text-[0.8rem]">{{ error }}</p>
        <div v-if="workspace.roots.length" class="mt-3">
          <p class="text-fg-muted mb-1 text-[0.72rem] font-semibold tracking-wide uppercase">
            Recent folders
          </p>
          <ul class="recent-list" role="listbox" aria-label="Recent folders">
            <li
              v-for="root in workspace.roots"
              :key="root.root"
              role="option"
              tabindex="0"
              :aria-selected="root.root === workspace.root ? 'true' : 'false'"
              class="recent-entry border-border hover:bg-bg-inset flex cursor-pointer items-center gap-2 rounded border px-2 py-1"
              :class="{ 'current-root border-accent text-accent': root.root === workspace.root }"
              @click="openRecent(root.root)"
              @keydown="onRecentKeydown($event, root.root)"
            >
              <span
                class="recent-label min-w-0 flex-1 truncate font-mono text-[0.8rem]"
                :title="root.root"
                >{{ root.root }}</span
              >
              <span
                v-if="relativeTime(root.lastOpened)"
                class="recent-time text-fg-muted text-[0.72rem]"
                >{{ relativeTime(root.lastOpened) }}</span
              >
            </li>
          </ul>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <UiButton @click="close">Cancel</UiButton>
          <UiButton class="submit" variant="primary" :disabled="!canSubmit" @click="submit"
            >Open</UiButton
          >
        </div>
      </div>
    </div>
  </Teleport>
</template>
