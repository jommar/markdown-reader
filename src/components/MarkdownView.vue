<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RenderedDoc } from '../markdown/renderer'
import { renderMermaid, getMermaidSourceByEl } from '../markdown/mermaid'
import { useTabs } from '../stores/tabs'
import { useWorkspace } from '../stores/workspace'
import { usePrefs } from '../stores/prefs'
import MermaidFullscreen from './MermaidFullscreen.vue'

const props = defineProps<{
  doc: RenderedDoc
  root: string
}>()

const emit = defineEmits<{ (e: 'show-all'): void; (e: 'mermaidDone'): void }>()

const tabs = useTabs()
const workspace = useWorkspace()
const prefs = usePrefs()
const rootEl = ref<HTMLElement | null>(null)
const fsOpen = ref(false)
const fsSvg = ref('')
const fsSource = ref('')
const zoomMap = new WeakMap<HTMLElement, number>()

function clampZoomLower(v: number) {
  return Math.max(0.1, Math.round(v * 100) / 100)
}

function clampZoom(v: number) {
  return Math.min(3, Math.max(0.5, Math.round(v * 100) / 100))
}

function getZoom(el: HTMLElement): number {
  return zoomMap.get(el) ?? 1
}

function setZoom(el: HTMLElement, v: number, unbounded = false) {
  const z = unbounded ? clampZoomLower(v) : clampZoom(v)
  zoomMap.set(el, z)
  el.style.setProperty('--mermaid-zoom', String(z))
  const label = el.querySelector<HTMLElement>('.mermaid-zoom-label')
  if (label) label.textContent = `${Math.round(z * 100)}%`
  const outBtn = el.querySelector<HTMLButtonElement>('.mermaid-btn-zoom-out')
  const inBtn = el.querySelector<HTMLButtonElement>('.mermaid-btn-zoom-in')
  if (outBtn) outBtn.disabled = z <= (unbounded ? 0.1 : 0.5)
  if (inBtn) inBtn.disabled = !unbounded && z >= 3
}

function computeInlineFit(el: HTMLElement): number | null {
  const svg = el.querySelector('svg') as SVGSVGElement | null
  if (!svg) return null
  const currentZoom = getZoom(el) || 1
  const rect = svg.getBoundingClientRect()
  const naturalW = rect.width / currentZoom
  const naturalH = rect.height / currentZoom
  if (!naturalW || !naturalH) return null
  const pad = 24 // matches prose.css padding 0.75rem*2 + border
  const availW = el.clientWidth - pad
  const availH = el.clientHeight - pad
  // For inline, only width matters primarily; also consider height if tall
  if (availW <= 0) return null
  const fitW = availW / naturalW
  // Always fill: use width fit even if it enlarges small diagrams
  const fit = availH > 200 ? Math.min(fitW, availH / naturalH) : fitW
  if (!Number.isFinite(fit) || fit <= 0) return null
  return clampZoomLower(fit)
}

function getMermaidSource(el: HTMLElement): string {
  // Primary: data-src set by mermaidPlugin (exact fence content)
  const attr = el.getAttribute('data-src')
  if (attr !== null && attr.trim() !== '') return attr
  // Also try dataset (data-src -> dataset.src, data-mermaid-source -> dataset.mermaidSource)
  const ds = (el as HTMLElement & { dataset: DOMStringMap }).dataset
  if (ds?.src && ds.src.trim() !== '') return ds.src
  if ((ds as unknown as Record<string, string>)?.mermaidSource?.trim()) {
    return (ds as unknown as Record<string, string>).mermaidSource
  }
  // Secondary: WeakMap cache in mermaid.ts (survives even if attribute stripped)
  const cached = getMermaidSourceByEl(el)
  if (cached !== undefined && cached.trim() !== '') return cached
  // Tertiary: property mirrored in mermaid.ts
  const prop = (el as unknown as Record<string, unknown>).__mermaidSrc
  if (typeof prop === 'string' && prop.trim() !== '') return prop
  // Fallback for error blocks where source is rendered as code
  const code = el.querySelector<HTMLElement>('.mermaid-error-source code')?.textContent
  if (code && code.trim() !== '') return code
  // Debug: log what we see when nothing found
  console.warn('[mermaid copy] no source found', {
    dataSrc: attr,
    cached,
    prop,
    outer: el.outerHTML.slice(0, 400),
    attrs: Array.from(el.attributes).map((a) => `${a.name}=${a.value.slice(0, 40)}`),
  })
  return ''
}

async function copyCode(btn: HTMLElement) {
  const code = btn.closest('.code-block')?.querySelector('code')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(code)
    workspace.showCopyToast('Code copied')
  } catch {
    workspace.showCopyToast('Copy failed')
  }
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function copyMermaidSource(el: HTMLElement) {
  const src = getMermaidSource(el)
  if (!src || !src.trim()) {
    workspace.showCopyToast('Nothing to copy')
    return
  }
  // Must run within the same user-activation tick; try async clipboard first,
  // then synchronous execCommand fallback. Verify by reading back when possible.
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(src)
      // Verify when clipboard read is available (requires permission in some browsers)
      try {
        if (navigator.clipboard.readText) {
          const back = await navigator.clipboard.readText()
          copied = back === src
          if (!copied) {
            copied = legacyCopy(src)
          }
        } else {
          copied = true
        }
      } catch {
        copied = true
      }
    } else {
      copied = legacyCopy(src)
    }
  } catch {
    copied = legacyCopy(src)
  }
  if (copied) {
    workspace.showCopyToast('Mermaid source copied')
  } else {
    // Final attempt already tried, report failure instead of false success
    workspace.showCopyToast('Copy failed — please select and copy manually')
  }
}

function enhanceMermaids() {
  if (!rootEl.value) return
  const pres = Array.from(rootEl.value.querySelectorAll<HTMLElement>('pre.mermaid[data-rendered]'))
  for (const el of pres) {
    // Ensure source is mirrored to dataset for robust copy even if attribute stripped
    const cached = getMermaidSourceByEl(el)
    if (cached && !el.getAttribute('data-src')) {
      try {
        el.setAttribute('data-src', cached)
      } catch {
        // ignore
      }
    }
    if (el.querySelector('.mermaid-toolbar')) continue
    // error blocks get a minimal copy in header, not full toolbar
    if (el.hasAttribute('data-error')) {
      const header = el.querySelector<HTMLElement>('.mermaid-error-header')
      if (header && !header.querySelector('.mermaid-btn-copy')) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'mermaid-btn-copy'
        btn.setAttribute('aria-label', 'Copy mermaid source')
        btn.textContent = 'Copy'
        btn.style.cssText = 'margin-left:0.5rem;background:var(--bg-elev);color:var(--fg-muted);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.15em 0.5em;font-size:0.72rem;cursor:pointer;'
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          copyMermaidSource(el)
        })
        header.appendChild(btn)
      }
      continue
    }
    const toolbar = document.createElement('div')
    toolbar.className = 'mermaid-toolbar'
    toolbar.setAttribute('role', 'toolbar')
    toolbar.setAttribute('aria-label', 'Mermaid controls')
    toolbar.innerHTML = `
      <button type="button" class="mermaid-btn-copy" aria-label="Copy mermaid source">Copy</button>
      <button type="button" class="mermaid-btn-zoom-out" aria-label="Zoom out">−</button>
      <span class="mermaid-zoom-label">100%</span>
      <button type="button" class="mermaid-btn-zoom-in" aria-label="Zoom in">+</button>
      <button type="button" class="mermaid-btn-zoom-reset" aria-label="Reset zoom">Fit</button>
      <button type="button" class="mermaid-btn-fullscreen" aria-label="Fullscreen">⛶</button>
    `
    el.appendChild(toolbar)
    const hint = document.createElement('span')
    hint.className = 'mermaid-hint'
    hint.textContent = 'Ctrl+wheel to zoom · drag to pan'
    el.appendChild(hint)
    const z = getZoom(el)
    el.style.setProperty('--mermaid-zoom', String(z))
    const label = toolbar.querySelector<HTMLElement>('.mermaid-zoom-label')
    if (label) label.textContent = `${Math.round(z * 100)}%`
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
  const mermaidEl = target.closest('pre.mermaid') as HTMLElement | null
  if (mermaidEl) {
    if (target.closest('.mermaid-btn-copy')) {
      e.preventDefault()
      e.stopPropagation()
      copyMermaidSource(mermaidEl)
      return
    }
    if (target.closest('.mermaid-btn-zoom-in')) {
      e.preventDefault()
      e.stopPropagation()
      setZoom(mermaidEl, getZoom(mermaidEl) + 0.15, true)
      return
    }
    if (target.closest('.mermaid-btn-zoom-out')) {
      e.preventDefault()
      e.stopPropagation()
      setZoom(mermaidEl, getZoom(mermaidEl) - 0.15, true)
      return
    }
    if (target.closest('.mermaid-btn-zoom-reset')) {
      e.preventDefault()
      e.stopPropagation()
      const fit = computeInlineFit(mermaidEl)
      if (fit !== null) setZoom(mermaidEl, fit, true)
      else setZoom(mermaidEl, 1, true)
      return
    }
    if (target.closest('.mermaid-btn-fullscreen')) {
      e.preventDefault()
      e.stopPropagation()
      const svgEl = mermaidEl.querySelector('svg')
      if (svgEl) {
        fsSvg.value = svgEl.outerHTML
        fsSource.value = getMermaidSource(mermaidEl)
        fsOpen.value = true
      }
      return
    }
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
  if (e.button !== 1) {
    // mermaid pan: left-drag on pre.mermaid surface (not on toolbar buttons)
    if (e.button === 0) {
      const mermaidEl = (e.target as HTMLElement).closest('pre.mermaid[data-rendered]') as HTMLElement | null
      if (mermaidEl && !mermaidEl.hasAttribute('data-error')) {
        if ((e.target as HTMLElement).closest('.mermaid-toolbar')) return
        // only pan when zoomed or scrollable
        const startX = e.clientX
        const startY = e.clientY
        const startLeft = mermaidEl.scrollLeft
        const startTop = mermaidEl.scrollTop
        let dragging = false
        let moved = false
        function onMove(ev: MouseEvent) {
          const dx = ev.clientX - startX
          const dy = ev.clientY - startY
          if (!dragging && Math.hypot(dx, dy) < 3) return
          if (!dragging) {
            dragging = true
            mermaidEl!.classList.add('is-panning')
          }
          moved = true
          mermaidEl!.scrollLeft = startLeft - dx
          mermaidEl!.scrollTop = startTop - dy
        }
        function onUp() {
          mermaidEl!.classList.remove('is-panning')
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          if (moved) {
            // prevent click from triggering link handling
            const handler = (ev: MouseEvent) => {
              ev.preventDefault()
              ev.stopPropagation()
              window.removeEventListener('click', handler, true)
            }
            window.addEventListener('click', handler, true)
            setTimeout(() => window.removeEventListener('click', handler, true), 0)
          }
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }
    }
    if ((e.target as HTMLElement).closest('a[data-internal-path]')) e.preventDefault()
    return
  }
  if ((e.target as HTMLElement).closest('a[data-internal-path]')) e.preventDefault()
}

function onWheel(e: WheelEvent) {
  const mermaidEl = (e.target as HTMLElement).closest('pre.mermaid[data-rendered]') as HTMLElement | null
  if (!mermaidEl || mermaidEl.hasAttribute('data-error')) return
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation?.()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  setZoom(mermaidEl, getZoom(mermaidEl) + delta, true)
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

let mermaidSeq = 0

async function runMermaid() {
  const seq = ++mermaidSeq
  await nextTick()
  if (seq !== mermaidSeq) return
  if (props.doc.hasMermaid && rootEl.value) {
    await renderMermaid(rootEl.value, prefs.theme)
    if (seq !== mermaidSeq) return
    enhanceMermaids()
  }
  emit('mermaidDone')
}

onMounted(() => {
  rootEl.value?.addEventListener('click', onClick)
  rootEl.value?.addEventListener('auxclick', onAuxClick)
  rootEl.value?.addEventListener('mousedown', onMouseDown)
  rootEl.value?.addEventListener('wheel', onWheel, { passive: false })
  runMermaid()
})
onBeforeUnmount(() => {
  mermaidSeq++
  rootEl.value?.removeEventListener('click', onClick)
  rootEl.value?.removeEventListener('auxclick', onAuxClick)
  rootEl.value?.removeEventListener('mousedown', onMouseDown)
  rootEl.value?.removeEventListener('wheel', onWheel as EventListener)
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
    <MermaidFullscreen :open="fsOpen" :svg="fsSvg" :source="fsSource" @close="fsOpen = false" />
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
