<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWorkspace } from '../stores/workspace'
import { useScroller } from '../composables/useScroller'

const workspace = useWorkspace()
const { scroller } = useScroller()

const active = ref<string>('')
let observer: IntersectionObserver | null = null

function findHeadingEls() {
  const root = scroller.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4'))
}

function setupObserver() {
  observer?.disconnect()
  observer = null
  const root = scroller.value
  if (!root) return
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((en) => en.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length > 0) {
        const first = visible[0].target as HTMLElement
        if (first.id) active.value = first.id
      }
    },
    { root, rootMargin: '0px 0px -70% 0px' },
  )
  for (const el of findHeadingEls()) observer.observe(el)
}

function clickHeading(slug: string) {
  const el = scroller.value?.querySelector(`#${CSS.escape(slug)}`)
  if (el) el.scrollIntoView()
  active.value = slug
}

watch(
  () => workspace.currentHeadings,
  () => {
    requestAnimationFrame(setupObserver)
  },
)

onMounted(() => {
  requestAnimationFrame(setupObserver)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <nav
    v-if="workspace.currentHeadings.length >= 3"
    aria-label="Table of contents"
    class="flex flex-col text-[0.8rem]"
  >
    <div class="text-fg-muted mb-2 text-[0.7rem] font-semibold tracking-wider uppercase">
      On this page
    </div>
    <a
      v-for="h in workspace.currentHeadings"
      :key="h.slug"
      class="mdr-toc-link truncate no-underline"
      :class="{ 'mdr-toc-link--active': active === h.slug }"
      :style="{ paddingLeft: (h.level - 1) * 12 + 'px' }"
      :href="'#' + h.slug"
      :aria-current="active === h.slug ? 'location' : undefined"
      @click.prevent="clickHeading(h.slug)"
      >{{ h.text }}</a
    >
  </nav>
</template>

<style scoped>
.mdr-toc-link {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
  padding-right: 0.375rem;
  color: var(--fg-muted);
  border-left: 2px solid transparent;
  border-radius: 0.25rem;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.mdr-toc-link:hover {
  color: var(--fg);
  background-color: color-mix(in srgb, var(--bg-inset) 60%, transparent);
}

.mdr-toc-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.mdr-toc-link--active {
  color: var(--accent);
  font-weight: 600;
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
  border-left-color: var(--accent);
}
</style>
