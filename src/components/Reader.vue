<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { renderDocument, type RenderedDoc } from '../markdown/renderer'
import { useTabs } from '../stores/tabs'
import { useWorkspace } from '../stores/workspace'
import { usePrefs } from '../stores/prefs'
import { useHistory } from '../stores/history'
import { usePaste } from '../stores/paste.ts'
import { useScroller } from '../composables/useScroller'
import MarkdownView from './MarkdownView.vue'
import UiSkeleton from './ui/UiSkeleton.vue'
import UiButton from './ui/UiButton.vue'

const tabs = useTabs()
const workspace = useWorkspace()
const prefs = usePrefs()
const history = useHistory()
const paste = usePaste()
const { scroller } = useScroller()

const doc = ref<RenderedDoc | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const showAllTables = ref(false)
const view = ref<InstanceType<typeof MarkdownView> | null>(null)
let lastPendingLine: number | undefined

const entry = computed(() => tabs.currentEntry)

function needsWide(content: string, hasMermaid: boolean): boolean {
  if (hasMermaid) return true
  for (const line of content.split('\n')) {
    if (line.length > 2000) return true
  }
  for (const row of content.split('\n')) {
    const t = row.trim()
    if (t.startsWith('|') && t.endsWith('|')) {
      if (t.split('|').length - 2 > 6) return true
    }
  }
  return false
}

async function load() {
  const e = entry.value
  if (!e) {
    doc.value = null
    loading.value = false
    error.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    const file = await workspace.loadFile(e.path, e.root)
    workspace.currentMtimeMs = file.mtimeMs
    doc.value = await renderDocument(
      file,
      { root: e.root, fileSet: workspace.fileSet },
      { showAllTables: showAllTables.value },
    )
    workspace.currentHeadings = doc.value.headings
    prefs.wideHint = needsWide(file.content, doc.value.hasMermaid)
    history.record(e.root, e.path)
  } catch (err) {
    error.value = (err as Error).message ?? String(err)
  } finally {
    loading.value = false
  }
  await nextTick()
  if (doc.value) applyPending()
}

function onShowAll() {
  showAllTables.value = true
  load()
}

function onPasteShowAll() {
  paste.setShowAllTables(true)
}

function clearPaste() {
  paste.clear()
}

function editPaste() {
  paste.dialogOpen = true
}

async function copyPasteSource() {
  const text = paste.raw
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    workspace.showCopyToast('Markdown copied')
  } catch {
    workspace.showCopyToast('Copy failed')
  }
}

function applyPending() {
  const intent = tabs.consumePending()
  if (intent.line !== undefined) {
    lastPendingLine = intent.line
    view.value?.scrollToLine(intent.line)
  } else if (intent.anchor !== undefined) {
    lastPendingLine = undefined
    view.value?.scrollToAnchor(intent.anchor)
  } else {
    lastPendingLine = undefined
    const e = tabs.currentEntry
    if (scroller.value && e) scroller.value.scrollTop = e.scrollTop
  }
}

function onMermaidDone() {
  if (lastPendingLine !== undefined) {
    view.value?.scrollToLine(lastPendingLine)
  }
}

watch(() => tabs.currentEntry?.path, load, { immediate: true })
watch(
  () => tabs.currentEntry?.root,
  () => {
    showAllTables.value = false
    load()
  },
)
</script>

<template>
  <div v-if="paste.doc" class="paste-preview">
    <div
      class="paste-banner border-border bg-bg-elev sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[0.82rem]"
    >
      <span class="text-accent font-semibold">Pasted preview</span>
      <span class="text-fg-faint hidden text-[0.72rem] sm:inline"
        >Ephemeral — not saved to disk. Internal links are disabled.</span
      >
      <span class="flex-1" />
      <UiButton @click="editPaste">Edit</UiButton>
      <UiButton @click="copyPasteSource">Copy source</UiButton>
      <UiButton @click="clearPaste">Clear</UiButton>
    </div>
    <MarkdownView
      :doc="paste.doc!"
      root=""
      @show-all="onPasteShowAll"
      @mermaidDone="onMermaidDone"
    />
  </div>
  <div
    v-else-if="loading"
    class="reader-state reader-state--loading font-prose"
    role="status"
    aria-live="polite"
  >
    <span class="reader-spinner" aria-hidden="true"></span>
    <p class="reader-title">Loading…</p>
    <UiSkeleton :lines="5" class="w-full max-w-xl" />
  </div>
  <div v-else-if="error" class="reader-state reader-state--error font-prose" role="alert">
    <p class="reader-title">Couldn't open this file</p>
    <p class="reader-detail">{{ error }}</p>
    <UiButton variant="primary" @click="load">Retry</UiButton>
  </div>
  <div v-else-if="!doc" class="reader-state reader-state--empty font-prose" role="status">
    <p class="reader-title">Pick a file to start reading.</p>
    <p class="reader-detail">
      Choose a file from the sidebar, search for content, or paste raw markdown.
    </p>
    <UiButton variant="primary" @click="paste.dialogOpen = true">Paste markdown</UiButton>
  </div>
  <MarkdownView
    v-else
    ref="view"
    :doc="doc"
    :root="entry?.root ?? workspace.root"
    @show-all="onShowAll"
    @mermaidDone="onMermaidDone"
  />
</template>

<style scoped>
.reader-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 16rem;
  padding: 2rem;
  text-align: center;
}

.reader-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-muted);
}

.reader-detail {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-faint);
}

.reader-state--error .reader-title {
  color: var(--danger);
}

.reader-spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 9999px;
  animation: reader-spin 0.8s linear infinite;
}

@keyframes reader-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-spinner {
    animation: none !important;
  }
}
</style>
