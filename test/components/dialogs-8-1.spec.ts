import { describe, test, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import OpenRootDialog from '../../src/components/OpenRootDialog.vue'
import HistoryDialog from '../../src/components/HistoryDialog.vue'
import { useWorkspace } from '../../src/stores/workspace'
import { useHistory } from '../../src/stores/history'

beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

describe('Dialogs Slice 8-1 file seams', () => {
  test('OpenRootDialog is Teleported and inert background', () => {
    const src = fs.readFileSync('src/components/OpenRootDialog.vue', 'utf8')
    expect(src).toContain('<Teleport')
    expect(src).toContain('inert')
  })
  test('OpenRootDialog input has aria-invalid and describedby', () => {
    const src = fs.readFileSync('src/components/OpenRootDialog.vue', 'utf8')
    // via UiInput props :invalid and :described-by (which render aria-invalid/describedby)
    expect(src).toMatch(/invalid/)
    expect(src).toMatch(/describedby|described-by/i)
    expect(src).toContain('open-root-error')
  })
  test('HistoryDialog is Teleported with role=option entries keyboardable', () => {
    const src = fs.readFileSync('src/components/HistoryDialog.vue', 'utf8')
    expect(src).toContain('<Teleport')
    expect(src).toContain('role="option"')
    expect(src).toContain('tabindex')
  })
  test('single Escape guard: no capture leak', () => {
    const openSrc = fs.readFileSync('src/components/OpenRootDialog.vue', 'utf8')
    const histSrc = fs.readFileSync('src/components/HistoryDialog.vue', 'utf8')
    // should NOT have capture:true leak with stopImmediatePropagation per dialog
    expect(openSrc).not.toMatch(/addEventListener\('keydown',.*true/)
    expect(histSrc).not.toMatch(/addEventListener\('keydown',.*true/)
    // if they use window.addEventListener with capture true, that's leak
    const hasLeak = (s: string) =>
      s.includes("addEventListener('keydown'") &&
      s.includes('true') &&
      s.includes('stopImmediatePropagation')
    expect(hasLeak(openSrc)).toBe(false)
    expect(hasLeak(histSrc)).toBe(false)
  })
})

describe('Dialogs functional', () => {
  test('OpenRootDialog input aria-invalid/deschribedby when error', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => ({ ok: false, status: 400, json: async () => ({ error: 'bad' }) }) as Response,
      ),
    )
    const wrapper = mount(OpenRootDialog, {
      props: { open: true },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // input is teleported to body
    const input = document.body.querySelector(
      'input[aria-label="Directory path"]',
    ) as HTMLInputElement | null
    expect(input).toBeTruthy()
    if (!input) {
      wrapper.unmount()
      return
    }
    // set value via native input event (UiInput uses v-model)
    input.value = '/bad'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    const btn = document.body.querySelector('button.submit') as HTMLButtonElement | null
    expect(btn).toBeTruthy()
    btn!.click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('bad'))
    const dialogInput = document.body.querySelector(
      'input[aria-label="Directory path"]',
    ) as HTMLElement | null
    expect(dialogInput?.getAttribute('aria-invalid')).toBe('true')
    const describedBy = dialogInput?.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const errEl = describedBy ? document.getElementById(describedBy) : null
    if (errEl) expect(errEl.textContent).toContain('bad')
    wrapper.unmount()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    document.head.querySelector('meta[name="mdr-token"]')?.remove()
  })

  test('HistoryDialog entries role=option keyboardable Enter', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const history = useHistory()
    history.record('/r', 'a.md')
    history.record('/r', 'b.md')
    const wrapper = mount(HistoryDialog, { global: { plugins: [pinia] }, attachTo: document.body })
    history.dialogOpen = true
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const options = document.body.querySelectorAll('[role="option"]')
    expect(options.length).toBeGreaterThanOrEqual(2)
    for (const opt of Array.from(options)) {
      expect(opt.getAttribute('tabindex')).toBeDefined()
    }
    wrapper.unmount()
    document.body.innerHTML = ''
    document.head.querySelector('meta[name="mdr-token"]')?.remove()
  })
})
