<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspace } from '../stores/workspace'
import { usePaste } from '../stores/paste.ts'
import TreeFilter from './TreeFilter.vue'
import SearchPanel from './SearchPanel.vue'
import UiButton from './ui/UiButton.vue'

const workspace = useWorkspace()
const paste = usePaste()

const isSearching = computed(() => workspace.searchQuery.trim() !== '')
</script>

<template>
  <aside class="flex h-full flex-col">
    <div class="shrink-0"><SearchPanel /></div>
    <div v-if="!isSearching" class="min-h-0 flex-1 overflow-hidden"><TreeFilter /></div>
    <div class="border-border text-fg-faint flex flex-col gap-1 border-t p-2 text-xs">
      <div class="flex items-center justify-between">
        <div class="flex gap-1">
          <UiButton title="Open a folder (Ctrl+O)" @click="workspace.dialogOpen = true">
            Open folder
          </UiButton>
          <UiButton title="Refresh tree from disk" @click="workspace.refreshTree">Refresh</UiButton>
          <UiButton
            title="Paste markdown (Ctrl+Shift+V)"
            :active="!!paste.doc"
            @click="paste.dialogOpen = true"
            >Paste</UiButton
          >
        </div>
        <span :title="`${workspace.fileCount} markdown files`">{{ workspace.fileCount }} files</span>
      </div>
      <div
        v-if="paste.doc"
        class="border-accent bg-bg-elev text-fg flex items-center justify-between rounded border px-2 py-1"
      >
        <span class="text-accent text-[0.72rem] font-semibold">Pasted preview active</span>
        <span class="flex gap-1">
          <UiButton title="Edit pasted markdown" @click="paste.dialogOpen = true">Edit</UiButton>
          <UiButton title="Clear pasted preview" @click="paste.clear()">Clear</UiButton>
        </span>
      </div>
    </div>
  </aside>
</template>
