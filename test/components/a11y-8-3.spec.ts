import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../../src/App.vue'

describe('Item8 Slice 8-3 — single scroll, skip-link, URL sentinel, reduced-motion', () => {
  test('single .reader-scroll invariant and no window scroll', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    const scrollers = wrapper.findAll('.reader-scroll')
    expect(scrollers.length).toBe(1)
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0)
    const css = fs.readFileSync('src/styles/layout.css', 'utf8')
    expect(css).toContain('html,')
    expect(css).toContain('overflow: hidden')
    wrapper.unmount()
  })

  test('skip-link #main exists and main#main is in App', () => {
    const html = fs.readFileSync('index.html', 'utf8')
    expect(html).toContain('href="#main"')
    expect(html).toContain('skip-link')
    const appSrc = fs.readFileSync('src/App.vue', 'utf8')
    expect(appSrc).toContain('id="main"')
    // ensure main tag or element with id main
    expect(appSrc).toMatch(/<main[^>]*id="main"|id="main"/)
  })

  test('URL sentinel pushState + popstate without double-Back', () => {
    const src = fs.readFileSync('src/composables/useUrlSync.ts', 'utf8')
    expect(src).toContain("mdr: 'app'")
    expect(src).toContain("mdr: 'base'")
    expect(src).toContain('pushState')
    expect(src).toContain('replaceState')
    expect(src).toContain('popstate')
    // syncUrl should use replaceState not pushState for sync
    const syncSection = src.slice(src.indexOf('function syncUrl'))
    expect(syncSection).toContain('replaceState')
    // should not pushState with base+hash (would be double)
    expect(syncSection).not.toMatch(/pushState.*base/)
  })

  test('reduced-motion globally disables spinner/toast/Toc', () => {
    const layout = fs.readFileSync('src/styles/layout.css', 'utf8')
    expect(layout).toMatch(/prefers-reduced-motion/)
    // global * disables animation
    expect(layout).toContain('animation-duration')
    const reader = fs.readFileSync('src/components/Reader.vue', 'utf8')
    expect(reader).toContain('prefers-reduced-motion')
    // spinner should be disabled, not 2s
    expect(reader).not.toContain('animation-duration: 2s')
  })
})
