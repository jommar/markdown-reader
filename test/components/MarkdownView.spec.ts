import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import MarkdownView from '../../src/components/MarkdownView.vue'
import type { RenderedDoc } from '../../src/markdown/renderer'

enableAutoUnmount(afterEach)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function makeDoc(overrides: Partial<RenderedDoc> = {}): RenderedDoc {
  return {
    html: '<p>hi</p>',
    headings: [],
    frontmatter: { title: 'Hello', author: 'Jane' },
    hasMermaid: false,
    highlightingSkipped: false,
    ...overrides,
  }
}

function mountView(doc: RenderedDoc) {
  return mount(MarkdownView, { props: { doc, root: '/r' }, global: { plugins: [pinia] } })
}

describe('MarkdownView frontmatter', () => {
  test('renders frontmatter as a key/value list with title emphasis on keys', () => {
    const wrapper = mountView(makeDoc())
    const dl = wrapper.find('dl.frontmatter')
    expect(dl.exists()).toBe(true)
    const keys = wrapper.findAll('.mdr-fm-key')
    expect(keys.map((k) => k.text())).toEqual(['title', 'author'])
    const values = wrapper.findAll('.mdr-fm-val')
    expect(values.map((v) => v.text())).toEqual(['Hello', 'Jane'])
  })

  test('renders no frontmatter box when the doc has none', () => {
    const wrapper = mountView(makeDoc({ frontmatter: null }))
    expect(wrapper.find('dl.frontmatter').exists()).toBe(false)
  })
})
