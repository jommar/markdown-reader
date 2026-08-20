import { describe, expect, test, vi } from 'vitest'
import { useShortcuts, type ShortcutHandlers } from '../../src/composables/useShortcuts'

function makeHandlers(): ShortcutHandlers {
  return {
    newTab: vi.fn(),
    closeTab: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomReset: vi.fn(),
    toggleWide: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleTheme: vi.fn(),
    focusFilter: vi.fn(),
    focusSearch: vi.fn(),
    clearFilter: vi.fn(),
    openFolder: vi.fn(),
  }
}

function press(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

describe('useShortcuts', () => {
  test('Ctrl+O triggers openFolder', () => {
    const handlers = makeHandlers()
    useShortcuts(handlers)
    press('o', { ctrlKey: true })
    expect(handlers.openFolder).toHaveBeenCalledTimes(1)
  })

  test('Ctrl+O does not disturb existing combos', () => {
    const handlers = makeHandlers()
    useShortcuts(handlers)
    press('o', { ctrlKey: true })
    press('p', { ctrlKey: true })
    press('t', { ctrlKey: true })
    expect(handlers.focusFilter).toHaveBeenCalledTimes(1)
    expect(handlers.newTab).toHaveBeenCalledTimes(1)
  })

  test('plain "o" without a modifier does nothing', () => {
    const handlers = makeHandlers()
    useShortcuts(handlers)
    press('o')
    expect(handlers.openFolder).not.toHaveBeenCalled()
  })
})
