import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import Toc from '../../src/components/Toc.vue'
import { useWorkspace } from '../../src/stores/workspace'

enableAutoUnmount(afterEach)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountToc() {
  return mount(Toc, { global: { plugins: [pinia] } })
}

describe('Toc', () => {
  test('renders a link per heading, indented by heading level', () => {
    const workspace = useWorkspace()
    workspace.currentHeadings = [
      { level: 1, slug: 'a', text: 'A' },
      { level: 2, slug: 'b', text: 'B' },
      { level: 3, slug: 'c', text: 'C' },
    ]
    const wrapper = mountToc()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
    expect(links[0].text()).toBe('A')
    expect(links[0].attributes('style')).toContain('padding-left: 0px')
    expect(links[1].attributes('style')).toContain('padding-left: 12px')
    expect(links[2].attributes('style')).toContain('padding-left: 24px')
  })

  test('marks only the active heading with the active class', async () => {
    const workspace = useWorkspace()
    workspace.currentHeadings = [
      { level: 1, slug: 'a', text: 'A' },
      { level: 2, slug: 'b', text: 'B' },
      { level: 3, slug: 'c', text: 'C' },
    ]
    const wrapper = mountToc()
    const links = wrapper.findAll('a')
    expect(links[0].classes()).not.toContain('mdr-toc-link--active')
    await links[1].trigger('click')
    const after = wrapper.findAll('a')
    expect(after[1].classes()).toContain('mdr-toc-link--active')
    expect(after[0].classes()).not.toContain('mdr-toc-link--active')
    expect(after[2].classes()).not.toContain('mdr-toc-link--active')
  })
})
