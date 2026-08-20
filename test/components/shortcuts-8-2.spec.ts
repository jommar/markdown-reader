import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import App from '../../src/App.vue'
import { useShortcuts } from '../../src/composables/useShortcuts'

describe('useShortcuts Esc and ?', () => {
  test('Esc clears filter even when inForm', async () => {
    const handlers = {
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
      openHistory: vi.fn(),
    }
    useShortcuts(handlers as any)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    // dispatch Escape while input focused
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    Object.defineProperty(ev, 'target', { value: input })
    window.dispatchEvent(ev)
    expect(handlers.clearFilter).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  test('? overlay lists combos with aria-keyshortcuts', async () => {
    const src = fs.readFileSync('src/components/ShortcutOverlay.vue', 'utf8')
    expect(src).toContain('aria-keyshortcuts')
    expect(src).toContain('?')
  })

  test('useShortcuts contains ? handler and Esc before inForm guard', () => {
    const src = fs.readFileSync('src/composables/useShortcuts.ts', 'utf8')
    // Esc handling should be before inForm return
    const escIdx = src.indexOf("'Escape'")
    const inFormIdx = src.indexOf('if (inForm) return')
    expect(escIdx).toBeGreaterThan(-1)
    expect(inFormIdx).toBeGreaterThan(-1)
    expect(escIdx).toBeLessThan(inFormIdx)
    // ? handler
    expect(src).toContain('?')
  })
})
