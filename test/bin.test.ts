import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BIN = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'bin',
  'markdown-reader.mjs',
)

test('bin re-exec resolves tsx from the install dir, not the cwd', async () => {
  // Empty dir: a bare '--import tsx' would fail to resolve here because ESM
  // specifiers on --import resolve against CWD (regression guard).
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mdr-bin-'))
  // Empty PATH hides rg, so after a successful re-exec the child stops at the
  // ripgrep preflight and exits — no server starts either way.
  const res = spawnSync(process.execPath, [BIN], {
    cwd: tmp,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, PATH: '' },
  })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  assert.match(out, /ripgrep/)
  assert.doesNotMatch(out, /ERR_MODULE_NOT_FOUND/)
})
