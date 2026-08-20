<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TreeNode as TNode } from '../../server/types'
import { useTabs } from '../stores/tabs'
import { useWorkspace } from '../stores/workspace'
import { useHistory } from '../stores/history'
import UiIcon from './ui/UiIcon.vue'

const props = defineProps<{
  node: TNode
  depth: number
  forceExpanded?: boolean
  filter?: string
  counts?: Record<string, number>
}>()

const tabs = useTabs()
const workspace = useWorkspace()
const history = useHistory()
const el = ref<HTMLElement | null>(null)
const manual = ref<boolean | null>(null)

const activePath = computed(() => tabs.currentEntry?.path ?? '')

const pinned = computed(() =>
  props.node.type === 'file' ? history.isPinned(workspace.root, props.node.path) : false,
)

function togglePin() {
  if (props.node.type !== 'file') return
  const wasPinned = history.isPinned(workspace.root, props.node.path)
  history.pinInRoot(workspace.root, props.node.path)
  workspace.showCopyToast(wasPinned ? 'Unpinned' : 'Pinned')
}

function countFiles(node: TNode): number {
  if (node.type === 'file') return 1
  let total = 0
  for (const c of node.children) total += countFiles(c)
  return total
}

const fileCount = computed(() => {
  if (props.node.type !== 'dir') return 0
  const fromMap = props.counts?.[props.node.path]
  return fromMap ?? countFiles(props.node)
})

const isAncestor = computed(
  () => props.node.type === 'dir' && activePath.value.startsWith(props.node.path + '/'),
)

const isExpanded = computed(() => {
  if (props.node.type !== 'dir') return true
  if (props.forceExpanded) return true
  return manual.value ?? isAncestor.value
})

function toggle() {
  manual.value = !isExpanded.value
}

function highlightedName(): string {
  const name = props.node.name
  const q = props.filter?.toLowerCase() ?? ''
  if (!q) return escapeHtml(name)
  const lower = name.toLowerCase()
  const indices: boolean[] = new Array(name.length).fill(false)
  let pos = 0
  for (const ch of q) {
    const idx = lower.indexOf(ch, pos)
    if (idx === -1) break
    indices[idx] = true
    pos = idx + 1
  }
  let out = ''
  for (let i = 0; i < name.length; i++) {
    const c = escapeHtml(name[i])
    out += indices[i] ? `<mark>${c}</mark>` : c
  }
  return out
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  )
}

watch(
  activePath,
  (p) => {
    if (props.node.type === 'file' && p === props.node.path) {
      el.value?.scrollIntoView({ block: 'nearest' })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="node.type === 'dir'"
    role="treeitem"
    :aria-expanded="isExpanded ? 'true' : 'false'"
    class="font-prose text-[0.85rem]"
  >
    <button
      type="button"
      class="tree-row text-fg hover:bg-bg-elev relative flex w-full cursor-pointer items-center gap-1 border-0 bg-none py-0.5 pr-1 text-left"
      :class="{ 'dir-row--ancestor': isAncestor }"
      :style="{ paddingLeft: `calc(var(--tree-indent) * ${depth} + var(--tree-row-pad))` }"
      :title="node.path"
      @click="toggle"
    >
      <div
        v-if="depth > 0"
        class="guide-container pointer-events-none absolute inset-y-0"
        :style="{ left: 'var(--tree-row-pad)', width: `calc(var(--tree-indent) * ${depth})` }"
        aria-hidden="true"
      />
      <UiIcon
        :name="isExpanded ? 'chevron-down' : 'chevron-right'"
        class="text-fg-faint shrink-0"
      />
      <!-- rtl middle-truncate: preserves tail of 184-char names; copy via title, not label -->
      <span
        class="label flex-1 truncate [text-align:left] [direction:rtl]"
        dir="rtl"
        v-html="highlightedName()"
      />
      <span
        v-if="fileCount > 0"
        class="bg-bg-inset text-fg-faint shrink-0 rounded-full px-1.5 py-px text-[0.6rem] leading-none"
        :title="`${fileCount} files`"
        >{{ fileCount }}</span
      >
    </button>
    <div v-if="isExpanded">
      <TreeNode
        v-for="c in node.children"
        :key="c.path"
        :node="c"
        :depth="depth + 1"
        :force-expanded="forceExpanded"
        :filter="filter"
        :counts="counts"
      />
    </div>
  </div>
  <div
    v-else
    ref="el"
    role="treeitem"
    tabindex="0"
    class="tree-row font-prose text-fg-muted hover:bg-bg-elev hover:text-fg group focus-within:text-accent focus:text-accent relative flex cursor-pointer items-center py-0.5 pr-1 text-[0.85rem] whitespace-nowrap focus:outline-none"
    :class="{ 'file-row--active': activePath === node.path, 'file-row--pinned': pinned }"
    :style="{ paddingLeft: `calc(var(--tree-indent) * ${depth} + var(--tree-leaf-offset))` }"
    :title="node.path"
    @click="tabs.navigate(node.path)"
    @keydown.enter.prevent="tabs.navigate(node.path)"
    @keydown.space.prevent="tabs.navigate(node.path)"
  >
    <div
      v-if="depth > 0"
      class="guide-container pointer-events-none absolute inset-y-0"
      :style="{ left: 'var(--tree-row-pad)', width: `calc(var(--tree-indent) * ${depth})` }"
      aria-hidden="true"
    />
    <!-- rtl middle-truncate: preserves tail of long names; see dir row above -->
    <span
      class="label truncate [text-align:left] [direction:rtl]"
      dir="rtl"
      v-html="highlightedName()"
    />
    <button
      type="button"
      class="ml-1 shrink-0"
      :class="
        pinned
          ? 'text-accent'
          : 'text-fg-faint opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100'
      "
      :title="pinned ? 'Unpin' : 'Pin'"
      @click.stop="togglePin"
    >
      <UiIcon :name="pinned ? 'pin' : 'unpin'" />
    </button>
  </div>
</template>

<style scoped>
.label :deep(mark) {
  background: var(--hit);
  color: inherit;
  border-radius: 2px;
}

.tree-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.dir-row--ancestor {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.dir-row--ancestor:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.guide-container {
  background-image: repeating-linear-gradient(
    to right,
    transparent 0 calc(var(--tree-indent) - 1px),
    color-mix(in srgb, var(--accent) 20%, transparent) calc(var(--tree-indent) - 1px)
      var(--tree-indent)
  );
}

.file-row--active,
.file-row--active:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.file-row--pinned .label {
  color: var(--accent);
}

.file-row--pinned.file-row--active .label {
  color: var(--accent);
  font-weight: 650;
}
</style>
