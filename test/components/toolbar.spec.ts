import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import Toolbar from '../../src/components/Toolbar.vue'
import { usePrefs } from '../../src/stores/prefs'
import { useTabs } from '../../src/stores/tabs'
import { useWorkspace } from '../../src/stores/workspace'
import { useHistory } from '../../src/stores/history'

enableAutoUnmount(afterEach)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'clipboard')
  vi.restoreAllMocks()
})

function mountToolbar() {
  return mount(Toolbar, { global: { plugins: [pinia] } })
}

describe('Toolbar', () => {
  test('disables back and forward when there is no active tab', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('button[title="Back (Alt+←)"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[title="Forward (Alt+→)"]').attributes('disabled')).toBeDefined()
  })

  test('back and forward follow the tab history', async () => {
    const wrapper = mountToolbar()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    tabs.navigate('docs/b.md')
    await wrapper.vm.$nextTick()
    const back = wrapper.find('button[title="Back (Alt+←)"]')
    const forward = wrapper.find('button[title="Forward (Alt+→)"]')
    expect(back.attributes('disabled')).toBeUndefined()
    expect(forward.attributes('disabled')).toBeDefined()
    tabs.back()
    await wrapper.vm.$nextTick()
    expect(back.attributes('disabled')).toBeDefined()
    expect(forward.attributes('disabled')).toBeUndefined()
  })

  test('the back button moves the active entry backwards', async () => {
    const wrapper = mountToolbar()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    tabs.navigate('docs/b.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title="Back (Alt+←)"]').trigger('click')
    expect(tabs.currentEntry?.path).toBe('docs/a.md')
  })

  test('renders the current path and its full value in the title', async () => {
    const wrapper = mountToolbar()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    const pathEl = wrapper.find('[title="docs/a.md"]')
    expect(pathEl.exists()).toBe(true)
    expect(pathEl.text()).toBe('docs/a.md')
  })

  test('copy writes the current path to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title^="Copy path"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('docs/a.md')
  })

  test('copy shows a confirmation toast on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const workspace = useWorkspace()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title^="Copy path"]').trigger('click')
    expect(workspace.copyToast).toBe('Path copied')
  })

  test('copy shows a failure toast when the clipboard is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const workspace = useWorkspace()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title^="Copy path"]').trigger('click')
    expect(workspace.copyToast).toBe('Copy failed')
  })

  test('copy swaps the icon to a check and reverts after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('button[title^="Copy path"]')
    expect(btn.find('svg').classes()).toContain('lucide-copy')
    await btn.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.find('button[title="Copied"] svg').classes()).toContain('lucide-check')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('button[title^="Copy path"] svg').classes()).toContain('lucide-copy')
    vi.useRealTimers()
  })

  test('shift+click copies the absolute path and shows the matching toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const workspace = useWorkspace()
    const tabs = useTabs()
    workspace.root = '/home/me/docs'
    tabs.navigate('a.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title^="Copy path"]').trigger('click', { shiftKey: true })
    expect(writeText).toHaveBeenCalledWith('/home/me/docs/a.md')
    expect(workspace.copyToast).toBe('Absolute path copied')
  })

  test('right-click copies the absolute path', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountToolbar()
    const workspace = useWorkspace()
    const tabs = useTabs()
    workspace.root = '/home/me/docs/'
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title^="Copy path"]').trigger('contextmenu')
    expect(writeText).toHaveBeenCalledWith('/home/me/docs/docs/a.md')
  })

  test('zoom buttons step fontScale by 0.1', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    await wrapper.find('button[title="Zoom in"]').trigger('click')
    expect(prefs.fontScale).toBe(1.1)
    await wrapper.find('button[title="Zoom out"]').trigger('click')
    expect(prefs.fontScale).toBe(1)
  })

  test('zoom clamps fontScale to the 0.75–2.0 range', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    prefs.fontScale = 0.7
    await wrapper.find('button[title="Zoom out"]').trigger('click')
    expect(prefs.fontScale).toBe(0.75)
    prefs.fontScale = 2
    await wrapper.find('button[title="Zoom in"]').trigger('click')
    expect(prefs.fontScale).toBe(2)
  })

  test('reset zoom restores fontScale to 1', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    prefs.fontScale = 1.4
    await wrapper.find('button[title="Reset zoom"]').trigger('click')
    expect(prefs.fontScale).toBe(1)
  })

  test('theme toggle flips the pref and swaps the icon', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    expect(prefs.theme).toBe('dark')
    expect(wrapper.find('button[title="Toggle theme"] svg').exists()).toBe(true)
    await wrapper.find('button[title="Toggle theme"]').trigger('click')
    expect(prefs.theme).toBe('light')
    expect(wrapper.find('button[title="Toggle theme"] svg').exists()).toBe(true)
    await wrapper.find('button[title="Toggle theme"]').trigger('click')
    expect(prefs.theme).toBe('dark')
  })

  test('wide mode toggle flips prefs.wideMode', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    expect(prefs.wideMode).toBe(false)
    await wrapper.find('button[title="Wide mode"]').trigger('click')
    expect(prefs.wideMode).toBe(true)
    await wrapper.find('button[title="Wide mode"]').trigger('click')
    expect(prefs.wideMode).toBe(false)
  })

  test('TOC toggle flips prefs.tocVisible', async () => {
    const wrapper = mountToolbar()
    const prefs = usePrefs()
    expect(prefs.tocVisible).toBe(true)
    await wrapper.find('button[title="Toggle TOC"]').trigger('click')
    expect(prefs.tocVisible).toBe(false)
  })

  test('shows the modified time only when the workspace has one', async () => {
    const wrapper = mountToolbar()
    const workspace = useWorkspace()
    expect(wrapper.find('[title^="Modified"]').exists()).toBe(false)
    workspace.currentMtimeMs = 1700000000000
    await wrapper.vm.$nextTick()
    const el = wrapper.find('[title^="Modified"]')
    expect(el.exists()).toBe(true)
    expect(el.text()).toBe(new Date(1700000000000).toLocaleString())
  })

  test('pin button is disabled with no file open', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('button[title="No file open"]').attributes('disabled')).toBeDefined()
  })

  test('pin button pins the currently viewed file and reflects the state', async () => {
    const wrapper = mountToolbar()
    const tabs = useTabs()
    const workspace = useWorkspace()
    const history = useHistory()
    workspace.root = '/r'
    tabs.navigate('docs/a.md')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button[title="Pin this file"]').exists()).toBe(true)
    await wrapper.find('button[title="Pin this file"]').trigger('click')
    expect(history.isPinned('/r', 'docs/a.md')).toBe(true)
    expect(workspace.copyToast).toBe('Pinned')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button[title="Unpin this file"]').exists()).toBe(true)
    await wrapper.find('button[title="Unpin this file"]').trigger('click')
    expect(history.isPinned('/r', 'docs/a.md')).toBe(false)
    expect(workspace.copyToast).toBe('Unpinned')
  })
})
