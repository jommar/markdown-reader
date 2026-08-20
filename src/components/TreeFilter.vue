<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TreeNode as TNode } from '../../server/types'
import { useWorkspace } from '../stores/workspace'
import { useHistory } from '../stores/history'
import TreeNode from './TreeNode.vue'
import UiInput from './ui/UiInput.vue'
import UiButton from './ui/UiButton.vue'

const workspace = useWorkspace()
const history = useHistory()
const query = ref('')
const pinnedOnly = ref(false)

watch(
  () => workspace.root,
  () => {
    query.value = ''
    pinnedOnly.value = false
  },
)

function subsequenceMatches(path: string, q: string): boolean {
  const lower = path.toLowerCase()
  let pos = 0
  for (const ch of q) {
    const idx = lower.indexOf(ch, pos)
    if (idx === -1) return false
    pos = idx + 1
  }
  return true
}

function filterTree(
  nodes: TNode[],
  q: string,
  pinned: Set<string>,
): { node: TNode; kept: boolean }[] {
  const out: { node: TNode; kept: boolean }[] = []
  for (const n of nodes) {
    if (n.type === 'file') {
      const kept = subsequenceMatches(n.path, q) && (!pinnedOnly.value || pinned.has(n.path))
      out.push({ node: n, kept })
    } else {
      const kids = filterTree(n.children, q, pinned)
      const kept = kids.some((k) => k.kept)
      out.push({
        node: kept ? { ...n, children: kids.filter((k) => k.kept).map((k) => k.node) } : n,
        kept,
      })
    }
  }
  return out
}

const filteredTree = computed<TNode[]>(() => {
  const q = query.value.trim()
  if (!q && !pinnedOnly.value) return workspace.tree
  const pinned = pinnedOnly.value ? history.pinnedPaths(workspace.root) : new Set<string>()
  return filterTree(workspace.tree, q.toLowerCase(), pinned)
    .filter((k) => k.kept)
    .map((k) => k.node)
})

const hasQuery = computed(() => query.value.trim().length > 0 || pinnedOnly.value)

const dirCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  const count = (node: TNode): number => {
    if (node.type === 'file') return 1
    let total = 0
    for (const c of node.children) total += count(c)
    map[node.path] = total
    return total
  }
  for (const n of workspace.tree) count(n)
  return map
})

const totalFileCount = computed(() => {
  let total = 0
  const cnt = (n: TNode): void => {
    if (n.type === 'file') total++
    else for (const c of n.children) cnt(c)
  }
  for (const n of workspace.tree) cnt(n)
  return total
})

const filteredFileCount = computed(() => {
  let total = 0
  const cnt = (n: TNode): void => {
    if (n.type === 'file') total++
    else for (const c of n.children) cnt(c)
  }
  for (const n of filteredTree.value) cnt(n)
  return total
})

function clearFilter(): void {
  query.value = ''
  pinnedOnly.value = false
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-2 px-2 pt-2">
      <UiInput
        v-model="query"
        class="filter-input flex-1"
        placeholder="Filter tree…"
        aria-label="Filter tree"
      />
      <UiButton
        :active="pinnedOnly"
        :title="pinnedOnly ? 'Show all files' : 'Show only pinned files'"
        @click="pinnedOnly = !pinnedOnly"
      >
        Pinned
      </UiButton>
      <UiButton
        v-if="query.trim().length > 0"
        aria-label="Clear"
        title="Clear filter"
        @click="clearFilter"
      >
        ×
      </UiButton>
    </div>
    <div v-if="hasQuery" class="text-fg-faint flex items-center gap-1 px-2 pt-1 text-[0.72rem]">
      <span>{{ filteredFileCount }} / {{ totalFileCount }} files</span>
      <UiButton v-if="filteredFileCount > 0" class="ml-auto" @click="clearFilter">Clear</UiButton>
    </div>
    <div role="tree" class="min-h-0 flex-1 overflow-y-auto pb-4">
      <div v-if="hasQuery && filteredTree.length === 0" class="text-fg-faint p-2 text-[0.8rem]">
        <span v-if="query.trim().length > 0">No matches for '{{ query.trim() }}' • </span>
        <span v-else>No pinned files in this folder. • </span>
        <UiButton @click="clearFilter">Clear</UiButton>
      </div>
      <template v-else>
        <TreeNode
          v-for="c in filteredTree"
          :key="c.path"
          :node="c"
          :depth="0"
          :force-expanded="hasQuery"
          :filter="hasQuery ? query.trim().toLowerCase() : undefined"
          :counts="dirCounts"
        />
      </template>
    </div>
  </div>
</template>
