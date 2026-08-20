import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import '../../src/style.css'

const UtilityProbe = defineComponent({
  render: () => h('div', { class: 'bg-accent text-fg font-mono' }, 'probe'),
})

test('Tailwind utilities compile from theme tokens', () => {
  mount(UtilityProbe)
  const css = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
  expect(css).toContain('.bg-accent')
  expect(css).toContain('.text-fg')
  expect(css).toContain('.font-mono')
})
