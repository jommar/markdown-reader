import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useTabs } from '../src/stores/tabs.ts'
import { useWorkspace } from '../src/stores/workspace.ts'

function fresh(): ReturnType<typeof useTabs> {
  setActivePinia(createPinia())
  useWorkspace()
  return useTabs()
}

test('evict: 600 sequential navigations keep entries[0], a defined current entry, and a valid index', () => {
  const tabs = fresh()
  for (let i = 0; i < 600; i++) tabs.navigate(`docs/file-${i}.md`)
  assert.equal(tabs.tabs[0].entries[0].path, 'docs/file-0.md')
  assert.ok(tabs.currentEntry, 'currentEntry must be defined')
  assert.ok(tabs.tabs[0].index >= 0 && tabs.tabs[0].index < tabs.tabs[0].entries.length)
})

test('titles: colliding basenames are disambiguated to distinct titles', () => {
  const tabs = fresh()
  tabs.openInNewTab('.claude/agents/qa.md')
  tabs.openInNewTab('.opencode/agents/qa.md')
  tabs.openInNewTab('docs/reference/commands.md')
  tabs.openInNewTab('docs/other/commands.md')
  const t = tabs.titles()
  assert.equal(new Set(t).size, t.length)
  assert.ok(t[0].endsWith('.claude/agents/qa.md'))
  assert.ok(t[1].endsWith('.opencode/agents/qa.md'))
  assert.notEqual(t[0], t[1])
})
