import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import HistoryDialog from '../../src/components/HistoryDialog.vue'
import { useHistory } from '../../src/stores/history.ts'
import { useWorkspace } from '../../src/stores/workspace.ts'
import { useTabs } from '../../src/stores/tabs.ts'

enableAutoUnmount(afterEach)

let pinia: Pinia

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as unknown as Response
}

function mockFetch(opts: { postError?: string } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url === '/api/roots' && init?.method === 'POST') {
      if (opts.postError) return jsonResponse({ error: opts.postError }, false)
      return jsonResponse({ root: '/other' })
    }
    if (url === '/api/roots') return jsonResponse({ roots: [], initial: undefined })
    if (url.startsWith('/api/tree')) {
      return jsonResponse({ tree: [], files: [], fileCount: 0, builtAt: 0 })
    }
    return jsonResponse({ error: 'not found' }, false)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

function seed(entries: { root: string; path: string; pinned?: boolean }[]) {
  const history = useHistory()
  for (const e of entries) {
    history.record(e.root, e.path)
    if (e.pinned) history.togglePin(e.root, e.path)
  }
  return history
}

function docQuery(sel: string) {
  return document.body.querySelector(sel)
}
function docQueryAll(sel: string) {
  return document.body.querySelectorAll(sel)
}

async function mountDialog(): Promise<VueWrapper> {
  const wrapper = mount(HistoryDialog, { global: { plugins: [pinia] }, attachTo: document.body })
  const history = useHistory()
  history.dialogOpen = true
  await wrapper.vm.$nextTick()
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.querySelector('meta[name="mdr-token"]')?.remove()
  // do not wipe body - Teleport nodes are managed by Vue; clear leftover overlays if any
  document.body.querySelectorAll('.overlay').forEach((el) => el.remove())
})

describe('HistoryDialog', () => {
  test('shows the empty state when there is no history', async () => {
    mockFetch()
    const wrapper = await mountDialog()
    expect(!!docQuery('.overlay')).toBe(true)
    expect(document.body.textContent).toContain('No files read yet')
    wrapper.unmount()
  })

  test('does not render when closed', async () => {
    mockFetch()
    const wrapper = mount(HistoryDialog, { global: { plugins: [pinia] }, attachTo: document.body })
    expect(!!docQuery('.overlay')).toBe(false)
    wrapper.unmount()
  })

  test('renders Pinned and Recent sections separately', async () => {
    mockFetch()
    const history = seed([
      { root: '/r', path: 'recent.md' },
      { root: '/r', path: 'pinned.md', pinned: true },
    ])
    const wrapper = await mountDialog()
    expect(document.body.textContent).toContain('Pinned')
    expect(document.body.textContent).toContain('Recent')
    expect(history.pinned.map((e) => e.path)).toEqual(['pinned.md'])
    expect(history.recent.map((e) => e.path)).toEqual(['recent.md'])
    wrapper.unmount()
  })

  test('clicking an entry in the current root navigates without opening a new root', async () => {
    const { calls } = mockFetch()
    seed([{ root: '/r', path: 'a.md' }])
    const ws = useWorkspace()
    ws.root = '/r'
    const tabs = useTabs()
    const wrapper = await mountDialog()
    const row = docQueryAll('li[role="option"]')[0] as HTMLElement
    row.click()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(ws.root).toBe('/r')
    expect(tabs.currentEntry?.path).toBe('a.md')
    expect(calls.some((c) => c.url === '/api/roots' && c.init?.method === 'POST')).toBe(false)
    expect(history().dialogOpen).toBe(false)
    wrapper.unmount()
  })

  test('clicking an entry in a different root opens that root then navigates', async () => {
    const { calls } = mockFetch()
    seed([{ root: '/other', path: 'b.md' }])
    const ws = useWorkspace()
    ws.root = '/r'
    const tabs = useTabs()
    const wrapper = await mountDialog()
    const row = docQueryAll('li[role="option"]')[0] as HTMLElement
    row.click()
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === '/api/roots' && c.init?.method === 'POST')).toBe(true)
    })
    await vi.waitFor(() => expect(ws.root).toBe('/other'))
    await vi.waitFor(() => expect(tabs.currentEntry?.path).toBe('b.md'))
    wrapper.unmount()
  })

  test('pin toggle does not open the file', async () => {
    mockFetch()
    const history = seed([{ root: '/r', path: 'a.md' }])
    const tabs = useTabs()
    const wrapper = await mountDialog()
    const pinBtn = docQuery('li[role="option"] button') as HTMLElement
    pinBtn.click()
    await wrapper.vm.$nextTick()
    expect(history.entries[0].pinned).toBe(true)
    expect(tabs.currentEntry).toBeNull()
    expect(history.dialogOpen).toBe(true)
    wrapper.unmount()
  })

  test('delete removes the entry and undo restores it', async () => {
    mockFetch()
    const history = seed([{ root: '/r', path: 'a.md' }])
    const wrapper = await mountDialog()
    const li = docQueryAll('li[role="option"]')[0] as HTMLElement
    const delBtn = Array.from(li.querySelectorAll('button')).find(
      (b) => b.getAttribute('title') === 'Remove from history',
    ) as HTMLElement
    delBtn.click()
    await wrapper.vm.$nextTick()
    expect(history.entries.length).toBe(0)
    expect(history.toast).toBeTruthy()
    history.undoRemove()
    expect(history.entries.map((e) => e.path)).toEqual(['a.md'])
    wrapper.unmount()
  })

  test('Escape closes the dialog', async () => {
    mockFetch()
    seed([{ root: '/r', path: 'a.md' }])
    const wrapper = await mountDialog()
    const panel = docQuery('[role="dialog"]') as HTMLElement
    panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(useHistory().dialogOpen).toBe(false)
    wrapper.unmount()
  })

  test('current-root entries are visually marked', async () => {
    mockFetch()
    seed([
      { root: '/r', path: 'same.md' },
      { root: '/other', path: 'other.md' },
    ])
    useWorkspace().root = '/r'
    const wrapper = await mountDialog()
    const rows = docQueryAll('li[role="option"]')
    expect((rows[0] as HTMLElement).classList.contains('border-accent')).toBe(true)
    expect((rows[1] as HTMLElement).classList.contains('border-accent')).toBe(false)
    wrapper.unmount()
  })

  test('open failure renders an inline error and keeps the dialog open', async () => {
    mockFetch({ postError: 'bogus root' })
    seed([{ root: '/other', path: 'b.md' }])
    useWorkspace().root = '/r'
    const wrapper = await mountDialog()
    const row = docQueryAll('li[role="option"]')[0] as HTMLElement
    row.click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('bogus root'))
    expect(useHistory().dialogOpen).toBe(true)
    wrapper.unmount()
  })
})

function history() {
  return useHistory()
}
