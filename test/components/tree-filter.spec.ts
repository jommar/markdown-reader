import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import TreeFilter from '../../src/components/TreeFilter.vue'
import type { TreeNode } from '../../server/types'
import { useTabs } from '../../src/stores/tabs'
import { useWorkspace } from '../../src/stores/workspace'
import { useHistory } from '../../src/stores/history'

enableAutoUnmount(afterEach)

let pinia: Pinia

const TREE: TreeNode[] = [
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

beforeEach(() => {
  pinia = createPinia()
})

async function mountWithTree(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
  const workspace = useWorkspace()
  workspace.tree = TREE
  await wrapper.vm.$nextTick()
  return wrapper
}

function filterInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.filter-input input')
}

function dirButton(wrapper: ReturnType<typeof mount>, name: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(name))!
}

describe('TreeFilter', () => {
  test('clears the filter query when the workspace root changes', async () => {
    const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
    const input = wrapper.find('input')
    await input.setValue('docs')
    expect((input.element as HTMLInputElement).value).toBe('docs')
    const workspace = useWorkspace()
    workspace.root = '/new/root'
    await wrapper.vm.$nextTick()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
  })

  test('keeps the query when the root is unchanged', async () => {
    const wrapper = mount(TreeFilter, { global: { plugins: [pinia] } })
    const input = wrapper.find('input')
    await input.setValue('docs')
    await wrapper.vm.$nextTick()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('docs')
  })

  test('renders the top level of the tree with directories collapsed', async () => {
    const wrapper = await mountWithTree()
    expect(wrapper.text()).toContain('docs')
    expect(wrapper.text()).toContain('top.md')
    expect(wrapper.text()).not.toContain('alpha.md')
    expect(wrapper.text()).not.toContain('beta.md')
  })

  test('clicking a directory expands its children', async () => {
    const wrapper = await mountWithTree()
    await dirButton(wrapper, 'docs').trigger('click')
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).toContain('beta.md')
  })

  test('filtering keeps only subsequence-matching files and auto-expands their dirs', async () => {
    const wrapper = await mountWithTree()
    await filterInput(wrapper).setValue('alpha')
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).not.toContain('beta.md')
    expect(wrapper.text()).not.toContain('top.md')
  })

  test('matched characters are highlighted with mark elements', async () => {
    const wrapper = await mountWithTree()
    await filterInput(wrapper).setValue('alpha')
    expect(wrapper.findAll('mark')).toHaveLength(5)
  })

  test('clearing the filter restores the full tree and prior expansion state', async () => {
    const wrapper = await mountWithTree()
    await dirButton(wrapper, 'docs').trigger('click')
    await filterInput(wrapper).setValue('alpha')
    expect(wrapper.text()).not.toContain('beta.md')
    await filterInput(wrapper).setValue('')
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).toContain('beta.md')
    expect(wrapper.text()).toContain('top.md')
  })

  test('clicking a file navigates the tabs store to that path', async () => {
    const wrapper = await mountWithTree()
    await dirButton(wrapper, 'docs').trigger('click')
    const tabs = useTabs()
    expect(tabs.currentEntry).toBeNull()
    await wrapper.find('div[title="docs/alpha.md"]').trigger('click')
    expect(tabs.currentEntry?.path).toBe('docs/alpha.md')
  })

  test('directories show a badge with their total file count', async () => {
    const wrapper = await mountWithTree()
    const badge = dirButton(wrapper, 'docs').find('span.rounded-full')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
    expect(badge.attributes('title')).toBe('2 files')
  })

  test('the currently open file row is highlighted', async () => {
    const wrapper = await mountWithTree()
    const tabs = useTabs()
    tabs.navigate('docs/alpha.md')
    await wrapper.vm.$nextTick()
    const row = wrapper.find('div[title="docs/alpha.md"]')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('file-row--active')
    expect(wrapper.find('div[title="top.md"]').classes()).not.toContain('file-row--active')
  })

  test('a pinned file shows a filled pin and can be unpinned without navigating', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    const history = useHistory()
    history.pinInRoot('/r', 'docs/alpha.md')
    await wrapper.vm.$nextTick()
    await dirButton(wrapper, 'docs').trigger('click')
    const row = wrapper.find('div[title="docs/alpha.md"]')
    const pinBtn = row.find('button[title="Unpin"]')
    expect(pinBtn.exists()).toBe(true)
    const tabs = useTabs()
    expect(tabs.currentEntry).toBeNull()
    await pinBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(history.isPinned('/r', 'docs/alpha.md')).toBe(false)
    expect(tabs.currentEntry).toBeNull()
  })

  test('an unpinned file row exposes a pin button that pins it without navigating', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    const history = useHistory()
    await dirButton(wrapper, 'docs').trigger('click')
    const row = wrapper.find('div[title="docs/alpha.md"]')
    const pinBtn = row.find('button[title="Pin"]')
    expect(pinBtn.exists()).toBe(true)
    const tabs = useTabs()
    await pinBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(history.isPinned('/r', 'docs/alpha.md')).toBe(true)
    expect(tabs.currentEntry).toBeNull()
  })

  test('Pinned filter shows only pinned files, expanding their dirs', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    const history = useHistory()
    history.pinInRoot('/r', 'docs/alpha.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title="Show only pinned files"]').trigger('click')
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).not.toContain('beta.md')
    expect(wrapper.text()).not.toContain('top.md')
  })

  test('Pinned filter shows the empty state when nothing is pinned', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title="Show only pinned files"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No pinned files in this folder.')
  })

  test('Pinned filter composes with the text filter', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    const history = useHistory()
    history.pinInRoot('/r', 'docs/alpha.md')
    history.pinInRoot('/r', 'top.md')
    await wrapper.vm.$nextTick()
    await wrapper.find('button[title="Show only pinned files"]').trigger('click')
    await filterInput(wrapper).setValue('alpha')
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).not.toContain('top.md')
  })

  test('Pinned filter toggles off to restore the full tree', async () => {
    const wrapper = await mountWithTree()
    const workspace = useWorkspace()
    workspace.root = '/r'
    const history = useHistory()
    history.pinInRoot('/r', 'docs/alpha.md')
    await wrapper.vm.$nextTick()
    const toggle = wrapper.find('button[title="Show only pinned files"]')
    await toggle.trigger('click')
    expect(wrapper.text()).not.toContain('top.md')
    await wrapper.find('button[title="Show all files"]').trigger('click')
    expect(wrapper.text()).toContain('top.md')
    expect(wrapper.text()).toContain('docs')
  })
})
