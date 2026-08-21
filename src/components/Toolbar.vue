<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabs } from '../stores/tabs'
import { useWorkspace } from '../stores/workspace'
import { usePrefs } from '../stores/prefs'
import { useHistory } from '../stores/history'
import { usePaste } from '../stores/paste.ts'
import UiButton from './ui/UiButton.vue'
import UiIcon from './ui/UiIcon.vue'

const tabs = useTabs()
const workspace = useWorkspace()
const prefs = usePrefs()
const history = useHistory()
const paste = usePaste()

const path = computed(() => tabs.currentEntry?.path ?? '')
const root = computed(() => tabs.currentEntry?.root ?? workspace.root)
const pinned = computed(() => (path.value ? history.isPinned(root.value, path.value) : false))

function togglePin() {
  if (!path.value) return
  const wasPinned = pinned.value
  history.pinInRoot(root.value, path.value)
  workspace.showCopyToast(wasPinned ? 'Unpinned' : 'Pinned')
}

const mtime = computed(() => {
  if (!workspace.currentMtimeMs) return ''
  return new Date(workspace.currentMtimeMs).toLocaleString()
})

function absolutePath(): string {
  return root.value ? `${root.value.replace(/\/+$/, '')}/${path.value}` : path.value
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function copyPath(abs = false) {
  if (!path.value) return
  const text = abs ? absolutePath() : path.value
  navigator.clipboard
    .writeText(text)
    .then(() => {
      workspace.showCopyToast(abs ? 'Absolute path copied' : 'Path copied')
      copied.value = true
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copied.value = false
        copiedTimer = null
      }, 2000)
    })
    .catch(() => workspace.showCopyToast('Copy failed'))
}

function zoom(delta: number) {
  const next = Math.round((prefs.fontScale + delta) * 10) / 10
  prefs.fontScale = Math.max(0.75, Math.min(2.0, next))
}

function toggleTheme() {
  prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div role="toolbar" class="text-fg-muted flex min-w-0 items-center gap-1.5 text-[0.82rem]">
    <div class="flex gap-0.5">
      <UiButton :disabled="!tabs.canGoBack" title="Back (Alt+←)" @click="tabs.back()">
        <UiIcon name="back" />
      </UiButton>
      <UiButton :disabled="!tabs.canGoForward" title="Forward (Alt+→)" @click="tabs.forward()">
        <UiIcon name="forward" />
      </UiButton>
    </div>
    <div class="flex gap-0.5">
      <UiButton title="Zoom out" @click="zoom(-0.1)">
        <UiIcon name="minus" />
      </UiButton>
      <UiButton title="Reset zoom" @click="prefs.fontScale = 1">
        <UiIcon name="zero" />
      </UiButton>
      <UiButton title="Zoom in" @click="zoom(0.1)">
        <UiIcon name="plus" />
      </UiButton>
    </div>
    <div class="flex gap-0.5">
      <UiButton
        :active="prefs.wideMode"
        title="Wide mode"
        @click="prefs.wideMode = !prefs.wideMode"
      >
        Wide
      </UiButton>
      <UiButton :active="prefs.theme === 'light'" title="Toggle theme" @click="toggleTheme">
        <UiIcon :name="prefs.theme === 'dark' ? 'moon' : 'sun'" />
      </UiButton>
      <UiButton
        :active="prefs.tocVisible"
        title="Toggle TOC"
        @click="prefs.tocVisible = !prefs.tocVisible"
      >
        TOC
      </UiButton>
      <UiButton title="Recent files (Ctrl+Shift+H)" @click="history.dialogOpen = true">
        Recent
      </UiButton>
      <UiButton
        :active="pinned"
        :disabled="!path"
        :title="path ? (pinned ? 'Unpin this file' : 'Pin this file') : 'No file open'"
        @click="togglePin"
      >
        <UiIcon :name="pinned ? 'pin' : 'unpin'" />
      </UiButton>
      <UiButton
        :active="!!paste.doc"
        title="Paste markdown (Ctrl+Shift+V)"
        @click="paste.dialogOpen = true"
      >
        Paste
      </UiButton>
    </div>
    <div class="flex-1 truncate [text-align:left] font-mono text-xs [direction:rtl]" :title="path">
      {{ path }}
    </div>
    <UiButton
      class="shrink-0"
      :title="copied ? 'Copied' : 'Copy path (Shift+click or right-click for absolute path)'"
      :class="copied ? 'text-success' : ''"
      @click="copyPath($event.shiftKey)"
      @contextmenu.prevent="copyPath(true)"
    >
      <UiIcon :name="copied ? 'check' : 'copy'" />
    </UiButton>
    <div v-if="mtime" class="text-fg-faint shrink-0 text-[0.72rem]" :title="`Modified ${mtime}`">
      {{ mtime }}
    </div>
  </div>
</template>
