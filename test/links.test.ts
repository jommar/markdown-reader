import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveInternal } from '../src/markdown/links.ts'
import type { Resolved } from '../src/markdown/links.ts'

const fs = (paths: string[]) => new Set(paths)

function assertMd(out: Resolved, path: string, anchor?: string) {
  assert.equal(out.kind, 'md')
  const md = out as Extract<Resolved, { kind: 'md' }>
  assert.equal(md.path, path)
  assert.equal(md.anchor, anchor)
}

test('trailing slash on a dir link resolves to its index file', () => {
  assertMd(
    resolveInternal('docs/a.md', 'notes/', fs(['docs/notes/index.md'])),
    'docs/notes/index.md',
  )
})

test('an escaping `..` link returns kind above with the right upLevels and rest', () => {
  const out = resolveInternal('sub/a.md', '../../x.md', fs([]))
  assert.deepEqual(out, { kind: 'above', upLevels: 1, rest: 'x.md' })
})

test('exact `..` escape with trailing slash returns above', () => {
  const out = resolveInternal('sub/a.md', '../../', fs([]))
  assert.equal(out.kind, 'above')
  const above = out as Extract<Resolved, { kind: 'above' }>
  assert.equal(above.upLevels, 1)
})

test('`..foo` is not treated as an escape (false positive)', () => {
  assertMd(resolveInternal('docs/a.md', '../foo.md', fs(['foo.md'])), 'foo.md')
})

test('a link whose filename starts with ..foo resolves as a normal file, not above', () => {
  assertMd(resolveInternal('', '..foo/x.md', fs(['..foo/x.md'])), '..foo/x.md')
})

test('root-absolute links resolve relative to the root, not the current dir', () => {
  assertMd(
    resolveInternal('docs/a.md', '/docs/ref/index.md', fs(['docs/ref/index.md'])),
    'docs/ref/index.md',
  )
})

test('malformed %zz encoding does not throw and decodes leniently', () => {
  assertMd(resolveInternal('docs/a.md', '%zz.md', fs(['docs/%zz.md'])), 'docs/%zz.md')
})

test('a %zz fragment is preserved without throwing', () => {
  assertMd(
    resolveInternal('docs/a.md', 'notes.md#%zz', fs(['docs/notes.md'])),
    'docs/notes.md',
    '%zz',
  )
})

test('multi-# fragment keeps the inner # characters', () => {
  assertMd(
    resolveInternal('docs/a.md', 'notes.md#part1#part2', fs(['docs/notes.md'])),
    'docs/notes.md',
    'part1#part2',
  )
})

test('candidate order: exact name wins over extension variants', () => {
  assertMd(resolveInternal('docs/a.md', 'notes', fs(['docs/notes', 'docs/notes.md'])), 'docs/notes')
})

test('candidate order: literal .md wins over a same-named directory (assignments-migration)', () => {
  assertMd(
    resolveInternal(
      'docs/plans/some.md',
      'assignments-migration',
      fs(['docs/plans/assignments-migration.md', 'docs/plans/assignments-migration/index.md']),
    ),
    'docs/plans/assignments-migration.md',
  )
})

test('candidate order: index.md is tried before README.md', () => {
  assertMd(
    resolveInternal('docs/a.md', 'notes', fs(['docs/notes/index.md', 'docs/notes/README.md'])),
    'docs/notes/index.md',
  )
})

test('unsupported non-markdown extension returns kind unsupported', () => {
  const out = resolveInternal('docs/a.md', 'asset.png', fs([]))
  assert.deepEqual(out, { kind: 'unsupported', target: 'docs/asset.png' })
})

test('genuinely missing md link returns broken', () => {
  assert.deepEqual(resolveInternal('docs/a.md', 'missing.md', fs([])), { kind: 'broken' })
})

test('a fragment-only anchor (no path) resolves as broken', () => {
  assert.deepEqual(resolveInternal('docs/a.md', '#toc', fs([])), { kind: 'broken' })
})
