<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RenderedDoc } from '../markdown/renderer'
import { renderMermaid } from '../markdown/mermaid'
import { useTabs } from '../stores/tabs'
import { useWorkspace } from '../stores/workspace'
import { usePrefs } from '../stores/prefs'

const props = defineProps<{
  doc: RenderedDoc
  root: string
}>()

const emit = defineEmits<{ (e: 'show-all'): void; (e: 'mermaidDone'): void }>()

const tabs = useTabs()
const workspace = useWorkspace()
const prefs = usePrefs()
const rootEl = ref<HTMLElement | null>(null)

async function copyCode(btn: HTMLElement) {
  const code = btn.closest('.code-block')?.querySelector('code')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(code)
    workspace.showCopyToast('Code copied')
  } catch {
    workspace.showCopyToast('Copy failed')
  }
}

function onHashClick(e: MouseEvent, a: HTMLAnchorElement) {
  e.preventDefault()
  const id = (a.getAttribute('href') ?? '').slice(1)
  if (!id) return
  const el = rootEl.value?.querySelector(`#${CSS.escape(id)}`)
  if (el) {
    el.scrollIntoView()
    tabs.commitScroll()
    const url = new URL(window.location.href)
    url.hash = id
    history.replaceState(null, '', url.toString())
  }
}

async function onInternalClick(a: HTMLAnchorElement) {
  const upLevels = a.getAttribute('data-above')
  const path = a.getAttribute('data-internal-path')
  if (upLevels !== null && path) {
    const n = Number(upLevels)
    const prevRoot = workspace.root
    const prevPath = tabs.currentEntry?.path ?? ''
    try {
      const out = await workspace.widenRoot(n)
      workspace.widenToast = {
        message: `Root widened to ${out.root}`,
        prevRoot,
        prevPath,
      }
      tabs.navigate(path)
    } catch {
      workspace.widenToast = null
    }
    return
  }
  if (path) tabs.navigate(path)
}

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.copy-btn')) {
    copyCode(target.closest('.copy-btn') as HTMLElement)
    return
  }
  if (target.closest('.table-show-all')) {
    e.preventDefault()
    emit('show-all')
    return
  }
  const a = target.closest('a[href]') as HTMLAnchorElement | null
  if (!a) return
  const href = a.getAttribute('href') ?? ''
  if (href.startsWith('#')) {
    onHashClick(e, a)
    return
  }
  if (a.hasAttribute('data-internal-path')) {
    e.preventDefault()
    const path = a.getAttribute('data-internal-path')
    if (e.ctrlKey || e.metaKey) {
      if (path) tabs.openInNewTab(path)
      return
    }
    onInternalClick(a)
    return
  }
}

function onAuxClick(e: MouseEvent) {
  if (e.button !== 1) return
  const a = (e.target as HTMLElement).closest('a[data-internal-path]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  const path = a.getAttribute('data-internal-path')
  if (path) tabs.openInNewTab(path)
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 1) return
  if ((e.target as HTMLElement).closest('a[data-internal-path]')) e.preventDefault()
}

function scrollToLine(line: number) {
  const els = Array.from(rootEl.value?.querySelectorAll<HTMLElement>('[data-line]') ?? [])
  let target: HTMLElement | null = null
  for (const el of els) {
    const v = Number(el.getAttribute('data-line'))
    if (v <= line) target = el
    else break
  }
  if (target) {
    target.scrollIntoView()
    target.style.outline = '2px solid var(--accent)'
    setTimeout(() => {
      target!.style.outline = ''
    }, 1500)
  }
}

function scrollToAnchor(slug: string) {
  const el = rootEl.value?.querySelector(`#${CSS.escape(slug)}`)
  if (el) el.scrollIntoView()
}

async function runMermaid() {
  if (props.doc.hasMermaid && rootEl.value) {
    await renderMermaid(rootEl.value, prefs.theme)
  }
  emit('mermaidDone')
}

onMounted(() => {
  rootEl.value?.addEventListener('click', onClick)
  rootEl.value?.addEventListener('auxclick', onAuxClick)
  rootEl.value?.addEventListener('mousedown', onMouseDown)
  runMermaid()
})
onBeforeUnmount(() => {
  rootEl.value?.removeEventListener('click', onClick)
  rootEl.value?.removeEventListener('auxclick', onAuxClick)
  rootEl.value?.removeEventListener('mousedown', onMouseDown)
})

watch(
  () => props.doc,
  () => runMermaid(),
)
watch(
  () => prefs.theme,
  () => runMermaid(),
)

defineExpose({ scrollToLine, scrollToAnchor, runMermaid })
</script>

<template>
  <div>
    <article ref="rootEl" class="prose mdr-prose">
      <dl v-if="doc.frontmatter" class="frontmatter">
        <template v-for="(val, key) in doc.frontmatter" :key="key">
          <div class="mdr-fm-row">
            <dt class="mdr-fm-key">{{ key }}</dt>
            <dd class="mdr-fm-val">{{ String(val) }}</dd>
          </div>
        </template>
      </dl>
      <p v-if="doc.highlightingSkipped" class="text-fg-faint mb-4 text-[0.85rem]">
        Syntax highlighting skipped for this large file.
      </p>
      <div v-html="doc.html" />
    </article>
  </div>
</template>

<style scoped>
.mdr-prose ::selection {
  background-color: color-mix(in srgb, var(--accent) 35%, transparent);
}

.mdr-fm-row {
  display: grid;
  grid-template-columns: minmax(6rem, max-content) 1fr;
  gap: 0 1rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--border);
}

.mdr-fm-row:last-child {
  border-bottom: none;
}

.mdr-fm-key {
  font-weight: 700;
  color: var(--accent);
}

.mdr-fm-val {
  color: var(--fg);
  word-break: break-word;
}

.mdr-prose :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
