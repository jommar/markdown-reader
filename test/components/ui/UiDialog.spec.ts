import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiDialog from '../../../src/components/ui/UiDialog.vue'
import fs from 'node:fs'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiDialog', () => {
  test('renders via Teleport with role dialog when open', () => {
    const wrapper = mount(UiDialog, {
      props: { open: true, title: 'Test dialog' },
      attachTo: document.body,
      slots: { default: 'content' },
    })
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe('Test dialog')
    wrapper.unmount()
  })

  test('does not render when closed', () => {
    mount(UiDialog, { props: { open: false }, attachTo: document.body })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  test('emits close on overlay click', async () => {
    const wrapper = mount(UiDialog, { props: { open: true }, attachTo: document.body })
    const overlay = document.body.querySelector('.absolute.inset-0') as HTMLElement
    expect(overlay).not.toBeNull()
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  test('emits close on Escape', async () => {
    const wrapper = mount(UiDialog, { props: { open: true }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  test('uses token rounded and shadow', () => {
    const wrapper = mount(UiDialog, { props: { open: true }, attachTo: document.body })
    const html = document.body.innerHTML
    expect(html).not.toMatch(/rounded-\[/)
    expect(html).not.toMatch(/shadow-\[/)
    expect(html).toMatch(/rounded-(sm|md|lg)/)
    expect(html).toMatch(/shadow-(sm|md|lg)/)
    wrapper.unmount()
  })

  test('respects prefers-reduced-motion', () => {
    const content = fs.readFileSync('./src/components/ui/UiDialog.vue', 'utf-8')
    expect(content).toContain('prefers-reduced-motion')
  })
})
