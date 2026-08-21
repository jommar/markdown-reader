import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../../../src/components/ui/UiButton.vue'

describe('UiButton', () => {
  test('renders a button element with slot content', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Open' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toBe('Open')
  })

  test('defaults to type button', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.attributes('type')).toBe('button')
  })

  test('emits click with the event payload', async () => {
    const wrapper = mount(UiButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('a disabled button carries the disabled attribute and does not emit click', async () => {
    const wrapper = mount(UiButton, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  test('primary variant applies the accent background', () => {
    const wrapper = mount(UiButton, { props: { variant: 'primary' } })
    expect(wrapper.classes()).toContain('bg-accent')
  })

  test('active variant applies the accent text and border', () => {
    const wrapper = mount(UiButton, { props: { active: true } })
    expect(wrapper.classes()).toContain('text-accent')
    expect(wrapper.classes()).toContain('border-accent')
  })

  test('active variant applies an accent tint background', () => {
    const wrapper = mount(UiButton, { props: { active: true } })
    expect(wrapper.classes()).toContain('bg-accent/15')
  })

  test('has a pressed (active) state per variant', () => {
    expect(mount(UiButton).classes()).toContain('active:bg-bg-inset')
    expect(mount(UiButton, { props: { variant: 'ghost' } }).classes()).toContain(
      'active:bg-bg-inset',
    )
    expect(mount(UiButton, { props: { variant: 'primary' } }).classes()).toContain(
      'active:opacity-80',
    )
  })

  test('keeps accent text on hover while toggled active', () => {
    const active = mount(UiButton, { props: { active: true } })
    expect(active.classes()).toContain('hover:text-accent')
    const inactive = mount(UiButton)
    expect(inactive.classes()).not.toContain('hover:text-accent')
  })

  test('extra classes merge onto the button root', () => {
    const wrapper = mount(UiButton, { props: { disabled: true }, attrs: { title: 'Back (Alt+←)' } })
    expect(wrapper.attributes('title')).toBe('Back (Alt+←)')
  })

  test('ghost variant renders transparent background', () => {
    const wrapper = mount(UiButton, { props: { variant: 'ghost' } })
    expect(wrapper.classes().join(' ')).toMatch(/bg-transparent|border-transparent/)
    expect(wrapper.classes()).not.toContain('bg-accent')
  })

  test('has focus-visible 2px accent offset 1px', () => {
    const wrapper = mount(UiButton)
    const cls = wrapper.classes().join(' ')
    expect(cls).toContain('focus-visible:outline-accent')
    expect(cls).toContain('focus-visible:outline-offset-1')
    expect(cls).toMatch(/focus-visible:outline-2/)
  })

  test('forwards aria-pressed when active', () => {
    const active = mount(UiButton, { props: { active: true } })
    expect(active.attributes('aria-pressed')).toBe('true')
    const inactive = mount(UiButton, { props: { active: false } })
    expect(inactive.attributes('aria-pressed')).toBeUndefined()
  })

  test('uses token radii not hardcoded rounded literals', () => {
    const wrapper = mount(UiButton)
    expect(wrapper.classes()).toContain('rounded-sm')
    expect(wrapper.classes().includes('rounded')).toBe(false)
  })
})
