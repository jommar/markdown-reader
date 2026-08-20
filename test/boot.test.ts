import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideBoot, savedActivePath, type BootDecision } from '../src/boot.ts'
import type { SavedSession } from '../src/stores/tabs.ts'
import type { ParsedUrl } from '../src/composables/useUrlSync.ts'

const session = (over: Partial<SavedSession> = {}): SavedSession => ({
  root: '/r',
  activeId: 't1',
  tabs: [
    {
      id: 't1',
      index: 1,
      entries: [
        { root: '/r', path: 'a.md', scrollTop: 40 },
        { root: '/r', path: 'b.md', scrollTop: 120 },
      ],
    },
  ],
  ...over,
})

function decide(
  url: ParsedUrl,
  saved: SavedSession | null,
  initial: { root: string; initialPath?: string } | null = null,
): BootDecision {
  return decideBoot({ url, saved, initial })
}

test('savedActivePath resolves the active entry path via activeId/index', () => {
  assert.equal(savedActivePath(session()), 'b.md')
})

test('savedActivePath returns undefined when the active tab is unresolvable', () => {
  assert.equal(savedActivePath(session({ activeId: 'ghost' })), undefined)
  assert.equal(savedActivePath(session({ tabs: [] })), undefined)
  assert.equal(savedActivePath(session({ tabs: [{ id: 't1', index: 5, entries: [] }] })), undefined)
})

test('URL wins over CLI initial: a mirror-URL path restores the saved session', () => {
  const url: ParsedUrl = { root: '/r', path: 'b.md' }
  const saved = session()
  const initial = { root: '/cli', initialPath: 'cli.md' }
  assert.equal(decide(url, saved, initial).kind, 'restore')
})

test('URL wins over CLI initial: a differing-path URL deep-links instead of initialPath', () => {
  const url: ParsedUrl = { root: '/r', path: 'c.md', anchor: 'sec' }
  const saved = session()
  const initial = { root: '/cli', initialPath: 'cli.md' }
  assert.deepEqual(decide(url, saved, initial), {
    kind: 'open',
    root: '/r',
    path: 'c.md',
    anchor: 'sec',
  })
})

test('CLI initial with no initialPath opens the root without navigation', () => {
  assert.deepEqual(decide({}, null, { root: '/cli' }), { kind: 'open', root: '/cli' })
})

test('CLI initial navigates initialPath when no URL or session is present', () => {
  const initial = { root: '/cli', initialPath: 'cli.md' }
  assert.deepEqual(decide({}, null, initial), {
    kind: 'open',
    root: '/cli',
    path: 'cli.md',
  })
})

test('CLI initial lands even when a session for another root is saved', () => {
  const saved = session()
  const initial = { root: '/cli', initialPath: 'cli.md' }
  assert.deepEqual(decide({}, saved, initial), {
    kind: 'open',
    root: '/cli',
    path: 'cli.md',
  })
})

test('mirror URL (same root, path equal to active path) restores without navigating', () => {
  const url: ParsedUrl = { root: '/r', path: 'b.md' }
  const saved = session()
  const d = decide(url, saved)
  assert.equal(d.kind, 'restore')
  if (d.kind === 'restore') assert.equal(d.saved, saved)
})

test('URL root without a path, matching same-root session, restores', () => {
  const url: ParsedUrl = { root: '/r' }
  assert.equal(decide(url, session()).kind, 'restore')
})

test('URL path absent-or-equal never pairs a navigate with the restored active path', () => {
  const active = 'b.md'
  for (const path of [undefined, active]) {
    const d = decide({ root: '/r', path }, session())
    assert.equal(d.kind, 'restore')
  }
})

test('differing-path URL deep-links: open same root and navigate the URL path', () => {
  const d = decide({ root: '/r', path: 'c.md', anchor: 'sec' }, session())
  assert.deepEqual(d, { kind: 'open', root: '/r', path: 'c.md', anchor: 'sec' })
})

test('differing-path URL navigate path never equals the restored active path', () => {
  const active = 'b.md'
  const d = decide({ root: '/r', path: 'c.md' }, session())
  assert.equal(d.kind, 'open')
  if (d.kind === 'open') assert.notEqual(d.path, active)
})

test('URL root with no matching session opens and navigates the URL path when present', () => {
  assert.deepEqual(decide({ root: '/r', path: 'x.md' }, null), {
    kind: 'open',
    root: '/r',
    path: 'x.md',
  })
})

test('URL root with no session and no path opens the root without navigation', () => {
  assert.deepEqual(decide({ root: '/r' }, null), { kind: 'open', root: '/r' })
})

test('no URL or CLI but a saved root restores the session', () => {
  const saved = session()
  const d = decide({}, saved)
  assert.equal(d.kind, 'restore')
  if (d.kind === 'restore') assert.equal(d.saved, saved)
})

test('nothing to open yields none', () => {
  assert.deepEqual(decide({}, null), { kind: 'none' })
})
