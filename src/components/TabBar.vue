<script setup lang="ts">
import { computed } from 'vue'
import { useTabs } from '../stores/tabs'
import UiIcon from './ui/UiIcon.vue'

const tabs = useTabs()

const titles = computed(() => tabs.titles())

function onAuxClick(e: MouseEvent, id: string) {
  if (e.button === 1) {
    e.preventDefault()
    tabs.closeTab(id)
  }
}
</script>

<template>
  <div
    role="tablist"
    class="bg-bg relative flex scrollbar-none items-center gap-0.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent_100%)] px-2 py-1 text-[0.82rem]"
  >
    <div
      v-for="(t, i) in tabs.tabs"
      :key="t.id"
      role="tab"
      :aria-selected="t.id === tabs.activeId ? 'true' : 'false'"
      :aria-label="t.entries[t.index]?.path ?? 'New tab'"
      class="border-border text-fg-muted flex max-w-50 shrink-0 cursor-pointer items-center gap-1.5 rounded-t border px-2.5 py-1 whitespace-nowrap"
      :class="{ 'border-border-strong bg-bg-elev text-fg': t.id === tabs.activeId }"
      :title="t.entries[t.index]?.path ?? ''"
      @click="tabs.setActiveTab(t.id)"
      @auxclick="onAuxClick($event, t.id)"
    >
      <span class="overflow-hidden text-ellipsis">{{ titles[i] || 'New tab' }}</span>
      <button
        type="button"
        class="text-fg-faint hover:text-danger cursor-pointer border-0 bg-none p-0 text-[0.9rem] leading-none"
        :aria-label="`Close tab ${titles[i] || 'New tab'}`"
        title="Close tab"
        @click.stop="tabs.closeTab(t.id)"
      >
        <UiIcon name="close" />
      </button>
    </div>
    <button
      type="button"
      class="border-border text-fg-muted hover:border-border-strong hover:text-fg size-6 shrink-0 cursor-pointer rounded border bg-none"
      title="New tab"
      @click="tabs.newBlankTab()"
    >
      <UiIcon name="plus" />
    </button>
  </div>
</template>
