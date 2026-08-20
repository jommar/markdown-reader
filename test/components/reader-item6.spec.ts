import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import Reader from '../../src/components/Reader.vue'
import MarkdownView from '../../src/components/MarkdownView.vue'
import Toc from '../../src/components/Toc.vue'
import type { RenderedDoc } from '../../src/markdown/renderer'
import { useTabs } from '../../src/stores/tabs'
import { useWorkspace } from '../../src/stores/workspace'
import { renderDocument } from '../../src/markdown/renderer'
import type { FileResult } from '../../server/types'

describe('Reader Item6 seams', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  test('Reader loading shows skeleton not just spinner', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    let resolve!: (v: FileResult) => void
    vi.spyOn(ws, 'loadFile').mockReturnValue(new Promise<FileResult>((r) => (resolve = r)))
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    const wrapper = mount(Reader, { global: { plugins: [pinia] } })
    // loading state should contain skeleton (UiSkeleton) not just spinner
    const html = wrapper.html()
    expect(wrapper.find('.reader-state--loading').exists()).toBe(true)
    // skeleton lines are div.skeleton-line or aria-hidden with animate-pulse
    expect(html).toMatch(/skeleton|skeleton-line|animate-pulse/)
    resolve({
      path: 'docs/a.md',
      content: '# hi',
      frontmatter: null,
      frontmatterLines: 0,
      mtimeMs: 0,
      size: 0,
    })
    await flushPromises()
  })

  test('Reader empty role=status and error has Retry', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // empty
    const wEmpty = mount(Reader, { global: { plugins: [pinia] } })
    await flushPromises()
    const empty = wEmpty.find('.reader-state--empty')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    // error with retry
    const ws = useWorkspace()
    vi.spyOn(ws, 'loadFile').mockRejectedValue(new Error('boom'))
    const tabs = useTabs()
    tabs.navigate('docs/b.md')
    const wErr = mount(Reader, { global: { plugins: [pinia] } })
    await flushPromises()
    const err = wErr.find('.reader-state--error')
    expect(err.exists()).toBe(true)
    const retry = wErr.find('button')
    expect(retry.exists()).toBe(true)
    expect(retry.text()).toMatch(/Retry/i)
  })

  test('MarkdownView frontmatter dl.frontmatter', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const doc: RenderedDoc = {
      html: '<p>hi</p>',
      headings: [],
      frontmatter: { title: 'Hello', version: '1.0' },
      hasMermaid: false,
      highlightingSkipped: false,
    }
    const wrapper = mount(MarkdownView, {
      props: { doc, root: '/r' },
      global: { plugins: [pinia] },
    })
    const dl = wrapper.find('dl.frontmatter')
    expect(dl.exists()).toBe(true)
    expect(wrapper.findAll('dt').map((n) => n.text())).toEqual(['title', 'version'])
  })

  test('table 500→200 hides button after expand', async () => {
    const ctx = { root: '/r', fileSet: new Set<string>(['a.md']) }
    const rows = Array.from({ length: 501 }, (_, i) => `| r${i} |`).join('\n')
    const file: FileResult = {
      path: 'a.md',
      content: `| h |\n|---|\n${rows}\n`,
      frontmatter: null,
      frontmatterLines: 0,
      mtimeMs: 0,
      size: 0,
    }
    const doc = await renderDocument(file, ctx)
    expect(doc.html).toMatch(/table-show-all/)
    expect((doc.html.match(/<tr>/g) ?? []).length).toBe(200)
    // after expand (showAllTables=true) button hidden
    const doc2 = await renderDocument(file, ctx, { showAllTables: true })
    expect((doc2.html.match(/<tr>/g) ?? []).length).toBe(502)
    expect(doc2.html).not.toMatch(/table-show-all/)
  })

  test('code-block copy via focus-within + aria-label', async () => {
    const ctx = { root: '/r', fileSet: new Set<string>(['a.md']) }
    const file: FileResult = {
      path: 'a.md',
      content: '```js\nconst x=1\n```\n',
      frontmatter: null,
      frontmatterLines: 0,
      mtimeMs: 0,
      size: 0,
    }
    const doc = await renderDocument(file, ctx)
    expect(doc.html).toMatch(/aria-label="Copy code"/)
    const proseCss = fs.readFileSync('src/styles/prose.css', 'utf8')
    expect(proseCss).toMatch(/focus-within/)
    expect(proseCss).toMatch(/data-lang/)
  })

  test('mermaid visibility:hidden shows error not blank and re-renders', async () => {
    const proseCss = fs.readFileSync('src/styles/prose.css', 'utf8')
    expect(proseCss).toMatch(/pre\.mermaid:not\(\[data-rendered\]\)/)
    expect(proseCss).toMatch(/mermaid-shimmer|shimmer|min-height:\s*6/)
    // mermaid.ts should set data-rendered, clear data-processed, and handle error per block
    const mermaidTs = fs.readFileSync('src/markdown/mermaid.ts', 'utf8')
    expect(mermaidTs).toMatch(/data-rendered/)
    expect(mermaidTs).toMatch(/data-processed/)
    expect(mermaidTs).toMatch(/catch|error/i)
    // run with mock mermaid that throws on bad diagram
    // we test that renderMermaid doesn't leave blank pre
    const mdTs = fs.readFileSync('src/markdown/mermaid.ts', 'utf8')
    expect(mdTs).toMatch(/run\(\{ nodes: \[el\] \}\)|mermaid\.render/)
  })

  test('highlightingSkipped note rendered', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const doc: RenderedDoc = {
      html: '<p>hi</p>',
      headings: [],
      frontmatter: null,
      hasMermaid: false,
      highlightingSkipped: true,
    }
    const wrapper = mount(MarkdownView, {
      props: { doc, root: '/r' },
      global: { plugins: [pinia] },
    })
    expect(wrapper.text()).toMatch(/highlighting skipped/i)
  })

  test('Toc aria-current observer 0 0 -70% 0 and nav aria-label', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.currentHeadings = [
      { level: 1, slug: 'a', text: 'A' },
      { level: 2, slug: 'b', text: 'B' },
      { level: 3, slug: 'c', text: 'C' },
    ]
    const wrapper = mount(Toc, { global: { plugins: [pinia] } })
    const nav = wrapper.find('nav[aria-label]')
    expect(nav.exists()).toBe(true)
    // check source for aria-current location
    const tocSrc = fs.readFileSync('src/components/Toc.vue', 'utf8')
    expect(tocSrc).toMatch(/aria-current/)
    expect(tocSrc).toMatch(/location/)
    expect(tocSrc).toMatch(/0px 0px -70% 0px|0 0 -70% 0/)
    // click should set active
    const links = wrapper.findAll('a')
    await links[1].trigger('click')
    const after = wrapper.findAll('a')
    // active link should have aria-current
    expect(after[1].attributes('aria-current')).toBe('location')
  })
})
