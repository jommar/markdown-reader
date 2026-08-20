import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiInput from '../../../src/components/ui/UiInput.vue'

describe('UiInput', () => {
  test('renders an input with placeholder, value, and aria-label', () => {
    const wrapper = mount(UiInput, {
      props: { modelValue: 'docs', placeholder: 'Filter tree…', ariaLabel: 'Filter tree' },
    })
    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Filter tree…')
    expect((input.element as HTMLInputElement).value).toBe('docs')
    expect(input.attributes('aria-label')).toBe('Filter tree')
  })

  test('emits update:modelValue with typed text', async () => {
    const wrapper = mount(UiInput)
    await wrapper.find('input').setValue('hello')
    expect(wrapper.emitted('update:modelValue')).toEqual([['hello']])
  })

  test('forwards a disabled prop to the input', () => {
    const wrapper = mount(UiInput, { props: { disabled: true } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  test('applies the mono font when asked', () => {
    const wrapper = mount(UiInput, { props: { mono: true } })
    expect(wrapper.find('input').classes()).toContain('font-mono')
  })

  test('emits native enter keydown', async () => {
    const wrapper = mount(UiInput)
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('enter')).toHaveLength(1)
  })

  test('sets aria-invalid when invalid', () => {
    const wrapper = mount(UiInput, { props: { invalid: true } })
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
  })

  test('omits aria-invalid when not invalid', () => {
    const wrapper = mount(UiInput, { props: { invalid: false } })
    expect(wrapper.find('input').attributes('aria-invalid')).toBeUndefined()
  })

  test('forwards aria-describedby', () => {
    const wrapper = mount(UiInput, { props: { describedBy: 'err-1' } })
    expect(wrapper.find('input').attributes('aria-describedby')).toBe('err-1')
  })

  test('shows clear × when has value and not disabled', () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'hello' } })
    expect(wrapper.find('button[aria-label="Clear"]').exists()).toBe(true)
  })

  test('hides clear × when empty or disabled', () => {
    expect(
      mount(UiInput, { props: { modelValue: '' } })
        .find('button[aria-label="Clear"]')
        .exists(),
    ).toBe(false)
    expect(
      mount(UiInput, { props: { modelValue: 'hello', disabled: true } })
        .find('button[aria-label="Clear"]')
        .exists(),
    ).toBe(false)
  })

  test('clear × click emits empty value', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'hello' } })
    await wrapper.find('button[aria-label="Clear"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })

  test('Esc clears when input receives Escape', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'hello' } })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
  })

  test('uses token rounded-sm and focus-visible outline', () => {
    const input = mount(UiInput).find('input')
    expect(input.classes().join(' ')).toContain('rounded-sm')
    expect(input.classes().join(' ')).toContain('focus-visible:outline-accent')
  })

  test('invalid applies border-danger token', () => {
    const input = mount(UiInput, { props: { invalid: true } }).find('input')
    expect(input.classes().join(' ')).toContain('border-danger')
  })
})
