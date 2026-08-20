<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps<{
  open: boolean
  svg: string
  source: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const zoom = ref(1)
const containerRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)

let isDragging = false
let startX = 0
let startY = 0
let startLeft = 0
let startTop = 0

function clampLower(v: number) {
  return Math.max(0.1, Math.round(v * 100) / 100)
}

function onZoomIn() {
  zoom.value = clampLower(zoom.value + 0.15)
}
function onZoomOut() {
  zoom.value = clampLower(zoom.value - 0.15)
}

function getNaturalSize(svg: SVGSVGElement, currentZoom: number): { w: number; h: number } | null {
  const rect = svg.getBoundingClientRect()
  let w = rect.width / currentZoom
  let h = rect.height / currentZoom
  if (w > 10 && h > 10) return { w, h }
  // Fallback when transform not yet laid out or rect is 0 (e.g. hidden/happy-dom)
  try {
    const bbox = svg.getBBox()
    if (bbox.width > 0 && bbox.height > 0) return { w: bbox.width, h: bbox.height }
  } catch {
    // getBBox may throw if not attached
  }
  const vb = svg.viewBox?.baseVal
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height }
  const attrW = parseFloat(svg.getAttribute('width') || '')
  const attrH = parseFloat(svg.getAttribute('height') || '')
  if (Number.isFinite(attrW) && Number.isFinite(attrH) && attrW > 0 && attrH > 0) return { w: attrW, h: attrH }
  if (w > 0 && h > 0) return { w, h }
  return null
}

function computeFit(): number | null {
  const vp = viewportRef.value
  const container = containerRef.value
  if (!vp || !container) return null
  const svg = container.querySelector('svg') as SVGSVGElement | null
  if (!svg) return null
  const currentZoom = zoom.value || 1
  const natural = getNaturalSize(svg, currentZoom)
  if (!natural) return null
  const { w: naturalW, h: naturalH } = natural
  const style = getComputedStyle(vp)
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) || 48
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 48
  const availW = vp.clientWidth - padX
  const availH = vp.clientHeight - padY
  if (availW <= 0 || availH <= 0) return null
  const scaleW = availW / naturalW
  const scaleH = availH / naturalH
  const fit = Math.min(scaleW, scaleH)
  if (!Number.isFinite(fit) || fit <= 0) return null
  // always fill: even small diagrams enlarge to fill
  return clampLower(fit)
}

function onFit() {
  const fit = computeFit()
  if (fit !== null) zoom.value = fit
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  e.stopPropagation()
  // Also stop capture-phase window handler in useShortcuts
  e.stopImmediatePropagation?.()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  zoom.value = clampLower(zoom.value + delta)
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return
  const vp = viewportRef.value
  if (!vp) return
  isDragging = true
  vp.classList.add('is-panning')
  startX = e.clientX
  startY = e.clientY
  startLeft = vp.scrollLeft
  startTop = vp.scrollTop
  function onMove(ev: MouseEvent) {
    if (!isDragging || !vp) return
    vp.scrollLeft = startLeft - (ev.clientX - startX)
    vp.scrollTop = startTop - (ev.clientY - startY)
  }
  function onUp() {
    isDragging = false
    vp?.classList.remove('is-panning')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

let fitTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFit(attempt = 0) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fit = computeFit()
      if (fit !== null) {
        zoom.value = fit
      } else if (attempt < 8) {
        setTimeout(() => scheduleFit(attempt + 1), 40)
      }
    })
  })
}

function scheduleFitWithWait(delayMs = 160) {
  if (fitTimer) clearTimeout(fitTimer)
  fitTimer = setTimeout(() => {
    fitTimer = null
    scheduleFit()
  }, delayMs)
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
      // Reset to 1 so measurement yields natural size reliably
      zoom.value = 1
      await nextTick()
      await nextTick()
      // Wait for container/transition to settle before measuring
      scheduleFitWithWait(180)
    } else {
      if (fitTimer) {
        clearTimeout(fitTimer)
        fitTimer = null
      }
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    }
  },
)

watch(
  () => props.svg,
  async () => {
    if (props.open) {
      zoom.value = 1
      await nextTick()
      scheduleFitWithWait(120)
    }
  },
)

onBeforeUnmount(() => {
  if (fitTimer) clearTimeout(fitTimer)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mermaid-fs-overlay" @click.self="emit('close')" @wheel.capture="onWheel">
      <div class="mermaid-fs-panel" @mousedown="onMouseDown">
        <div class="mermaid-fs-toolbar">
          <span class="mermaid-fs-zoom-label">{{ Math.round(zoom * 100) }}%</span>
          <button type="button" class="mermaid-fs-btn" aria-label="Zoom out" @click="onZoomOut">−</button>
          <button type="button" class="mermaid-fs-btn" aria-label="Zoom in" @click="onZoomIn">+</button>
          <button type="button" class="mermaid-fs-btn" aria-label="Fit to viewport" @click="onFit">Fit</button>
          <span class="mermaid-fs-hint">Ctrl+wheel to zoom · drag to pan</span>
          <button type="button" class="mermaid-fs-btn mermaid-fs-close" aria-label="Close fullscreen" @click="emit('close')">✕</button>
        </div>
        <div
          ref="viewportRef"
          class="mermaid-fs-viewport"
          :style="{ '--mermaid-zoom': String(zoom) } as unknown as Record<string,string>"
        >
          <div ref="containerRef" class="mermaid-fs-content" v-html="svg" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mermaid-fs-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.mermaid-fs-panel {
  background: var(--bg-elev);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: min(96vw, 96rem);
  height: min(90vh, 64rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mermaid-fs-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}

.mermaid-fs-zoom-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--fg-muted);
  min-width: 3rem;
  text-align: center;
}

.mermaid-fs-hint {
  font-size: 0.68rem;
  color: var(--fg-faint);
  margin-left: 0.5rem;
  margin-right: auto;
}

.mermaid-fs-btn {
  background: var(--bg-elev);
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.25em 0.6em;
  font-size: 0.78rem;
  cursor: pointer;
  line-height: 1;
}

.mermaid-fs-btn:hover {
  color: var(--fg);
  border-color: var(--border-strong);
  background: var(--bg);
}

.mermaid-fs-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.mermaid-fs-viewport {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
  scrollbar-gutter: stable;
  --mermaid-zoom: 1;
}

.mermaid-fs-viewport.is-panning {
  cursor: grabbing;
  user-select: none;
}

.mermaid-fs-viewport:not(.is-panning) {
  cursor: grab;
}

.mermaid-fs-content {
  flex-shrink: 0;
}

.mermaid-fs-content :deep(svg) {
  display: block;
  margin: 0 auto;
  transform: scale(var(--mermaid-zoom));
  transform-origin: top center;
  transition: transform 100ms var(--ease-standard);
}
</style>
