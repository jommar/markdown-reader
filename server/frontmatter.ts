import matter from 'gray-matter'

export interface ParsedFrontmatter {
  content: string
  frontmatter: Record<string, unknown> | null
  frontmatterLines: number
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const parsed = matter(raw)
  const frontmatterLines =
    raw.length === parsed.content.length
      ? 0
      : raw.slice(0, raw.length - parsed.content.length).split('\n').length - 1
  return {
    content: parsed.content,
    frontmatter:
      parsed.data && Object.keys(parsed.data).length > 0
        ? (parsed.data as Record<string, unknown>)
        : null,
    frontmatterLines,
  }
}
