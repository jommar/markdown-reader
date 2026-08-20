import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SmokeFixture from './SmokeFixture.vue'

test('mounts a .vue SFC', () => {
  const wrapper = mount(SmokeFixture, { props: { msg: 'hello' } })
  expect(wrapper.text()).toBe('hello')
})
