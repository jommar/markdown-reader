<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspace } from '../stores/workspace'
import TreeFilter from './TreeFilter.vue'
import SearchPanel from './SearchPanel.vue'
import UiButton from './ui/UiButton.vue'

const workspace = useWorkspace()

const isSearching = computed(() => workspace.searchQuery.trim() !== '')
</script>

<template>
  <aside class="flex h-full flex-col">
    <div class="shrink-0"><SearchPanel /></div>
    <div v-if="!isSearching" class="min-h-0 flex-1 overflow-hidden"><TreeFilter /></div>
    <div class="border-border text-fg-faint flex items-center justify-between border-t p-2 text-xs">
      <div class="flex gap-1">
        <UiButton title="Open a folder (Ctrl+O)" @click="workspace.dialogOpen = true">
          Open folder
        </UiButton>
        <UiButton title="Refresh tree from disk" @click="workspace.refreshTree">Refresh</UiButton>
      </div>
      <span :title="`${workspace.fileCount} markdown files`">{{ workspace.fileCount }} files</span>
    </div>
  </aside>
</template>
