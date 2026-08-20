import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeLine, searchFiles } from '../server/search.ts'

test('byte→char: multibyte héllo/wörld offset converts bytes to char index', () => {
  const { text, toChar } = decodeLine({ text: 'héllo wörld TARGET' })
  assert.equal(text, 'héllo wörld TARGET')
  assert.equal(toChar(14), 12)
})

test('byte→char: multibyte CJK each char is 3 bytes', () => {
  const { text, toChar } = decodeLine({ text: '日本語' })
  assert.equal(text, '日本語')
  assert.equal(toChar(3), 1)
  assert.equal(toChar(6), 2)
  assert.equal(toChar(9), 3)
})

test('byte→char: an invalid-UTF-8 line decoded from base64', () => {
  const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff, 0x0a])
  const { text, toChar } = decodeLine({ bytes: buf.toString('base64') })
  assert.equal(text, 'Hello\uFFFD')
  assert.equal(toChar(6), 6)
})

test('mode=files: returns files whose path contains the query as a subsequence', () => {
  const files = [
    'docs/review/overview.md',
    'docs/review/index.md',
    'docs/other/notes.md',
    'README.md',
  ]
  const res = searchFiles(files, 'review', 100)
  assert.ok(res.length >= 1)
  assert.ok(res.every((r) => r.path.includes('review')))
  assert.ok(res.some((r) => r.path === 'docs/review/overview.md'))
})

test('mode=files: an unmatched query returns no results, not an error', () => {
  const res = searchFiles(['docs/a.md', 'README.md'], 'zzqqxx', 100)
  assert.deepEqual(res, [])
})

test('mode=files: respects the top-100 limit', () => {
  const files = Array.from({ length: 150 }, (_, i) => `docs/f${i}/mark.md`)
  const res = searchFiles(files, 'mark', 100)
  assert.equal(res.length, 100)
})
