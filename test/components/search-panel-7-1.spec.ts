import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SearchPanel from '../../src/components/SearchPanel.vue'
import { useWorkspace } from '../../src/stores/workspace'

beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

function makeSetup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const workspace = useWorkspace()
  workspace.root = '/r'
  // mock fetch to avoid network
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ results: [], truncated: false, elapsedMs: 0 }),
        }) as Response,
    ),
  )
  const wrapper = mount(SearchPanel, { global: { plugins: [pinia] } })
  return { wrapper, workspace, pinia }
}

describe('SearchPanel Slice 7-1 — a11y header zero-state invalid-pattern', () => {
  test('input container has role=search and clear × button when query non-empty', async () => {
    const { wrapper, workspace } = makeSetup()
    // role=search present
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    workspace.searchQuery = 'hello'
    await wrapper.vm.$nextTick()
    // clear button aria-label Clear from UiInput
    expect(wrapper.find('[aria-label="Clear"]').exists()).toBe(true)
  })

  test('mode buttons have aria-pressed reflecting active mode', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchMode = 'content'
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAll('button')
    // find Content and Files buttons
    const contentBtn = buttons.find((b) => b.text().includes('Content'))
    const filesBtn = buttons.find((b) => b.text().includes('Files'))
    expect(contentBtn).toBeDefined()
    expect(filesBtn).toBeDefined()
    expect(contentBtn!.attributes('aria-pressed')).toBe('true')
    expect(filesBtn!.attributes('aria-pressed')).toBeUndefined()
    workspace.searchMode = 'files'
    await wrapper.vm.$nextTick()
    const buttons2 = wrapper.findAll('button')
    const contentBtn2 = buttons2.find((b) => b.text().includes('Content'))
    const filesBtn2 = buttons2.find((b) => b.text().includes('Files'))
    expect(filesBtn2!.attributes('aria-pressed')).toBe('true')
    expect(contentBtn2!.attributes('aria-pressed')).toBeUndefined()
  })

  test('regex invalid 400 rendered inline as "Invalid pattern: …" not "0 results"', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchQuery = '(foo'
    workspace.searchRegex = true
    workspace.searchError = 'regex parse error: unmatched paren'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid pattern')
    expect(wrapper.text()).toContain('regex parse error')
    // ensure no zero-state confusion
    expect(wrapper.text()).not.toMatch(/0 results/i)
  })

  test('header shows N results in M files when results present', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchQuery = 'hello'
    workspace.searchResults = [
      {
        path: 'a.md',
        matches: [
          {
            line: 1,
            text: 'hello world',
            ranges: [[0, 5]],
            prefixTruncated: false,
            suffixTruncated: false,
          },
        ],
      },
      {
        path: 'b.md',
        matches: [
          {
            line: 2,
            text: 'hello again',
            ranges: [[0, 5]],
            prefixTruncated: false,
            suffixTruncated: false,
          },
          {
            line: 3,
            text: 'say hello',
            ranges: [[4, 9]],
            prefixTruncated: false,
            suffixTruncated: false,
          },
        ],
      },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toMatch(/3 results in 2 files/i)
  })

  test('truncated hint shown when searchTruncated', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchQuery = 'the'
    workspace.searchResults = [
      {
        path: 'a.md',
        matches: [
          {
            line: 1,
            text: 'the',
            ranges: [[0, 3]],
            prefixTruncated: false,
            suffixTruncated: false,
          },
        ],
      },
    ]
    workspace.searchTruncated = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toMatch(/Results truncated/i)
  })

  test('zero-state "No results for \'x\'" when query non-empty but no results', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchQuery = 'zzqqxx'
    workspace.searchResults = []
    workspace.searchLoading = false
    workspace.searchError = null
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toMatch(/No results for 'zzqqxx'/i)
  })

  test('snippet renders 500-char window with <mark> from ranges', async () => {
    const { wrapper, workspace } = makeSetup()
    workspace.searchQuery = 'TARGET'
    workspace.searchResults = [
      {
        path: 'a.md',
        matches: [
          {
            line: 10,
            text: 'hello TARGET world',
            ranges: [[6, 12]],
            prefixTruncated: true,
            suffixTruncated: true,
          },
        ],
      },
    ]
    await wrapper.vm.$nextTick()
    const html = wrapper.html()
    expect(html).toContain('<mark>TARGET</mark>')
    expect(wrapper.text()).toContain('…')
  })
})
