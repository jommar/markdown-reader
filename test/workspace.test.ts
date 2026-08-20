import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspace } from '../src/stores/workspace.ts'

test('dialogOpen defaults to false and is settable', () => {
  setActivePinia(createPinia())
  const ws = useWorkspace()
  assert.equal(ws.dialogOpen, false)
  ws.dialogOpen = true
  assert.equal(ws.dialogOpen, true)
})
