import { test } from 'node:test'
import assert from 'node:assert/strict'
import './helpers/dom.ts'
import { renderDocument } from '../src/markdown/renderer.ts'
import type { FileResult } from '../server/types.ts'

function file(content: string, overrides: Partial<FileResult> = {}): FileResult {
  return {
    path: 'docs/a.md',
    content,
    frontmatter: null,
    frontmatterLines: 0,
    mtimeMs: 0,
    size: content.length,
    ...overrides,
  }
}

const ctx = { root: '/ezat', fileSet: new Set(['docs/notes.md', 'docs/a.md']) }

test('renderDocument: returns the RenderedDoc contract with headings, frontmatter and flags', async () => {
  const doc = await renderDocument(
    file('# Title\n\ntext\n', { frontmatter: { title: 'T' }, frontmatterLines: 3 }),
    ctx,
  )
  assert.equal(typeof doc.html, 'string')
  assert.ok(doc.html.includes('<h1'))
  assert.deepEqual(doc.headings, [{ level: 1, slug: 'title', text: 'Title' }])
  assert.deepEqual(doc.frontmatter, { title: 'T' })
  assert.equal(doc.hasMermaid, false)
  assert.equal(doc.highlightingSkipped, false)
})

test('renderDocument: mermaid fence produces pre.mermaid and flags hasMermaid', async () => {
  const doc = await renderDocument(file('```mermaid\ngraph TD\n  A-->B\n```\n'), ctx)
  assert.equal(doc.hasMermaid, true)
  assert.match(doc.html, /<pre class="mermaid"/)
  assert.doesNotMatch(doc.html, /language-mermaid/)
  assert.doesNotMatch(doc.html, /data-rehype-pretty-code-figure/)
})

test('renderDocument: code fences are highlighted and wrapped with code-block and copy button', async () => {
  const doc = await renderDocument(file('```js\nconst x = 1\n```\n'), ctx)
  assert.match(doc.html, /<figure[^>]*class="code-block"/)
  assert.match(doc.html, /data-lang="js"/)
  assert.match(
    doc.html,
    /<button[^>]*class="copy-btn"[^>]*aria-label="Copy code"[^>]*>Copy<\/button>/,
  )
})

test('renderDocument: no-highlight path (>200KB) wraps in code-block plain with copy button', async () => {
  const big = 'x'.repeat(200_001)
  const doc = await renderDocument(file(`\`\`\`js\n${big}\n\`\`\`\n`), ctx)
  assert.equal(doc.highlightingSkipped, true)
  assert.match(doc.html, /class="code-block plain"/)
  assert.match(doc.html, /class="copy-btn"/)
  assert.doesNotMatch(doc.html, /<figure/)
})

test('renderDocument: a huge table is capped at 200 rows with a show-all button', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => `| r${i} |`).join('\n')
  const doc = await renderDocument(file(`| h |\n|---|\n${rows}\n`), ctx)
  const trCount = (doc.html.match(/<tr>/g) ?? []).length
  assert.equal(trCount, 200)
  assert.match(doc.html, /data-rows="502"/)
  assert.match(doc.html, /class="table-show-all">Show all 502 rows<\/button>/)
})

test('renderDocument: showAllTables=true keeps all rows', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => `| r${i} |`).join('\n')
  const doc = await renderDocument(file(`| h |\n|---|\n${rows}\n`), ctx, { showAllTables: true })
  const trCount = (doc.html.match(/<tr>/g) ?? []).length
  assert.equal(trCount, 502)
})

test('renderDocument: internal links, external links, broken links and fragments are rewritten', async () => {
  const doc = await renderDocument(
    file('[n](notes.md) [ext](https://example.com) [br](missing.md) [f](#toc)\n'),
    ctx,
  )
  assert.match(doc.html, /data-internal-path="docs\/notes.md"/)
  assert.match(
    doc.html,
    /href="https:\/\/example.com"[^>]*rel="noopener noreferrer"[^>]*class="external"/,
  )
  assert.match(doc.html, /class="broken-link" title="Broken link"/)
  assert.match(doc.html, /href="#toc"/)
  assert.doesNotMatch(doc.html, /data-internal-path[^>]*href="#toc"/)
})

test('renderDocument: GFM task lists and tables render', async () => {
  const doc = await renderDocument(
    file('- [x] done\n- [ ] todo\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'),
    ctx,
  )
  assert.match(doc.html, /task-list-item/)
  assert.match(doc.html, /type="checkbox"[^>]*checked[^>]*disabled/)
  assert.match(doc.html, /class="table-wrap"/)
})

test('renderDocument: raw HTML is sanitized (scripts stripped, details preserved)', async () => {
  const doc = await renderDocument(
    file('<script>alert(1)</script><details><summary>s</summary><p>b</p></details>\n'),
    ctx,
  )
  assert.doesNotMatch(doc.html, /<script/i)
  assert.match(doc.html, /<details><summary>s<\/summary>/)
})

test('renderDocument: data-line is stamped on top-level blocks with frontmatter offset', async () => {
  const doc = await renderDocument(file('# Title\n\npara\n', { frontmatterLines: 3 }), ctx)
  assert.match(doc.html, /<h1 data-line="4">/)
  assert.match(doc.html, /<p data-line="6">/)
})

test('renderDocument: a [!TIP] blockquote renders as a callout with the marker stripped', async () => {
  const doc = await renderDocument(file('> [!TIP] Try this first\n'), ctx)
  assert.match(doc.html, /class="callout callout-tip"/)
  assert.match(doc.html, /class="callout-title">Tip<\/div>/)
  assert.doesNotMatch(doc.html, /\[!TIP\]/)
})

test('renderDocument: a plain blockquote stays a plain blockquote', async () => {
  const doc = await renderDocument(file('> just a quote\n'), ctx)
  assert.doesNotMatch(doc.html, /callout/)
})

test('renderDocument: highlighted code spans have no empty data-line attribute', async () => {
  const doc = await renderDocument(file('```js\nconst x = 1\n```\n'), ctx)
  assert.doesNotMatch(doc.html, /<span data-line="">/)
})
