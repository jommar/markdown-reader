import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import Sidebar from '../../src/components/Sidebar.vue'
import { useWorkspace } from '../../src/stores/workspace'

enableAutoUnmount(afterEach)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
})

describe('Sidebar', () => {
  test('renders an "Open folder" button that opens the dialog store state', async () => {
    const wrapper = mount(Sidebar, { global: { plugins: [pinia] } })
    const openBtn = wrapper.findAll('button').find((b) => b.text().includes('Open folder'))
    expect(openBtn).toBeTruthy()
    const workspace = useWorkspace()
    expect(workspace.dialogOpen).toBe(false)
    await openBtn!.trigger('click')
    expect(workspace.dialogOpen).toBe(true)
  })
})
