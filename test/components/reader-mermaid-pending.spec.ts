import { describe, test, expect } from 'vitest'
import fs from 'node:fs'

describe('Reader pendingLine after mermaid', () => {
  test('Reader re-applies pendingLine after mermaid render', () => {
    const src = fs.readFileSync('src/components/Reader.vue', 'utf8')
    // should handle mermaidDone or second scroll after mermaid
    const hasMermaidHandler =
      src.includes('mermaid') &&
      (src.includes('mermaidDone') || src.includes('mermaid-rendered') || src.includes('onMermaid'))
    const hasSecondScroll = src.includes('scrollToLine') && src.split('scrollToLine').length > 2
    // need both: mermaid handling and second scroll (re-apply)
    expect(hasMermaidHandler).toBe(true)
    expect(hasSecondScroll).toBe(true)
  })

  test('MarkdownView emits mermaid completion', () => {
    const src = fs.readFileSync('src/components/MarkdownView.vue', 'utf8')
    expect(src).toContain('mermaid')
    // should emit or expose completion
    const emits =
      src.includes('mermaidDone') ||
      src.includes('mermaid-rendered') ||
      src.includes('defineExpose')
    expect(emits).toBe(true)
  })
})
