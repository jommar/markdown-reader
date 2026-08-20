import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import Reader from '../../src/components/Reader.vue'
import { useTabs } from '../../src/stores/tabs'
import { useWorkspace } from '../../src/stores/workspace'
import type { FileResult } from '../../server/types'

enableAutoUnmount(afterEach)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mountReader() {
  return mount(Reader, { global: { plugins: [pinia] } })
}

function withEntry(path = 'docs/a.md') {
  const tabs = useTabs()
  tabs.navigate(path)
}

describe('Reader', () => {
  test('shows a polished empty state when no file is selected', async () => {
    const wrapper = mountReader()
    await flushPromises()
    const state = wrapper.find('.reader-state--empty')
    expect(state.exists()).toBe(true)
    expect(state.text()).toContain('Pick a file to start reading.')
  })

  test('shows a loading state during load and clears it once the document resolves', async () => {
    const workspace = useWorkspace()
    let resolve!: (v: FileResult) => void
    vi.spyOn(workspace, 'loadFile').mockReturnValue(new Promise<FileResult>((r) => (resolve = r)))
    withEntry()
    const wrapper = mountReader()
    const loading = wrapper.find('.reader-state--loading')
    expect(loading.exists()).toBe(true)
    expect(loading.text()).toContain('Loading')
    resolve({
      path: 'docs/a.md',
      content: '# Hi',
      mtimeMs: 0,
      size: 0,
      frontmatter: null,
      frontmatterLines: 0,
    })
    await vi.waitFor(() => {
      expect(wrapper.find('.reader-state--loading').exists()).toBe(false)
    })
  })

  test('shows an error state when loading fails', async () => {
    const workspace = useWorkspace()
    vi.spyOn(workspace, 'loadFile').mockRejectedValue(new Error('boom'))
    withEntry()
    const wrapper = mountReader()
    await flushPromises()
    const state = wrapper.find('.reader-state--error')
    expect(state.exists()).toBe(true)
    expect(state.text()).toContain('boom')
  })
})
