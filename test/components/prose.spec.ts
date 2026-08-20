import { test, expect } from 'vitest'
import '../../src/style.css'
import '../../src/styles/prose.css'
import '../../src/styles/layout.css'

function getCssText(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
}

test('Item2: prose uses --text-* tokens via stylesheet', () => {
  const css = getCssText()
  // prose base should reference --text-base
  const proseBlock = css.match(/\.prose\s*\{[^}]*\}/s)?.[0] ?? ''
  expect(proseBlock).toContain('var(--text-base)')
  // headings should reference text tokens
  const headingCss = css.match(/\.prose h1[^{]*\{[^}]*\}/s)?.[0] ?? ''
  expect(css).toMatch(/\.prose h1[^{]*\{[^}]*var\(--text-/s)
})

test('Item2: prose computed fontSize/lineHeight/maxWidth', () => {
  const el = document.createElement('div')
  el.className = 'prose'
  document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const fontSize = parseFloat(cs.fontSize)
  const lineHeight = parseFloat(cs.lineHeight)
  // line-height >=1.6 * fontSize (computed lineHeight may be px or unitless)
  // In happy-dom, lineHeight returns computed value like "1.7" or "27.2px"
  let ratio: number
  if (cs.lineHeight.includes('px')) ratio = parseFloat(cs.lineHeight) / fontSize
  else ratio = parseFloat(cs.lineHeight)
  expect(ratio).toBeGreaterThanOrEqual(1.6)
  // maxWidth should equal --reader-measure (72ch by default)
  const measure = getComputedStyle(document.documentElement)
    .getPropertyValue('--reader-measure')
    .trim()
  // happy-dom may compute maxWidth as value of var(--reader-measure) -> "72ch"
  expect(cs.maxWidth).toContain(measure || '72ch')
  el.remove()
})

test('Item2: overflow-wrap anywhere retained', () => {
  const css = getCssText()
  expect(css).toContain('overflow-wrap: anywhere')
  const el = document.createElement('code')
  el.textContent = 'x'.repeat(20)
  const wrap = document.createElement('div')
  wrap.className = 'prose'
  wrap.appendChild(el)
  document.body.appendChild(wrap)
  expect(getComputedStyle(el).overflowWrap).toBe('anywhere')
  wrap.remove()
})

test('Item2: code/callout/blockquote/table share radius/shadow tokens', () => {
  const css = getCssText()
  // check specific prose sub-selectors use tokens, not just tokens.css existence
  const codeBlockCss = css.match(/\.prose \.code-block[^{]*\{[^}]*\}/s)?.[0] ?? ''
  const codeCss = css.match(/\.prose code\s*\{[^}]*\}/s)?.[0] ?? ''
  const bqCss = css.match(/\.prose blockquote\s*\{[^}]*\}/s)?.[0] ?? ''
  const calloutCss = css.match(/\.prose \.callout[^{]*\{[^}]*\}/s)?.[0] ?? ''
  expect(codeBlockCss).toContain('var(--radius-')
  expect(codeCss).toContain('var(--radius-')
  expect(bqCss).toContain('var(--radius-')
  expect(calloutCss).toContain('var(--radius-')
  // shadow tokens for at least code-block and callout
  expect(codeBlockCss + calloutCss + bqCss).toContain('var(--shadow-')
})

test('Item2: heading rhythm scroll-margin-top 1rem and text-wrap balance', () => {
  const css = getCssText()
  expect(css).toContain('scroll-margin-top: 1rem')
  expect(css).toContain('text-wrap: balance')
  const h = document.createElement('h2')
  const wrap = document.createElement('div')
  wrap.className = 'prose'
  wrap.appendChild(h)
  document.body.appendChild(wrap)
  expect(getComputedStyle(h).scrollMarginTop).toBe('1rem')
  wrap.remove()
})

test('Item2: scrollbar scoped with scrollbar-gutter stable', () => {
  const css = getCssText()
  expect(css).toContain('scrollbar-gutter: stable')
  expect(css).not.toContain('* {')
  // ensure no global * scrollbar rule remains
  const hasGlobalStar = /\*\s*\{[^}]*scrollbar-width/.test(css)
  expect(hasGlobalStar).toBe(false)
})

test('Item2: prefers-reduced-motion disables prose/toast transitions', () => {
  const css = getCssText()
  expect(css).toContain('prefers-reduced-motion')
  // should disable transition/animation for prose
  const hasReduced = css.includes('@media (prefers-reduced-motion: reduce)')
  expect(hasReduced).toBe(true)
  // check that within that block there is transition or animation none
  expect(css).toMatch(/prefers-reduced-motion[^}]*transition[^}]*none/s)
})

test('Item2: shiki span color not black', async () => {
  const span = document.createElement('span')
  span.className = 'shiki'
  const inner = document.createElement('span')
  inner.style.setProperty('--shiki-light', '#ff0000')
  inner.style.setProperty('--shiki-dark', '#00ff00')
  inner.textContent = 'code'
  span.appendChild(inner)
  document.body.appendChild(span)
  const col = getComputedStyle(inner).color
  expect(col).not.toBe('rgb(0, 0, 0)')
  expect(col).not.toBe('rgba(0, 0, 0, 0)')
  span.remove()
})
