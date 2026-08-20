import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { safeJoin } from '../server/safe-path.ts'

async function makeRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mdr-safejoin-'))
}

async function expect403(promise: Promise<string>): Promise<void> {
  await assert.rejects(promise, (err: Error & { status?: number }) => {
    assert.equal(err.status, 403)
    return true
  })
}

test('returns the absolute path for an existing file inside the root', async () => {
  const root = await makeRoot()
  await fs.writeFile(path.join(root, 'a.md'), '# hi')
  const abs = await safeJoin(root, 'a.md')
  assert.equal(abs, path.join(root, 'a.md'))
})

test('does not throw for a non-existent path that stays inside the root', async () => {
  const root = await makeRoot()
  await fs.mkdir(path.join(root, 'sub'))
  const abs = await safeJoin(root, 'sub/missing.md')
  assert.equal(abs, path.join(root, 'sub', 'missing.md'))
})

test('rejects a lexical traversal out of the root (../../etc/passwd)', async () => {
  const root = await makeRoot()
  await expect403(safeJoin(root, '../../etc/passwd'))
})

test('rejects a sibling path sharing the root prefix (path.sep boundary)', async () => {
  const root = await makeRoot()
  const sibling = `${root}-other`
  await fs.mkdir(sibling)
  await fs.writeFile(path.join(sibling, 'x.md'), '# hi')
  await expect403(safeJoin(root, `../${path.basename(root)}-other/x.md`))
})

test('rejects a path whose realpath escapes via a symlinked file', async () => {
  const root = await makeRoot()
  await fs.symlink('/etc/passwd', path.join(root, 'esc.md'))
  await expect403(safeJoin(root, 'esc.md'))
})

test('rejects a path descending through a symlinked directory that escapes', async () => {
  const root = await makeRoot()
  await fs.symlink('/etc', path.join(root, 'out'))
  await expect403(safeJoin(root, 'out/passwd'))
})

test('accepts a symlink whose target stays inside the root', async () => {
  const root = await makeRoot()
  await fs.writeFile(path.join(root, 'real.md'), '# hi')
  await fs.symlink(path.join(root, 'real.md'), path.join(root, 'link.md'))
  const abs = await safeJoin(root, 'link.md')
  assert.equal(abs, path.join(root, 'link.md'))
})
