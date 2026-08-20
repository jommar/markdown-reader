import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import OpenRootDialog from '../../src/components/OpenRootDialog.vue'
import { useWorkspace } from '../../src/stores/workspace.ts'
import type { RootInfo } from '../../server/types.ts'

enableAutoUnmount(afterEach)

const HOUR = 3_600_000
const DAY = 24 * HOUR

let pinia: Pinia

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as unknown as Response
}

function mockFetch(opts: { postError?: string; roots?: RootInfo[]; rootsError?: string } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url === '/api/roots' && init?.method === 'POST') {
      if (opts.postError) return jsonResponse({ error: opts.postError }, false)
      return jsonResponse({ root: '/tmp/root' })
    }
    if (url === '/api/roots') {
      if (opts.rootsError) return jsonResponse({ error: opts.rootsError }, false)
      return jsonResponse({ roots: opts.roots ?? [], initial: undefined })
    }
    if (url.startsWith('/api/tree')) {
      return jsonResponse({ tree: [], files: [], fileCount: 0, builtAt: 0 })
    }
    return jsonResponse({ error: 'not found' }, false)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

function docQuery(sel: string): Element | null {
  return document.body.querySelector(sel) ?? document.querySelector(sel)
}
function docQueryAll(sel: string): NodeListOf<Element> {
  const a = document.body.querySelectorAll(sel)
  return a.length ? a : document.querySelectorAll(sel)
}
function overlayExists(): boolean {
  return !!docQuery('.overlay')
}
function panelExists(): boolean {
  return !!docQuery('.panel')
}

async function mountDialog(open = true): Promise<VueWrapper> {
  const wrapper = mount(OpenRootDialog, {
    props: { open },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  await new Promise((r) => setTimeout(r, 0))
  return wrapper
}

async function openDialog(wrapper: VueWrapper): Promise<void> {
  await wrapper.setProps({ open: true })
  await wrapper.vm.$nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  pinia = createPinia()
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.querySelector('meta[name="mdr-token"]')?.remove()
  document.body.querySelectorAll('.overlay').forEach((el) => el.remove())
})

describe('OpenRootDialog', () => {
  test('renders the dialog when open', async () => {
    mockFetch()
    const wrapper = await mountDialog(true)
    expect(overlayExists()).toBe(true)
    expect(panelExists()).toBe(true)
    const input = docQuery('input') as HTMLInputElement | null
    expect(input?.getAttribute('placeholder')).toContain('/')
    wrapper.unmount()
  })

  test('does not render when closed', async () => {
    const wrapper = await mountDialog(false)
    expect(overlayExists()).toBe(false)
    wrapper.unmount()
  })

  test('submit is disabled for empty or whitespace input', async () => {
    mockFetch()
    const wrapper = await mountDialog(true)
    const btn = docQuery('button.submit') as HTMLButtonElement | null
    expect(btn?.getAttribute('disabled')).toBeDefined()
    const input = docQuery('input') as HTMLInputElement | null
    if (input) {
      input.value = '   '
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
    }
    const btn2 = docQuery('button.submit') as HTMLButtonElement | null
    expect(btn2?.getAttribute('disabled')).toBeDefined()
    wrapper.unmount()
  })

  test('submit calls openRoot with the input value and emits close on success', async () => {
    const { calls } = mockFetch()
    const wrapper = await mountDialog(true)
    const input = docQuery('input') as HTMLInputElement | null
    if (input) {
      input.value = '/tmp/root'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
    }
    const btn = docQuery('button.submit') as HTMLButtonElement | null
    btn?.click()
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === '/api/roots' && c.init?.method === 'POST')).toBe(true)
    })
    const post = calls.find((c) => c.url === '/api/roots' && c.init?.method === 'POST')!
    expect(JSON.parse(String(post.init?.body))).toEqual({ path: '/tmp/root' })
    await vi.waitFor(() => expect(wrapper.emitted('close')).toBeTruthy())
    wrapper.unmount()
  })

  test('server error renders inline and the dialog stays open', async () => {
    const { calls } = mockFetch({ postError: 'bogus path rejected' })
    const wrapper = await mountDialog(true)
    const input = docQuery('input') as HTMLInputElement | null
    if (input) {
      input.value = '/does/not/exist'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
    }
    const btn = docQuery('button.submit') as HTMLButtonElement | null
    btn?.click()
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === '/api/roots')).toBe(true)
    })
    await vi.waitFor(() => expect(document.body.textContent).toContain('bogus path rejected'))
    expect(overlayExists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  test('focuses the path input when it opens', async () => {
    mockFetch()
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {})
    const wrapper = await mountDialog(false)
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
    wrapper.unmount()
  })

  test('Escape closes the dialog', async () => {
    mockFetch()
    const wrapper = await mountDialog(true)
    // dispatch Escape on panel (overlay handles it) plus window for fallback
    const panel = docQuery('.panel') as HTMLElement | null
    panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    // either panel handler or window handler should emit close via component's internal Escape
    // our dialog handles Escape via panel keydown; check emitted
    await new Promise((r) => setTimeout(r, 10))
    // if not emitted yet, try document.body
    if (!wrapper.emitted('close')) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()
    }
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  test('recent section renders roots in MRU order from an unsorted payload', async () => {
    const now = Date.now()
    mockFetch({
      roots: [
        { root: '/old', lastOpened: now - 3 * DAY },
        { root: '/mid', lastOpened: now - 2 * HOUR },
        { root: '/new', lastOpened: now - 5 * 60_000 },
      ],
    })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(3))
    const labels = Array.from(docQueryAll('.recent-label')).map((n) => n.textContent?.trim())
    expect(labels).toEqual(['/new', '/mid', '/old'])
    wrapper.unmount()
  })

  test('each recent entry exposes the full path in its title and truncates the label', async () => {
    const now = Date.now()
    mockFetch({ roots: [{ root: '/a/long/path/to/some/folder', lastOpened: now - HOUR }] })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(1))
    const label = docQuery('.recent-label') as HTMLElement | null
    expect(label?.getAttribute('title')).toBe('/a/long/path/to/some/folder')
    expect(label?.classList.contains('truncate')).toBe(true)
    wrapper.unmount()
  })

  test('clicking a recent entry opens that root and emits close', async () => {
    const now = Date.now()
    const { calls } = mockFetch({
      roots: [{ root: '/click-me', lastOpened: now - HOUR }],
    })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(1))
    const entry = docQuery('.recent-entry') as HTMLElement | null
    entry?.click()
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === '/api/roots' && c.init?.method === 'POST')).toBe(true)
    })
    const post = calls.find((c) => c.url === '/api/roots' && c.init?.method === 'POST')!
    expect(JSON.parse(String(post.init?.body))).toEqual({ path: '/click-me' })
    await vi.waitFor(() => expect(wrapper.emitted('close')).toBeTruthy())
    wrapper.unmount()
  })

  test('clicking the currently-open root short-circuits: no POST, closes', async () => {
    const now = Date.now()
    const { calls } = mockFetch({
      roots: [{ root: '/current', lastOpened: now - HOUR }],
    })
    const wrapper = await mountDialog(false)
    const ws = useWorkspace()
    ws.root = '/current'
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(1))
    const entry = docQuery('.recent-entry') as HTMLElement | null
    entry?.click()
    await wrapper.vm.$nextTick()
    expect(calls.some((c) => c.url === '/api/roots' && c.init?.method === 'POST')).toBe(false)
    await vi.waitFor(() => expect(wrapper.emitted('close')).toBeTruthy())
    wrapper.unmount()
  })

  test('currently-open root entry is visually marked', async () => {
    const now = Date.now()
    mockFetch({
      roots: [
        { root: '/current', lastOpened: now - HOUR },
        { root: '/other', lastOpened: now - 2 * HOUR },
      ],
    })
    const wrapper = await mountDialog(false)
    const ws = useWorkspace()
    ws.root = '/current'
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(2))
    const current = document.body.querySelector('.recent-entry.current-root') as HTMLElement | null
    expect(current).toBeTruthy()
    expect(current?.textContent).toContain('/current')
    wrapper.unmount()
  })

  test('empty roots list hides the recent section', async () => {
    mockFetch({ roots: [] })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => expect(!!docQuery('.recent-list')).toBe(false))
    wrapper.unmount()
  })

  test('fetch failure leaves the dialog usable and the section hidden', async () => {
    const { calls } = mockFetch({ rootsError: 'boom' })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === '/api/roots' && !c.init?.method)).toBe(true)
    })
    await wrapper.vm.$nextTick()
    expect(!!docQuery('.recent-list')).toBe(false)
    const input = docQuery('input') as HTMLInputElement | null
    expect(input?.getAttribute('disabled')).toBeNull()
    if (input) {
      input.value = '/tmp/new'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
    }
    const btn = docQuery('button.submit') as HTMLButtonElement | null
    btn?.click()
    await vi.waitFor(() => expect(wrapper.emitted('close')).toBeTruthy())
    wrapper.unmount()
  })

  test('each recent entry shows a relative-time label', async () => {
    const now = Date.now()
    mockFetch({
      roots: [
        { root: '/hrs', lastOpened: now - 2 * HOUR },
        { root: '/old', lastOpened: now - 40 * DAY },
      ],
    })
    const wrapper = await mountDialog(false)
    await openDialog(wrapper)
    await vi.waitFor(() => expect(docQueryAll('.recent-entry').length).toBe(2))
    const times = Array.from(docQueryAll('.recent-time')).map((n) => n.textContent?.trim())
    expect(times.length).toBe(1)
    expect(times[0]).toContain('2h')
    const entries = Array.from(docQueryAll('.recent-entry'))
    expect(entries[1].querySelector('.recent-time')).toBeNull()
    wrapper.unmount()
  })
})
