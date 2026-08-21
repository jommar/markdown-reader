<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTabs } from '../stores/tabs'
import UiIcon from './ui/UiIcon.vue'

const tabs = useTabs()

const trail = computed(() => tabs.trail())
const showDropdown = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function crumbLabel(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.(md|markdown)$/i, '')
}

function goTo(index: number) {
  tabs.goToIndex(index)
  showDropdown.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') showDropdown.value = false
}

function onOutside(e: MouseEvent): void {
  if (!rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) showDropdown.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mousedown', onOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mousedown', onOutside)
})
</script>

<template>
  <nav
    ref="rootEl"
    aria-label="Breadcrumb"
    class="relative flex items-center gap-1 overflow-hidden text-[0.82rem]"
  >
    <template v-if="trail.length === 0">
      <span
        class="text-fg-faint max-w-22 cursor-default truncate rounded p-0.5 px-1 [text-align:left] [direction:rtl]"
        >—</span
      >
    </template>
    <ol v-else class="flex items-center gap-1 overflow-hidden">
      <li>
        <button
          type="button"
          class="text-fg-muted hover:bg-bg-elev hover:text-fg active:bg-bg-inset max-w-22 truncate rounded p-0.5 px-1 [text-align:left] [direction:rtl]"
          :title="trail[0].entry.path"
          :aria-current="trail.length === 1 ? 'page' : undefined"
          @click="goTo(trail[0].index)"
        >
          {{ crumbLabel(trail[0].entry.path) }}
        </button>
      </li>
      <li v-if="trail.length > 2" class="relative">
        <button
          type="button"
          class="text-fg-faint hover:text-fg active:opacity-70 rounded px-1"
          :aria-expanded="showDropdown ? 'true' : 'false'"
          aria-label="Show full trail"
          @click="showDropdown = !showDropdown"
        >
          …
        </button>
        <div
          v-if="showDropdown"
          class="bg-bg-elev absolute top-full left-0 z-50 max-h-60 min-w-70 overflow-y-auto rounded shadow-md"
        >
          <ol>
            <li v-for="(t, i) in trail" :key="i">
              <button
                type="button"
                class="text-fg-muted hover:bg-bg-inset hover:text-fg active:bg-bg-inset w-full truncate px-2.5 py-1 text-left font-mono text-xs"
                :class="{ 'text-accent': t.index === trail[trail.length - 1].index }"
                :title="t.entry.path"
                :aria-current="t.index === trail[trail.length - 1].index ? 'page' : undefined"
                @click="goTo(t.index)"
              >
                {{ t.entry.path }}
              </button>
            </li>
          </ol>
        </div>
      </li>
      <li class="text-fg-faint flex items-center"><UiIcon name="crumb" /></li>
      <li>
        <button
          type="button"
          class="text-fg hover:bg-bg-elev active:bg-bg-inset max-w-22 truncate rounded p-0.5 px-1 [text-align:left] [direction:rtl]"
          :title="trail[trail.length - 1].entry.path"
          aria-current="page"
          @click="goTo(trail[trail.length - 1].index)"
        >
          {{ crumbLabel(trail[trail.length - 1].entry.path) }}
        </button>
      </li>
    </ol>
  </nav>
</template>
