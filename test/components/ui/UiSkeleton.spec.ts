import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiSkeleton from '../../../src/components/ui/UiSkeleton.vue'
import fs from 'node:fs'

describe('UiSkeleton', () => {
  test('renders lines with token classes', () => {
    const wrapper = mount(UiSkeleton, { props: { lines: 3 } })
    const html = wrapper.html()
    expect(html).toMatch(/bg-bg|bg-border|animate-pulse/)
    expect(html).toMatch(/rounded-(sm|md|lg|full)/)
  })

  test('not hardcoded rounded or shadow literals', () => {
    const wrapper = mount(UiSkeleton, { props: { lines: 2 } })
    const html = wrapper.html()
    expect(html).not.toMatch(/rounded-\[/)
    expect(html).not.toMatch(/shadow-\[/)
  })

  test('respects prefers-reduced-motion', () => {
    const content = fs.readFileSync('./src/components/ui/UiSkeleton.vue', 'utf-8')
    expect(content).toContain('prefers-reduced-motion')
  })

  test('aria-hidden', () => {
    const wrapper = mount(UiSkeleton)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
