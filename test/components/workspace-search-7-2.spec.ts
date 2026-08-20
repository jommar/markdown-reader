import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspace } from '../../src/stores/workspace'

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

beforeEach(() => {
  const meta = document.createElement('meta')
  meta.name = 'mdr-token'
  meta.content = 'test-token'
  document.head.appendChild(meta)
})

describe('Workspace search debounce + AbortController', () => {
  test('debounced 250ms: rapid search calls only fire last query', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.root = '/r'
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results: [{ path: 'a.md', matches: [] }], truncated: false, elapsedMs: 0 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    ws.search('first', 'content', false)
    ws.search('second', 'content', false)
    // before 250ms, no fetch yet
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    // after debounce, only one fetch with second query
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('q=second')
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="mdr-token"]')?.remove()
  })

  test('AbortController prevents stale overwrite: first slow, second fast', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.root = '/r'
    let firstResolve: (v: Response) => void
    let secondResolve: (v: Response) => void
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        if (signal)
          signal.addEventListener('abort', () => {
            const e = new Error('AbortError')
            ;(e as Error & { name: string }).name = 'AbortError'
            reject(e)
          })
        if (String(url).includes('q=first')) firstResolve = resolve as any
        else if (String(url).includes('q=second')) secondResolve = resolve as any
        else resolve(jsonResponse({ results: [], truncated: false, elapsedMs: 0 }))
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    ws.search('first', 'content', false)
    await vi.advanceTimersByTimeAsync(250)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // start second search before first resolves
    ws.search('second', 'content', false)
    await vi.advanceTimersByTimeAsync(250)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // resolve second first (fast)
    secondResolve!(
      jsonResponse({
        results: [{ path: 'second.md', matches: [] }],
        truncated: false,
        elapsedMs: 0,
      }),
    )
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    // need to flush microtasks
    await vi.advanceTimersByTimeAsync(0)
    expect(ws.searchResults.map((r) => r.path)).toEqual(['second.md'])

    // now first resolves slowly – should NOT overwrite
    firstResolve!(
      jsonResponse({
        results: [{ path: 'first.md', matches: [] }],
        truncated: false,
        elapsedMs: 0,
      }),
    )
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    expect(ws.searchResults.map((r) => r.path)).toEqual(['second.md'])

    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="mdr-token"]')?.remove()
  })

  test('500-char windowed snippet + truncated + large query does not crash', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const ws = useWorkspace()
    ws.root = '/r'
    // simulate truncated response with 200 files (the -> 913 but capped 200)
    const many = Array.from({ length: 200 }, (_, i) => ({
      path: `docs/file-${i}.md`,
      matches: [
        {
          line: 1,
          text: 'hello the world',
          ranges: [[6, 9]] as [number, number][],
          prefixTruncated: false,
          suffixTruncated: false,
        },
      ],
    }))
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: many,
        truncated: true,
        elapsedMs: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    ws.search('the', 'content', false)
    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(ws.searchTruncated).toBe(true)
    expect(ws.searchResults.length).toBe(200)
    // windowed snippet length should be <=500 as per server (simulate already windowed)
    expect(ws.searchResults[0].matches[0].text.length).toBeLessThanOrEqual(500)
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="mdr-token"]')?.remove()
  })
})
