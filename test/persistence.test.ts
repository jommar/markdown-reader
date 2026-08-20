import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useTabs } from '../src/stores/tabs.ts'
import { useWorkspace } from '../src/stores/workspace.ts'

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

function fresh(root: string, files: string[]): { tabs: ReturnType<typeof useTabs> } {
  setActivePinia(createPinia())
  const ws = useWorkspace()
  ws.root = root
  ws.files = files
  return { tabs: useTabs() }
}

test('persist/restore round-trips tabs, activeId, index, and per-entry scrollTop', () => {
  installStorage()
  const first = fresh('/r', ['a.md', 'b.md', 'c.md'])
  first.tabs.navigate('a.md')
  first.tabs.navigate('b.md')
  first.tabs.navigate('c.md')
  const tabA = first.tabs.tabs[0]
  tabA.entries[0].scrollTop = 40
  tabA.entries[1].scrollTop = 120
  tabA.entries[2].scrollTop = 300
  first.tabs.openInNewTab('a.md')
  first.tabs.tabs[1].entries[0].scrollTop = 55
  first.tabs.flushPersist()

  const second = fresh('/r', ['a.md', 'b.md', 'c.md'])
  const saved = second.tabs.loadSaved()
  assert.ok(saved)
  assert.equal(saved.root, '/r')
  assert.equal(saved.tabs.length, 2)
  assert.deepEqual(
    saved.tabs.map((t) => ({ count: t.entries.length, index: t.index })),
    [
      { count: 3, index: 2 },
      { count: 1, index: 0 },
    ],
  )
  const savedActive = saved.tabs.find((t) => t.id === saved.activeId)
  assert.ok(savedActive)
  assert.equal(savedActive.entries.length, 1)
  assert.equal(savedActive.entries[0].path, 'a.md')

  assert.equal(second.tabs.restore(saved), true)
  assert.equal(second.tabs.tabs.length, 2)
  assert.equal(second.tabs.activeId, savedActive.id)
  const restoredA = second.tabs.tabs[0]
  assert.equal(restoredA.index, 2)
  assert.deepEqual(
    restoredA.entries.map((e) => e.path),
    ['a.md', 'b.md', 'c.md'],
  )
  assert.deepEqual(
    restoredA.entries.map((e) => e.scrollTop),
    [40, 120, 300],
  )
  const restoredB = second.tabs.tabs[1]
  assert.equal(restoredB.entries.length, 1)
  assert.equal(restoredB.entries[0].path, 'a.md')
  assert.equal(restoredB.entries[0].scrollTop, 55)
})

test('restore prunes entries absent from fileSet and clamps the index', () => {
  installStorage()
  const first = fresh('/r', ['a.md', 'ghost.md', 'b.md'])
  first.tabs.navigate('a.md')
  first.tabs.navigate('ghost.md')
  first.tabs.navigate('b.md')
  first.tabs.tabs[0].entries[1].scrollTop = 20
  first.tabs.tabs[0].entries[2].scrollTop = 30
  first.tabs.flushPersist()

  const second = fresh('/r', ['a.md', 'b.md', 'c.md'])
  const saved = second.tabs.loadSaved()
  assert.ok(saved)
  assert.equal(second.tabs.restore(saved), true)
  assert.equal(second.tabs.tabs.length, 1)
  const t = second.tabs.tabs[0]
  assert.deepEqual(
    t.entries.map((e) => e.path),
    ['a.md', 'b.md'],
  )
  assert.equal(t.index, 1)
  assert.equal(t.entries[1].scrollTop, 30)
})

test('restore returns false when every tab prunes entirely', () => {
  installStorage()
  const first = fresh('/r', ['ghost.md', 'ghost2.md'])
  first.tabs.navigate('ghost.md')
  first.tabs.openInNewTab('ghost2.md')
  first.tabs.flushPersist()

  const second = fresh('/r', ['a.md'])
  const saved = second.tabs.loadSaved()
  assert.ok(saved)
  assert.equal(second.tabs.restore(saved), false)
  assert.equal(second.tabs.tabs.length, 0)
})

test('restore returns false when the saved root mismatches the workspace root', () => {
  installStorage()
  const first = fresh('/r', ['a.md'])
  first.tabs.navigate('a.md')
  first.tabs.flushPersist()

  const second = fresh('/other', ['a.md'])
  const saved = second.tabs.loadSaved()
  assert.ok(saved)
  assert.equal(saved.root, '/r')
  assert.equal(second.tabs.restore(saved), false)
})

test('restore falls back activeId when the active tab prunes entirely', () => {
  installStorage()
  const first = fresh('/r', ['a.md', 'ghost.md'])
  first.tabs.navigate('a.md')
  first.tabs.openInNewTab('ghost.md')
  first.tabs.flushPersist()

  const second = fresh('/r', ['a.md'])
  const saved = second.tabs.loadSaved()
  assert.ok(saved)
  assert.equal(second.tabs.restore(saved), true)
  assert.equal(second.tabs.tabs.length, 1)
  assert.equal(second.tabs.tabs[0].entries[0].path, 'a.md')
  assert.equal(second.tabs.activeId, second.tabs.tabs[0].id)
})
