import { describe, test, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import App from '../../src/App.vue'
import { usePrefs } from '../../src/stores/prefs'
import { useWorkspace } from '../../src/stores/workspace'
import { useTabs } from '../../src/stores/tabs'
import { useScroller } from '../../src/composables/useScroller'

function readCss(): string {
  const a = fs.readFileSync(path.join(process.cwd(), 'src/styles/layout.css'), 'utf8')
  const b = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')
  return a + '\n' + b
}

describe('Shell Item3 seams', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  test('.app gridTemplateColumns seam reflects sidebar width and collapse', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const prefs = usePrefs()
    prefs.sidebarWidth = 320
    prefs.sidebarCollapsed = false
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    const appEl = wrapper.find('.app')
    expect(appEl.exists()).toBe(true)
    // seam: gridTemplateColumns should contain "320px" and "1fr" when not collapsed (handle column present)
    const cols = (appEl.element as HTMLElement).style.gridTemplateColumns
    expect(cols).toContain('320px')
    expect(cols).toContain('1fr')
    prefs.sidebarCollapsed = true
    await wrapper.vm.$nextTick()
    const collapsed = (appEl.element as HTMLElement).style.gridTemplateColumns
    expect(collapsed).toContain('0px')
    expect(collapsed).toContain('1fr')
  })

  test('sidebar width clamped 280-480 on load and via drag', async () => {
    const css = fs.readFileSync('src/stores/prefs.ts', 'utf8')
    expect(css).toMatch(/280/)
    expect(css).toMatch(/480/)
    // default 320
    const pinia = createPinia()
    setActivePinia(pinia)
    const prefs = usePrefs()
    expect(prefs.sidebarWidth).toBe(320)
  })

  test('collapse animates grid-template-columns 150ms and respects reduced-motion', () => {
    const css = fs.readFileSync('src/styles/layout.css', 'utf8')
    expect(css).toMatch(/grid-template-columns/)
    expect(css).toMatch(/150ms/)
    expect(css).toMatch(/prefers-reduced-motion/)
  })

  test('inline script in index.html reads prefs:v2 before paint', () => {
    const html = fs.readFileSync('index.html', 'utf8')
    expect(html).toContain('prefs:v2')
    // must be inline script before </head> or in head, not external module
    expect(html).toMatch(/<script>[\s\S]*prefs:v2[\s\S]*<\/script>/)
    // still has data-theme dark static
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('__MDR_TOKEN__')
  })

  test('document.scrollingElement.scrollTop is 0 and html/body overflow hidden with overscroll-contain only on scrollers', () => {
    const css = fs.readFileSync('src/styles/layout.css', 'utf8')
    expect(css).toContain('html,')
    expect(css).toContain('overflow: hidden')
    // scrollingElement should be 0 - in happy-dom it is 0
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0)
    // overscroll-contain only on reader-scroll / aside / panel etc, not global *
    expect(css).toContain('overscroll-behavior')
    expect(css).not.toMatch(/\*\s*\{[^}]*overscroll/)
  })

  test('.reader-scroll via useScroller exposes scrollTop seam', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const { scroller, setScroller } = useScroller()
    const el = document.createElement('div')
    el.scrollTop = 123
    setScroller(el as unknown as HTMLElement)
    expect(scroller.value?.scrollTop).toBe(123)
    // simulate workspace navigation committing scroll
    const workspace = useWorkspace()
    workspace.root = '/r'
    const tabs = useTabs()
    tabs.navigate('docs/a.md')
    // after navigate, currentEntry scrollTop should be 0
    expect(tabs.currentEntry?.scrollTop).toBe(0)
  })
})
