import { test, expect } from 'vitest'
import '../../src/style.css'

function cs(el: HTMLElement) {
  return getComputedStyle(el)
}

function rootVal(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

test('Item1: spacing tokens exist via getComputedStyle', () => {
  expect(rootVal('--space-1')).toBe('0.25rem')
  expect(rootVal('--space-2')).toBe('0.5rem')
  expect(rootVal('--space-4')).toBe('1rem')
  expect(rootVal('--space-8')).toBe('2rem')
  expect(rootVal('--space-12')).toBe('3rem')
  expect(rootVal('--space-16')).toBe('4rem')
})

test('Item1: radius tokens exist', () => {
  expect(rootVal('--radius-sm')).toBe('4px')
  expect(rootVal('--radius-md')).toBe('6px')
  expect(rootVal('--radius-lg')).toBe('8px')
  expect(rootVal('--radius-full')).toBe('9999px')
})

test('Item1: shadow tokens via color-mix (no rgba literals)', () => {
  const sm = rootVal('--shadow-sm')
  const md = rootVal('--shadow-md')
  const lg = rootVal('--shadow-lg')
  expect(sm).not.toBe('')
  expect(md).not.toBe('')
  expect(lg).not.toBe('')
  expect(sm).toContain('color-mix')
  expect(md).toContain('color-mix')
  expect(lg).toContain('color-mix')
  expect(sm).not.toContain('rgba')
  expect(md).not.toContain('rgba')
  expect(lg).not.toContain('rgba')
})

test('Item1: motion tokens', () => {
  expect(rootVal('--duration-100')).toBe('100ms')
  expect(rootVal('--duration-200')).toBe('200ms')
  expect(rootVal('--ease-standard')).not.toBe('')
  expect(rootVal('--ease-emphasized')).not.toBe('')
})

test('Item1: z tokens', () => {
  expect(rootVal('--z-dropdown')).toBe('40')
  expect(rootVal('--z-dialog')).toBe('50')
  expect(rootVal('--z-toast')).toBe('60')
})

test('Item1: typography tokens', () => {
  expect(rootVal('--text-xs')).not.toBe('')
  expect(rootVal('--text-sm')).not.toBe('')
  expect(rootVal('--text-base')).toBe('1rem')
  expect(rootVal('--text-lg')).not.toBe('')
  expect(rootVal('--text-xl')).not.toBe('')
})

test('Item1: light+dark define every token', () => {
  const tokens = [
    '--bg',
    '--bg-elev',
    '--bg-inset',
    '--border',
    '--border-strong',
    '--fg',
    '--fg-muted',
    '--fg-faint',
    '--accent',
    '--hit',
    '--danger',
    '--success',
    '--warning',
    '--info',
    '--space-1',
    '--space-4',
    '--radius-sm',
    '--shadow-sm',
    '--duration-100',
    '--z-toast',
    '--text-base',
  ]
  // dark (default)
  for (const t of tokens) expect(rootVal(t)).not.toBe('')
  // light
  document.documentElement.setAttribute('data-theme', 'light')
  for (const t of tokens)
    expect(getComputedStyle(document.documentElement).getPropertyValue(t).trim()).not.toBe('')
  document.documentElement.removeAttribute('data-theme')
})

test('Item1: @theme inline exposes success/warning/info + radius/shadow', () => {
  const css = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
  // The source file should contain @theme inline mappings; vite+tailwind may inline it,
  // but the raw tokens.css still should have them — check computed css text fallback:
  // If tailwind hasn't expanded, at least check tokens.css content via fetching style tag
  // In happy-dom, @theme is preserved as @theme block in style text.
  // We assert the style sheet contains the expected mappings.
  expect(css).toContain('--color-success')
  expect(css).toContain('--color-warning')
  expect(css).toContain('--color-info')
  expect(css).toContain('--radius-sm')
  expect(css).toContain('--shadow-sm')
})
