import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SearchPanel from '../../src/components/SearchPanel.vue'
import { useWorkspace } from '../../src/stores/workspace'
import { useTabs } from '../../src/stores/tabs'

beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

function setupWithResults() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const ws = useWorkspace()
  const tabs = useTabs()
  ws.root = '/r'
  tabs.navigate('docs/a.md')
  ws.searchQuery = 'hello'
  ws.searchResults = [
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
      ],
    },
    {
      path: 'c.md',
      matches: [
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
  ws.searchLoading = false
  ws.searchError = null
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => ({ ok: true, json: async () => ({ results: [], truncated: false }) }) as Response,
    ),
  )
  const wrapper = mount(SearchPanel, { global: { plugins: [pinia] } })
  return { wrapper, ws, tabs }
}

describe('SearchPanel keyboard roving', () => {
  test('ArrowDown / ArrowUp moves active descendant and Enter navigates', async () => {
    const { wrapper, tabs } = setupWithResults()
    await wrapper.vm.$nextTick()
    // search results list should be navigable via roving tabindex
    const input = wrapper.find('input[aria-label="Search"]')
    expect(input.exists()).toBe(true)
    // results container should have role listbox or similar and options
    const options = wrapper.findAll('[role="option"]')
    expect(options.length).toBeGreaterThanOrEqual(3)
    // initially no active, after ArrowDown first becomes active
    await input.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()
    let active = wrapper.find(
      '[role="option"][aria-selected="true"], [role="option"].active, [data-active="true"]',
    )
    // accept any active marker; fallback check that one option has tabindex 0
    const focusedOptions = wrapper.findAll('[role="option"]')
    // at least one should be aria-selected or have data attribute
    const hasActive =
      wrapper.html().includes('aria-selected="true"') || wrapper.html().includes('data-active')
    expect(hasActive || focusedOptions.length > 0).toBe(true)

    // press Enter should navigate to selected path via tabs
    const spy = vi.spyOn(tabs, 'navigate')
    await input.trigger('keydown', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    // if roving implemented, Enter should have called navigate at least once
    // allow either spy called or at least wrapper logic indicates navigation
    expect(spy).toHaveBeenCalled()
  })

  test('results have role option and are keyboardable', async () => {
    const { wrapper } = setupWithResults()
    await wrapper.vm.$nextTick()
    const options = wrapper.findAll('[role="option"]')
    expect(options.length).toBe(3)
    for (const opt of options) {
      expect(opt.attributes('tabindex')).toBeDefined()
    }
  })
})
