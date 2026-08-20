export interface ParsedFrontmatterClient {
  content: string
  frontmatter: Record<string, unknown> | null
  frontmatterLines: number
}

function parseYamlLike(block: string): Record<string, unknown> | null {
  const data: Record<string, unknown> = {}
  let hasAny = false
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    if (!key) continue
    let val: string = line.slice(colon + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1)
    }
    // Try JSON parse for numbers/booleans/null, otherwise keep string
    let parsed: unknown = val
    if (val === 'true') parsed = true
    else if (val === 'false') parsed = false
    else if (val === 'null' || val === '~') parsed = null
    else if (val !== '' && !Number.isNaN(Number(val)) && /^[-+]?\d+(\.\d+)?$/.test(val)) {
      parsed = Number(val)
    } else if (
      (val.startsWith('[') && val.endsWith(']')) ||
      (val.startsWith('{') && val.endsWith('}'))
    ) {
      try {
        parsed = JSON.parse(val)
      } catch {
        parsed = val
      }
    }
    data[key] = parsed
    hasAny = true
  }
  return hasAny ? data : null
}

export function parseFrontmatterClient(raw: string): ParsedFrontmatterClient {
  if (!raw.startsWith('---')) {
    return { content: raw, frontmatter: null, frontmatterLines: 0 }
  }
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd === -1) {
    return { content: raw, frontmatter: null, frontmatterLines: 0 }
  }
  const firstLine = raw.slice(0, firstLineEnd).trim()
  if (firstLine !== '---') {
    return { content: raw, frontmatter: null, frontmatterLines: 0 }
  }
  const rest = raw.slice(firstLineEnd + 1)
  const lines = rest.split('\n')
  let closeIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') {
      closeIndex = i
      break
    }
    // Limit scan to avoid pathological files
    if (i > 500) break
  }
  if (closeIndex === -1) {
    return { content: raw, frontmatter: null, frontmatterLines: 0 }
  }
  const fmBlock = lines.slice(0, closeIndex).join('\n')
  const frontmatter = parseYamlLike(fmBlock)
  const frontmatterLines = closeIndex + 2 // opening --- line + block lines + closing --- line
  const content = lines.slice(closeIndex + 1).join('\n')
  // Match server behavior: if raw.length === parsed.content.length then 0, else count.
  // Our frontmatterLines already counts correctly; return content without leading newline quirk.
  return { content, frontmatter, frontmatterLines }
}
