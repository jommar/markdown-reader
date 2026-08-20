import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'
import { sanitizeHtml } from './sanitize.ts'
import { parseFrontmatterClient } from './frontmatter.client.ts'
import type { FileResult } from '../../server/types.ts'
import {
  calloutPlugin,
  codeBlockPlugin,
  dataLinePlugin,
  headingsPlugin,
  internalLinksPlugin,
  mermaidPlugin,
  tablePlugin,
  type Heading,
  type RenderContext,
} from './plugins.ts'

export type { Heading }

export interface RenderedDoc {
  html: string
  headings: Heading[]
  frontmatter: Record<string, unknown> | null
  hasMermaid: boolean
  highlightingSkipped: boolean
}

function buildProcessor(ctx: RenderContext, headings: Heading[], opts: { highlighting: boolean }) {
  let processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(mermaidPlugin)
    .use(rehypeSlug)

  if (opts.highlighting) {
    processor = processor.use(rehypePrettyCode, {
      theme: { light: 'github-light', dark: 'github-dark' },
      keepBackground: false,
    })
  }

  return processor
    .use(codeBlockPlugin(opts.highlighting))
    .use(tablePlugin(ctx.showAllTables))
    .use(internalLinksPlugin(ctx))
    .use(dataLinePlugin(ctx.frontmatterLines))
    .use(headingsPlugin(headings))
    .use(calloutPlugin)
    .use(rehypeStringify, { allowDangerousHtml: true })
}

export async function renderDocument(
  file: FileResult,
  ctx: { root: string; fileSet: Set<string> },
  opts?: { showAllTables?: boolean },
): Promise<RenderedDoc> {
  const headings: Heading[] = []
  const highlighting = file.content.length <= 200_000
  const renderCtx: RenderContext = {
    root: ctx.root,
    fileSet: ctx.fileSet,
    currentPath: file.path,
    frontmatterLines: file.frontmatterLines,
    showAllTables: opts?.showAllTables === true,
  }
  const processor = buildProcessor(renderCtx, headings, { highlighting })
  const result = await processor.process(file.content)
  const hasMermaid = /```+\s*mermaid/i.test(file.content) || /~~~+\s*mermaid/i.test(file.content)
  return {
    html: sanitizeHtml(result.toString()),
    headings,
    frontmatter: file.frontmatter,
    hasMermaid,
    highlightingSkipped: !highlighting,
  }
}

export async function renderRawMarkdown(
  raw: string,
  opts?: { showAllTables?: boolean },
): Promise<RenderedDoc> {
  const { content, frontmatter, frontmatterLines } = parseFrontmatterClient(raw)
  const headings: Heading[] = []
  const highlighting = content.length <= 200_000
  const renderCtx: RenderContext = {
    root: '',
    fileSet: new Set<string>(),
    currentPath: '',
    frontmatterLines,
    showAllTables: opts?.showAllTables === true,
  }
  const processor = buildProcessor(renderCtx, headings, { highlighting })
  const result = await processor.process(content)
  const hasMermaid = /```+\s*mermaid/i.test(content) || /~~~+\s*mermaid/i.test(content)
  return {
    html: sanitizeHtml(result.toString()),
    headings,
    frontmatter,
    hasMermaid,
    highlightingSkipped: !highlighting,
  }
}
