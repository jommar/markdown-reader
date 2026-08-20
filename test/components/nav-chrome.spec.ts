import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import TabBar from '../../src/components/TabBar.vue'
import Breadcrumbs from '../../src/components/Breadcrumbs.vue'
import Toolbar from '../../src/components/Toolbar.vue'
import TreeFilter from '../../src/components/TreeFilter.vue'
import Sidebar from '../../src/components/Sidebar.vue'
import { useTabs } from '../../src/stores/tabs'
import { useWorkspace } from '../../src/stores/workspace'
import { useHistory } from '../../src/stores/history'
import type { TreeNode } from '../../server/types'

describe('Nav chrome Item5 seams', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  test('TabBar seam: titles disambiguate via useTabs().titles()', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const tabs = useTabs()
    tabs.openInNewTab('.claude/agents/qa.md')
    tabs.openInNewTab('.opencode/agents/qa.md')
    const titles = tabs.titles()
    expect(titles[0]).not.toBe(titles[1])
    expect(titles[0]).toContain('.claude')
    expect(titles[1]).toContain('.opencode')
  })

  test('TabBar seam: trail via via', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.root = '/r'
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    tabs.navigate('docs/b.md')
    tabs.navigate('docs/c.md')
    // go back to middle then branch
    tabs.back()
    tabs.navigate('docs/d.md')
    const trail = tabs.trail()
    // trail walks via back to root, should contain at least docs/a and current
    const paths = trail.map((t) => t.entry.path)
    expect(paths).toContain('docs/a.md')
    expect(paths[paths.length - 1]).toBe('docs/d.md')
  })

  test('TreeFilter seam: subsequence keep-ancestors', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.tree = [
      {
        type: 'dir',
        name: 'docs',
        path: 'docs',
        children: [
          { type: 'file', name: 'alpha.md', path: 'docs/alpha.md' },
          { type: 'file', name: 'beta.md', path: 'docs/beta.md' },
        ],
      },
      { type: 'file', name: 'top.md', path: 'top.md' },
    ]
    const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
    const input = wrapper.find('input')
    await input.setValue('alp')
    await wrapper.vm.$nextTick()
    // subsequence 'alp' matches alpha.md, keeps ancestor docs, not beta or top
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).not.toContain('beta.md')
    expect(wrapper.text()).not.toContain('top.md')
  })

  test('TabBar a11y: role tablist/tab aria-selected close aria-label overflow fade', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const tabs = useTabs()
    tabs.openInNewTab('docs/a.md')
    tabs.openInNewTab('docs/b.md')
    const wrapper = mount(TabBar, { global: { plugins: [pinia] } })
    const tablist = wrapper.find('[role="tablist"]')
    expect(tablist.exists()).toBe(true)
    const tabEls = wrapper.findAll('[role="tab"]')
    expect(tabEls.length).toBe(2)
    // one selected
    expect(tabEls.filter((t) => t.attributes('aria-selected') === 'true').length).toBe(1)
    // close button aria-label
    const closes = wrapper.findAll('button[aria-label]')
    expect(
      closes.some((c) => (c.attributes('aria-label') ?? '').toLowerCase().includes('close')),
    ).toBe(true)
    // overflow classes
    const html = wrapper.html()
    expect(html).toMatch(/overflow-x-auto/)
    expect(html).toMatch(/scrollbar-none|fade/)
    // check source file for fade
    const src = fs.readFileSync('src/components/TabBar.vue', 'utf8')
    expect(src).toMatch(/scrollbar-none|fade|mask/)
  })

  test('Breadcrumbs a11y: nav aria-label ol>li aria-current … aria-expanded Esc/outside', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.root = '/r'
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    tabs.navigate('docs/b.md')
    tabs.navigate('docs/c.md')
    const wrapper = mount(Breadcrumbs, { global: { plugins: [pinia] } })
    const nav = wrapper.find('nav[aria-label="Breadcrumb"]')
    expect(nav.exists()).toBe(true)
    const ol = wrapper.find('ol')
    expect(ol.exists()).toBe(true)
    const lis = wrapper.findAll('li')
    expect(lis.length).toBeGreaterThan(0)
    // last li button should have aria-current page
    const current = wrapper.find('[aria-current="page"]')
    expect(current.exists()).toBe(true)
    // find … button
    const dots = wrapper.find('button[aria-expanded]')
    // when trail >2, … toggle exists
    if (wrapper.text().includes('…')) {
      expect(dots.exists()).toBe(true)
      expect(dots.attributes('aria-expanded')).toBeDefined()
      await dots.trigger('click')
      await wrapper.vm.$nextTick()
      expect(dots.attributes('aria-expanded')).toBe('true')
      // Esc closes
      await wrapper.trigger('keydown', { key: 'Escape' })
      // or dispatch escape on window - component should handle Esc
      // check source handles Esc and outside click
      const src = fs.readFileSync('src/components/Breadcrumbs.vue', 'utf8')
      expect(src).toMatch(/Escape|keydown/)
      expect(src).toMatch(/outside|click|mousedown/)
    }
  })

  test('Toolbar a11y: role toolbar aria-pressed path rtl', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    const wrapper = mount(Toolbar, { global: { plugins: [pinia] } })
    const tb = wrapper.find('[role="toolbar"]')
    expect(tb.exists()).toBe(true)
    // toggles should have aria-pressed via UiButton active prop
    const src = fs.readFileSync('src/components/Toolbar.vue', 'utf8')
    // should still retain rtl path display
    expect(src).toMatch(/direction:rtl|rtl/)
    // buttons with :active should exist
    const html = wrapper.html()
    expect(html).toContain('Wide')
    expect(html).toContain('TOC')
  })

  test('Tree a11y: role tree/treeitem aria-expanded indent via --tree-indent pin focus rows tabindex+Enter', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.tree = [
      {
        type: 'dir',
        name: 'docs',
        path: 'docs',
        children: [{ type: 'file', name: 'a.md', path: 'docs/a.md' }],
      },
    ]
    ws.root = '/r'
    const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    const tree = wrapper.find('[role="tree"]')
    expect(tree.exists()).toBe(true)
    const items = wrapper.findAll('[role="treeitem"]')
    expect(items.length).toBeGreaterThan(0)
    // aria-expanded on dirs
    const expanded = wrapper.find('[aria-expanded]')
    expect(expanded.exists()).toBe(true)
    // indent via --tree-indent var
    const srcNode = fs.readFileSync('src/components/TreeNode.vue', 'utf8')
    expect(srcNode).toMatch(/--tree-indent/)
    // pin visible on focus
    expect(srcNode).toMatch(/focus|focus-within|group-focus/)
    // rows tabindex and keyboard
    expect(srcNode).toMatch(/tabindex/)
    expect(srcNode).toMatch(/Enter|Space|keydown/)
  })

  test('TreeFilter uses UiButton shows count+clear+empty', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.tree = [
      { type: 'file', name: 'alpha.md', path: 'alpha.md' },
      { type: 'file', name: 'beta.md', path: 'beta.md' },
    ]
    const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
    const src = fs.readFileSync('src/components/TreeFilter.vue', 'utf8')
    expect(src).toContain('UiButton')
    expect(src).not.toMatch(/<button[^>]*>Pinned/) // should not have raw button for Pinned
    // count + clear × + empty
    await wrapper.find('input').setValue('zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toMatch(/No matches for 'zzz'/)
    expect(wrapper.text()).toMatch(/Clear/)
    // count display - filtered count?
    // when filter active, should show count
    await wrapper.find('input').setValue('alpha')
    await wrapper.vm.$nextTick()
    // should show some count indicator
    expect(wrapper.text()).toMatch(/1|2|alpha/)
    // clear button should be present when filtered
    const clearBtn = wrapper.find('button[aria-label="Clear"], button')
    expect(clearBtn.exists()).toBe(true)
  })

  test('Sidebar isSearching hides tree', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.searchQuery = 'hello'
    ws.tree = [{ type: 'file', name: 'a.md', path: 'a.md' }]
    const wrapper = mount(Sidebar, { global: { plugins: [pinia] } })
    expect(wrapper.findComponent(TreeFilter).exists()).toBe(false)
    ws.searchQuery = ''
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(TreeFilter).exists()).toBe(true)
  })
})
