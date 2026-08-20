import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useHistory } from '../src/stores/history.ts'

function installStorage(): void {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(i) {
      return [...store.keys()][i] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  })
}

function fresh() {
  setActivePinia(createPinia())
  return useHistory()
}

test('record inserts an entry with pinned=false and moves it to the front', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.record('/r', 'b.md')
  h.record('/r', 'a.md')
  assert.equal(h.entries.length, 2)
  assert.equal(h.entries[0].path, 'a.md')
  assert.equal(h.entries[0].pinned, false)
  assert.ok(h.entries[0].lastOpened >= h.entries[1].lastOpened)
})

test('same path under different roots are distinct entries', () => {
  installStorage()
  const h = fresh()
  h.record('/r1', 'a.md')
  h.record('/r2', 'a.md')
  assert.equal(h.entries.length, 2)
})

test('pinned sorts first and independently of recency', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'old-pinned.md')
  h.togglePin('/r', 'old-pinned.md')
  h.record('/r', 'new-recent.md')
  assert.deepEqual(
    h.pinned.map((e) => e.path),
    ['old-pinned.md'],
  )
  assert.deepEqual(
    h.recent.map((e) => e.path),
    ['new-recent.md'],
  )
})

test('togglePin flips the pinned flag', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.togglePin('/r', 'a.md')
  assert.equal(h.entries[0].pinned, true)
  h.togglePin('/r', 'a.md')
  assert.equal(h.entries[0].pinned, false)
})

test('pinInRoot pins an existing entry or creates one pinned', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.pinInRoot('/r', 'a.md')
  assert.equal(h.entries[0].pinned, true)
  assert.equal(h.isPinned('/r', 'a.md'), true)
  h.pinInRoot('/r', 'b.md')
  assert.equal(h.entries.length, 2)
  const b = h.entries.find((e) => e.path === 'b.md')
  assert.equal(b!.pinned, true)
  h.pinInRoot('/r', 'a.md')
  assert.equal(h.entries[0].pinned, false)
  assert.equal(h.isPinned('/r', 'a.md'), false)
})

test('isPinned distinguishes roots and unpinned entries', () => {
  installStorage()
  const h = fresh()
  h.record('/r1', 'a.md')
  h.record('/r2', 'a.md')
  h.pinInRoot('/r1', 'a.md')
  assert.equal(h.isPinned('/r1', 'a.md'), true)
  assert.equal(h.isPinned('/r2', 'a.md'), false)
  h.record('/r1', 'other.md')
  assert.equal(h.isPinned('/r1', 'other.md'), false)
})

test('pinnedPaths returns only pinned paths for the given root', () => {
  installStorage()
  const h = fresh()
  h.pinInRoot('/r1', 'a.md')
  h.record('/r1', 'b.md')
  h.pinInRoot('/r2', 'a.md')
  const set = h.pinnedPaths('/r1')
  assert.deepEqual([...set].sort(), ['a.md'])
  assert.deepEqual([...h.pinnedPaths('/r2')], ['a.md'])
})

test('remove deletes only that root/path and surfaces an undo toast', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.record('/r', 'b.md')
  h.remove('/r', 'a.md')
  assert.deepEqual(
    h.entries.map((e) => e.path),
    ['b.md'],
  )
  assert.ok(h.toast)
  assert.equal(h.toast!.entry.path, 'a.md')
})

test('undoRemove restores the last removed entry', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.remove('/r', 'a.md')
  assert.equal(h.entries.length, 0)
  h.undoRemove()
  assert.deepEqual(
    h.entries.map((e) => e.path),
    ['a.md'],
  )
  assert.equal(h.toast, null)
})

test('unpinned cap evicts oldest unpinned but never pinned', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'pinned.md')
  h.togglePin('/r', 'pinned.md')
  for (let i = 1; i <= 105; i++) h.record('/r', `f${i}.md`)
  assert.ok(h.entries.some((e) => e.path === 'pinned.md'))
  assert.equal(h.entries.filter((e) => !e.pinned).length, 100)
  const kept = h.recent.map((e) => e.path)
  assert.ok(kept.includes('f105.md'))
  assert.ok(!kept.includes('f1.md'))
})

test('prune drops entries whose path is absent from the fileSet for the given root', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.record('/r', 'ghost.md')
  h.record('/other', 'a.md')
  h.prune('/r', new Set(['a.md']))
  assert.deepEqual(
    h.entries.map((e) => e.path),
    ['a.md', 'a.md'],
  )
  assert.equal(h.entries.filter((e) => e.root === '/r').length, 1)
})

test('prune keeps entries from other roots untouched', () => {
  installStorage()
  const h = fresh()
  h.record('/r', 'a.md')
  h.record('/other', 'b.md')
  h.prune('/r', new Set([]))
  assert.deepEqual(
    h.entries.map((e) => e.path),
    ['b.md'],
  )
})

test('persist/restore round-trips entries', () => {
  installStorage()
  const first = fresh()
  first.record('/r', 'a.md')
  first.togglePin('/r', 'a.md')
  first.record('/r', 'b.md')
  first.flushPersist()

  const second = fresh()
  assert.equal(second.entries.length, 2)
  const a = second.entries.find((e) => e.path === 'a.md')
  assert.ok(a)
  assert.equal(a!.pinned, true)
})

test('corrupt JSON recovers to an empty history', () => {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(i) {
      return [...store.keys()][i] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  })
  localStorage.setItem('markdown-reader:history:v1', '{not valid json')
  const h = fresh()
  assert.deepEqual(h.entries, [])
})

test('non-matching entries are filtered out on load', () => {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(i) {
      return [...store.keys()][i] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  })
  localStorage.setItem(
    'markdown-reader:history:v1',
    JSON.stringify({
      entries: [
        { root: '/r', path: 'ok.md', lastOpened: 1, pinned: false },
        { root: '/r', path: 'bad.md', lastOpened: 'nope', pinned: false },
        { root: '/r', path: 'nopin.md', lastOpened: 2 },
      ],
    }),
  )
  const h = fresh()
  assert.deepEqual(
    h.entries.map((e) => e.path),
    ['ok.md'],
  )
})
