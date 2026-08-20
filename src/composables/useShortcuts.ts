export interface ShortcutHandlers {
  newTab(): void
  closeTab(): void
  back(): void
  forward(): void
  zoomIn(): void
  zoomOut(): void
  zoomReset(): void
  toggleWide(): void
  toggleSidebar(): void
  toggleTheme(): void
  focusFilter(): void
  focusSearch(): void
  clearFilter(): void
  openFolder(): void
  openHistory(): void
  openPaste(): void
  toggleHelp?(): void
}

const ZOOM_KEYS = new Set(['=', '+', '-', '_', '0'])
const ZOOM_CODES = new Set(['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0'])

function isFormField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  const onKeydown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    const inForm = isFormField(e.target)

    if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault()
      handlers.openPaste()
      return
    }

    if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
      e.preventDefault()
      handlers.focusFilter()
      return
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      handlers.focusSearch()
      return
    }
    if (mod && e.key.toLowerCase() === 't' && !e.shiftKey) {
      e.preventDefault()
      handlers.newTab()
      return
    }
    if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey) {
      e.preventDefault()
      handlers.closeTab()
      return
    }
    if (mod && e.key.toLowerCase() === 'b' && !e.shiftKey) {
      e.preventDefault()
      handlers.toggleSidebar()
      return
    }
    if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey) {
      e.preventDefault()
      handlers.openFolder()
      return
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault()
      handlers.openHistory()
      return
    }
    if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) {
      e.preventDefault()
      handlers.toggleTheme()
      return
    }
    if (mod && e.shiftKey && e.key === '\\') {
      e.preventDefault()
      handlers.toggleWide()
      return
    }
    if ((mod && ZOOM_KEYS.has(e.key)) || (mod && ZOOM_CODES.has(e.code))) {
      e.preventDefault()
      if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') handlers.zoomIn()
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') handlers.zoomOut()
      else handlers.zoomReset()
      return
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !inForm) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlers.back()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handlers.forward()
        return
      }
    }
    if (e.key === 'Escape') {
      handlers.clearFilter()
      return
    }
    if (e.key === '?' && !inForm) {
      e.preventDefault()
      handlers.toggleHelp?.()
      return
    }
    if (inForm) return
    if (e.key === '/') {
      e.preventDefault()
      handlers.focusFilter()
      return
    }
  }

  window.addEventListener('keydown', onKeydown, { capture: true })

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      if (e.deltaY < 0) handlers.zoomIn()
      else handlers.zoomOut()
    }
  }
  window.addEventListener('wheel', onWheel, { passive: false, capture: true })
}
