<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWorkspace, type SearchMode } from '../stores/workspace'
import { useTabs } from '../stores/tabs'
import type { SearchMatch } from '../../server/types'
import UiButton from './ui/UiButton.vue'
import UiInput from './ui/UiInput.vue'

const workspace = useWorkspace()
const tabs = useTabs()

const totalMatches = computed(() =>
  workspace.searchResults.reduce((n, r) => n + (r.matches.length || 1), 0),
)

const activeIndex = ref(-1)
const flatItems = computed(() => {
  const out: { path: string; line?: number; match?: SearchMatch }[] = []
  for (const r of workspace.searchResults) {
    if (r.matches.length === 0) out.push({ path: r.path })
    else for (const m of r.matches) out.push({ path: r.path, line: m.line, match: m })
  }
  return out
})
watch(
  () => workspace.searchResults,
  () => {
    activeIndex.value = -1
  },
)
watch(
  () => workspace.searchQuery,
  () => {
    if (!workspace.searchQuery.trim()) activeIndex.value = -1
  },
)
function flatIndex(path: string, line?: number): number {
  return flatItems.value.findIndex((it) => it.path === path && it.line === line)
}
function onKeydown(e: KeyboardEvent) {
  if (!flatItems.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % flatItems.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + flatItems.value.length) % flatItems.value.length
  } else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    const it = flatItems.value[activeIndex.value]
    if (it) openResult(it.path, it.line)
  }
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  )
}

function setMode(mode: SearchMode) {
  workspace.search(workspace.searchQuery, mode, workspace.searchRegex)
}

function toggleRegex() {
  workspace.search(workspace.searchQuery, workspace.searchMode, !workspace.searchRegex)
}

function renderSnippet(m: SearchMatch): string {
  let out = ''
  let pos = 0
  for (const [s, e] of m.ranges) {
    out += esc(m.text.slice(pos, s)) + '<mark>' + esc(m.text.slice(s, e)) + '</mark>'
    pos = e
  }
  out += esc(m.text.slice(pos))
  return (m.prefixTruncated ? '…' : '') + out + (m.suffixTruncated ? '…' : '')
}

function openResult(path: string, line?: number) {
  tabs.navigate(path, line !== undefined ? { line } : undefined)
}
</script>

<template>
  <div class="flex h-full flex-col" @keydown="onKeydown">
    <div role="search" class="m-2">
      <UiInput
        class="search-input"
        type="text"
        :model-value="workspace.searchQuery"
        placeholder="Search…"
        aria-label="Search"
        @update:model-value="
          (v: string) => workspace.search(v, workspace.searchMode, workspace.searchRegex)
        "
      />
    </div>
    <div class="flex items-center gap-1 px-2 pb-2 text-xs">
      <UiButton
        :active="workspace.searchMode === 'content'"
        class="text-xs"
        @click="setMode('content')"
      >
        Content
      </UiButton>
      <UiButton
        :active="workspace.searchMode === 'files'"
        class="text-xs"
        @click="setMode('files')"
      >
        Files
      </UiButton>
      <label class="text-fg-muted flex items-center gap-0.5">
        <input type="checkbox" :checked="workspace.searchRegex" @change="toggleRegex" />
        Regex
      </label>
    </div>

    <div v-if="workspace.searchLoading" class="text-fg-muted p-2 text-[0.8rem]">Searching…</div>
    <div v-else-if="workspace.searchError" class="text-danger p-2 text-[0.8rem]">
      Invalid pattern: {{ workspace.searchError }}
    </div>
    <div v-else-if="workspace.searchQuery.trim()" class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div v-if="workspace.searchResults.length === 0" class="text-fg-muted p-2 text-[0.8rem]">
        No results for '{{ workspace.searchQuery }}'
      </div>
      <template v-else>
        <div class="text-fg-muted p-2 text-[0.8rem]">
          {{ totalMatches }} results in {{ workspace.searchResults.length }} files
        </div>
        <div v-if="workspace.searchTruncated" class="text-fg-faint p-2 text-[0.8rem]">
          Results truncated — showing first batch
        </div>
        <div role="listbox" aria-label="Search results">
          <div v-for="r in workspace.searchResults" :key="r.path" class="mb-3">
            <div
              v-if="r.matches.length === 0"
              role="option"
              :aria-selected="flatIndex(r.path) === activeIndex ? 'true' : 'false'"
              :tabindex="flatIndex(r.path) === activeIndex ? 0 : -1"
              :data-active="flatIndex(r.path) === activeIndex ? 'true' : undefined"
              class="text-accent cursor-pointer rounded-sm font-mono text-xs"
              :class="{ 'bg-bg-elev': flatIndex(r.path) === activeIndex }"
              :title="r.path"
              @click="openResult(r.path)"
              @mouseenter="activeIndex = flatIndex(r.path)"
            >
              <span class="block truncate">{{ r.path }}</span>
            </div>
            <template v-else>
              <div class="text-accent mb-0.5 block truncate font-mono text-xs" :title="r.path">
                {{ r.path }}
              </div>
              <div
                v-for="(m, i) in r.matches"
                :key="i"
                role="option"
                :aria-selected="flatIndex(r.path, m.line) === activeIndex ? 'true' : 'false'"
                :tabindex="flatIndex(r.path, m.line) === activeIndex ? 0 : -1"
                :data-active="flatIndex(r.path, m.line) === activeIndex ? 'true' : undefined"
                class="text-fg-muted hover:bg-bg-elev flex cursor-pointer gap-1.5 rounded-sm p-0.5 font-mono text-[0.72rem]"
                :class="{ 'bg-bg-elev': flatIndex(r.path, m.line) === activeIndex }"
                @click="openResult(r.path, m.line)"
                @mouseenter="activeIndex = flatIndex(r.path, m.line)"
              >
                <span class="text-fg-faint shrink-0">{{ m.line }}</span>
                <span class="snippet [overflow-wrap:anywhere]" v-html="renderSnippet(m)" />
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.snippet :deep(mark) {
  background: var(--hit);
  color: inherit;
}
</style>
