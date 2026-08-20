export type Resolved =
  | { kind: 'md'; path: string; anchor?: string }
  | { kind: 'above'; upLevels: number; rest: string }
  | { kind: 'unsupported'; target: string }
  | { kind: 'broken' }

const dec = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function normalizeJoin(base: string, rel: string): string {
  const parts = (base ? base.split('/') : []).concat(rel.split('/'))
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop()
        continue
      }
      out.push('..')
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

export function resolveInternal(currentPath: string, href: string, fileSet: Set<string>): Resolved {
  const [rawPath, ...rest] = href.split('#')
  const anchor = rest.length ? dec(rest.join('#')) : undefined
  if (!rawPath) return { kind: 'broken' }
  const base = currentPath.includes('/') ? currentPath.replace(/\/[^/]*$/, '') : ''
  const abs = rawPath.startsWith('/')
  let joined = normalizeJoin(abs ? '' : base, dec(rawPath)).replace(/\/+$/, '')
  if (joined === '.' || joined === '') joined = ''
  if (joined === '..' || joined.startsWith('../')) {
    const up = joined.split('/').filter((s) => s === '..').length
    return { kind: 'above', upLevels: up, rest: joined.replace(/^(\.\.\/)+/, '') }
  }
  const cands = joined
    ? [joined, `${joined}.md`, `${joined}/index.md`, `${joined}/README.md`]
    : ['index.md', 'README.md']
  for (const c of cands) if (fileSet.has(c)) return { kind: 'md', path: c, anchor }
  if (/\.[a-z0-9]{1,6}$/i.test(joined) && !/\.(md|markdown)$/i.test(joined))
    return { kind: 'unsupported', target: joined }
  return { kind: 'broken' }
}
