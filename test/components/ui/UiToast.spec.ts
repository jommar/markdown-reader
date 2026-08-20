import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiToast from '../../../src/components/ui/UiToast.vue'
import fs from 'node:fs'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountToast(props: Record<string, unknown> = {}) {
  return mount(UiToast, {
    props: { message: 'Root widened', ...props } as never,
    attachTo: document.body,
  })
}

describe('UiToast', () => {
  test('renders the message and Undo/Dismiss actions', () => {
    mountToast({ message: 'Root widened to /tmp' })
    expect(document.body.textContent).toContain('Root widened to /tmp')
    expect(document.body.textContent).toContain('Undo')
    expect(document.body.textContent).toContain('Dismiss')
  })

  test('emits undo when Undo is clicked', async () => {
    const wrapper = mountToast()
    const btn = document.body.querySelectorAll('button')[0] as HTMLButtonElement
    // trigger via Vue wrapper still works: find teleport content via document
    // use native click then check emitted via wrapper
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('undo')).toHaveLength(1)
    wrapper.unmount()
  })

  test('emits dismiss when Dismiss is clicked', async () => {
    const wrapper = mountToast()
    const btns = document.body.querySelectorAll('button')
    const dismiss = btns[1] as HTMLButtonElement
    dismiss.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    wrapper.unmount()
  })

  test('is positioned via single portal fixed bottom-4 left-1/2 flex flex-col gap-2', () => {
    mountToast()
    const portal = document.getElementById('mdr-toast-portal')
    expect(portal).not.toBeNull()
    expect(portal!.className).toContain('fixed')
    expect(portal!.className).toContain('bottom-4')
    expect(portal!.className).toContain('left-1/2')
    expect(portal!.className).toContain('flex')
    expect(portal!.className).toContain('gap-2')
  })

  test('has role status and aria-live polite by default', () => {
    mountToast()
    const item = document.body.querySelector('[role="status"]') as HTMLElement
    expect(item).not.toBeNull()
    expect(item.getAttribute('aria-live')).toBe('polite')
  })

  test('error kind uses assertive live region', () => {
    mountToast({ kind: 'error' })
    const item = document.body.querySelector('[aria-live="assertive"]') as HTMLElement
    expect(item).not.toBeNull()
  })

  test('uses token rounded-md and shadow-md', () => {
    mountToast()
    const item = document.body.querySelector('.toast-item') as HTMLElement
    expect(item.className).toMatch(/rounded-(sm|md|lg)/)
    expect(item.className).toMatch(/shadow-(sm|md|lg)/)
  })

  test('multiple toasts share single portal with flex col gap-2', () => {
    const w1 = mountToast({ message: 'first' })
    const w2 = mount(UiToast, { props: { message: 'second' } as never, attachTo: document.body })
    const w3 = mount(UiToast, { props: { message: 'third' } as never, attachTo: document.body })
    const portal = document.getElementById('mdr-toast-portal') as HTMLElement
    expect(portal).not.toBeNull()
    expect(portal.className).toContain('flex-col')
    expect(portal.className).toContain('gap-2')
    const items = portal.querySelectorAll('.toast-item')
    expect(items.length).toBe(3)
    w1.unmount()
    w2.unmount()
    w3.unmount()
  })

  test('pause on hover pauses auto-dismiss timer', async () => {
    vi.useFakeTimers()
    const wrapper = mount(UiToast, {
      props: { message: 'hello', duration: 2000 } as never,
      attachTo: document.body,
    })
    const item = document.body.querySelector('.toast-item') as HTMLElement
    vi.advanceTimersByTime(1000)
    item.dispatchEvent(new Event('mouseenter', { bubbles: true }))
    vi.advanceTimersByTime(2000)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    item.dispatchEvent(new Event('mouseleave', { bubbles: true }))
    vi.advanceTimersByTime(1100)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    wrapper.unmount()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  test('enter/leave disabled under prefers-reduced-motion', () => {
    const content = fs.readFileSync('./src/components/ui/UiToast.vue', 'utf-8')
    expect(content).toContain('prefers-reduced-motion')
    expect(content).toMatch(/transition:\s*none/)
  })
})
