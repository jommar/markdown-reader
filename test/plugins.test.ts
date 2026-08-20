import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeParse from 'rehype-parse'
import rehypeSlug from 'rehype-slug'
import {
  calloutPlugin,
  codeBlockPlugin,
  dataLinePlugin,
  headingsPlugin,
  internalLinksPlugin,
  mermaidPlugin,
  tablePlugin,
  type Heading,
} from '../src/markdown/plugins.ts'

function render(md: string, ...use: Parameters<ReturnType<typeof unified>['use']>): string {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(...use)
    .use(rehypeStringify)
  return p.processSync(md).toString()
}

test('mermaidPlugin: a ```mermaid fence becomes pre.mermaid with data-src raw text, not highlighted', () => {
  const out = render('```mermaid\ngraph TD\n  A-->B\n```\n', mermaidPlugin)
  assert.match(out, /<pre class="mermaid"/)
  assert.match(out, /data-src="graph TD\n {2}A-->B\n"/)
  assert.match(out, />graph TD\n {2}A-->B\n<\/pre>/)
  assert.doesNotMatch(out, /language-mermaid/)
})

test('mermaidPlugin: a non-mermaid fence is left untouched', () => {
  const out = render('```js\nconst x = 1\n```\n', mermaidPlugin)
  assert.doesNotMatch(out, /<pre class="mermaid"/)
  assert.match(out, /language-js/)
})

function renderCode(md: string, highlighted: boolean): string {
  const p = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(codeBlockPlugin(highlighted))
    .use(rehypeStringify)
  return p.processSync(md).toString()
}

test('codeBlockPlugin (plain, no highlighter): wraps a fence in .code-block with copy button and data-lang', () => {
  const out = renderCode('```js\nconst x = 1\n```\n', false)
  assert.match(out, /<div class="code-block plain" data-lang="js">/)
  assert.match(
    out,
    /<button type="button" class="copy-btn"[^>]*aria-label="Copy code"[^>]*>Copy<\/button>/,
  )
  assert.match(out, /language-js/)
})

test('codeBlockPlugin (plain): unknown language falls back to text', () => {
  const out = renderCode('```\nhello\n```\n', false)
  assert.match(out, /data-lang="text"/)
})

test('codeBlockPlugin (plain): a bare fence becomes code-block plain, not a figure', () => {
  const out = renderCode('```js\nx\n```\n', false)
  assert.match(out, /<div class="code-block plain"/)
  assert.doesNotMatch(out, /<figure/)
})

test('codeBlockPlugin (highlighted): does not double-wrap a pre already inside a figure', () => {
  const out = unified()
    .use(rehypeParse, { fragment: true })
    .use(codeBlockPlugin(true))
    .use(rehypeStringify)
    .processSync(
      '<figure data-rehype-pretty-code-figure=""><pre><code class="language-js">x</code></pre></figure>',
    )
    .toString()
  const count = (out.match(/class="code-block"/g) ?? []).length
  assert.equal(count, 1)
})

test('tablePlugin: wraps a table in .table-wrap and stamps data-rows', () => {
  const out = render('| a | b |\n|---|---|\n| 1 | 2 |\n', tablePlugin(false))
  assert.match(out, /<div class="table-wrap"><table data-rows="2">/)
  assert.doesNotMatch(out, /table-show-all/)
})

test('tablePlugin: a table over 500 rows is capped at 200 with a show-all button', () => {
  const rows = Array.from({ length: 501 }, (_, i) => `| r${i} |`).join('\n')
  const out = render(`| h |\n|---|\n${rows}\n`, tablePlugin(false))
  const trCount = (out.match(/<tr>/g) ?? []).length
  assert.equal(trCount, 200)
  assert.match(out, /data-rows="502"/)
  assert.match(out, /class="table-show-all">Show all 502 rows<\/button>/)
})

test('tablePlugin: showAllTables=true keeps all rows and hides the button', () => {
  const rows = Array.from({ length: 501 }, (_, i) => `| r${i} |`).join('\n')
  const out = render(`| h |\n|---|\n${rows}\n`, tablePlugin(true))
  const trCount = (out.match(/<tr>/g) ?? []).length
  assert.equal(trCount, 502)
  assert.doesNotMatch(out, /table-show-all/)
})

test('tablePlugin: a small table gets no show-all button', () => {
  const out = render('| a |\n|---|\n| 1 |\n', tablePlugin(false))
  assert.doesNotMatch(out, /table-show-all/)
})

const ctx = {
  root: '/ezat',
  fileSet: new Set(['docs/notes.md', 'docs/a.md', 'docs/sub/readme.md']),
  currentPath: 'docs/a.md',
}

function renderLinks(md: string): string {
  const p = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(internalLinksPlugin(ctx))
    .use(rehypeStringify)
  return p.processSync(md).toString()
}

test('internalLinksPlugin: markdown link to an existing file becomes an internal link', () => {
  const out = renderLinks('[n](notes.md)')
  assert.match(out, /data-internal-path="docs\/notes.md"/)
  assert.match(out, /href="\?root=%2Fezat/)
  assert.match(out, /path=docs%2Fnotes.md/)
  assert.doesNotMatch(out, /external/)
})

test('internalLinksPlugin: markdown link with an anchor keeps data-anchor', () => {
  const out = renderLinks('[n](notes.md#sec)')
  assert.match(out, /data-internal-path="docs\/notes.md"/)
  assert.match(out, /data-anchor="sec"/)
  assert.match(out, /#sec"/)
})

test('internalLinksPlugin: external http(s) links get target/rel/class external', () => {
  const out = renderLinks('[e](https://example.com)')
  assert.match(out, /target="_blank"/)
  assert.match(out, /rel="noopener noreferrer"/)
  assert.match(out, /class="external"/)
})

test('internalLinksPlugin: mailto links are treated as external', () => {
  const out = renderLinks('[m](mailto:a@b.c)')
  assert.match(out, /class="external"/)
})

test('internalLinksPlugin: a #fragment link is left unchanged', () => {
  const out = renderLinks('[f](#toc)')
  assert.doesNotMatch(out, /data-internal-path/)
  assert.doesNotMatch(out, /broken-link/)
  assert.match(out, /href="#toc"/)
})

test('internalLinksPlugin: escaping ../ link becomes an above link', () => {
  const out = renderLinks('[u](../../x.md)')
  assert.match(out, /data-internal-path="x.md"/)
  assert.match(out, /data-above="1"/)
})

test('internalLinksPlugin: unsupported extension gets unsupported-link class and title', () => {
  const out = renderLinks('[i](asset.png)')
  assert.match(out, /class="unsupported-link"/)
  assert.match(out, /title="Unsupported file type"/)
})

test('internalLinksPlugin: missing markdown link gets broken-link class and title', () => {
  const out = renderLinks('[b](missing.md)')
  assert.match(out, /class="broken-link"/)
  assert.match(out, /title="Broken link"/)
})

test('dataLinePlugin: stamps data-line on top-level blocks offset by frontmatter lines', () => {
  const out = render('# Title\n\npara\n', dataLinePlugin(3))
  assert.match(out, /<h1 data-line="4">/)
  assert.match(out, /<p data-line="6">/)
})

test('headingsPlugin: collects level, slug and text for h1-h4', () => {
  const sink: Heading[] = []
  const md = '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n'
  const p = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(headingsPlugin(sink))
    .use(rehypeStringify)
  p.processSync(md)
  assert.deepEqual(
    sink.map((h) => [h.level, h.text]),
    [
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
      [4, 'Four'],
    ],
  )
  assert.deepEqual(
    sink.map((h) => h.slug),
    ['one', 'two', 'three', 'four'],
  )
})

const CALLOUT_MARKERS: Record<string, string> = {
  NOTE: 'note',
  TIP: 'tip',
  WARNING: 'warning',
  IMPORTANT: 'important',
  CAUTION: 'caution',
}

test('calloutPlugin: a [!NOTE] blockquote becomes a callout, marker stripped from the label', () => {
  const out = render('> [!NOTE] A note to remember\n', calloutPlugin)
  assert.match(out, /<blockquote class="callout callout-note">/)
  assert.match(out, /class="callout-title">Note<\/div>/)
  assert.match(out, />A note to remember</)
  assert.doesNotMatch(out, /\[!NOTE\]/)
})

test('calloutPlugin: every supported marker type gets its own accent class', () => {
  for (const [marker, cls] of Object.entries(CALLOUT_MARKERS)) {
    const out = render(`> [!${marker}] label\n`, calloutPlugin)
    assert.match(out, new RegExp(`<blockquote class="callout callout-${cls}">`))
    assert.doesNotMatch(out, /\[!/)
  }
})

test('calloutPlugin: marker matching is case-insensitive', () => {
  const out = render('> [!warning] beware\n', calloutPlugin)
  assert.match(out, /<blockquote class="callout callout-warning">/)
})

test('calloutPlugin: a plain blockquote without a marker stays a plain blockquote', () => {
  const out = render('> just a quote\n', calloutPlugin)
  assert.doesNotMatch(out, /callout/)
  assert.match(out, />just a quote</)
})

test('calloutPlugin: an unsupported marker is left as a plain blockquote', () => {
  const out = render('> [!DANGER] nope\n', calloutPlugin)
  assert.doesNotMatch(out, /callout/)
  assert.match(out, />\[!DANGER\] nope</)
})

test('calloutPlugin: a marker in a nested blockquote turns that inner quote into a callout', () => {
  const out = render('>> [!CAUTION] deep\n', calloutPlugin)
  assert.match(out, /<blockquote class="callout callout-caution">/)
})

test('calloutPlugin: never throws on degenerate blockquote shapes', () => {
  assert.doesNotThrow(() => render('> \n', calloutPlugin))
  assert.doesNotThrow(() => render('> ![NOTE] not a marker\n', calloutPlugin))
  assert.doesNotThrow(() => render('> [!NOTE]\n', calloutPlugin))
  assert.doesNotThrow(() => render('> [!NOTE] text\n', calloutPlugin))
})

test('calloutPlugin: a blockquote whose first child is not a <p> stays a plain blockquote', () => {
  const out = render('> - a list item\n> - another\n', calloutPlugin)
  assert.doesNotMatch(out, /callout/)
  assert.match(out, /<blockquote>/)
  assert.match(out, /<li>a list item<\/li>/)
})

test('calloutPlugin: a marker-only callout does not leave an empty <p> below the title', () => {
  const out = render('> [!NOTE]\n', calloutPlugin)
  assert.match(out, /<blockquote class="callout callout-note">/)
  assert.match(out, /class="callout-title">Note<\/div>/)
  assert.doesNotMatch(out, /<p>\s*<\/p>/)
  assert.doesNotMatch(out, /<p><\/p>/)
})
