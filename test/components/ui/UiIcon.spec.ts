import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiIcon from '../../../src/components/ui/UiIcon.vue'

describe('UiIcon', () => {
  test('renders an SVG element', () => {
    const wrapper = mount(UiIcon, { props: { name: 'close' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  test('svg is hidden from assistive technology', () => {
    const wrapper = mount(UiIcon, { props: { name: 'back' } })
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })

  test('size prop controls width and height', () => {
    const wrapper = mount(UiIcon, { props: { name: 'close', size: 20 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('20')
    expect(svg.attributes('height')).toBe('20')
  })

  test('defaults size to 16', () => {
    const wrapper = mount(UiIcon, { props: { name: 'close' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('16')
    expect(svg.attributes('height')).toBe('16')
  })

  test('different names produce different SVG content', () => {
    const a = mount(UiIcon, { props: { name: 'back' } })
      .find('svg')
      .html()
    const b = mount(UiIcon, { props: { name: 'close' } })
      .find('svg')
      .html()
    expect(a).not.toBe(b)
  })

  test('has lucide-style attributes', () => {
    const wrapper = mount(UiIcon, { props: { name: 'copy' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')
    expect(svg.attributes('stroke')).toBe('currentColor')
    expect(svg.attributes('fill')).toBe('none')
  })
})
