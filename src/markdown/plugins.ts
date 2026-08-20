import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { resolveInternal } from './links.ts'

export interface Heading {
  level: number
  slug: string
  text: string
}

export interface RenderContext {
  root: string
  fileSet: Set<string>
  currentPath: string
  frontmatterLines: number
  showAllTables: boolean
}

const ROW_LIMIT = 500
const ROW_SHOWN = 200

function addClass(cls: unknown, value: string): string[] {
  const arr = Array.isArray(cls) ? cls.map(String) : typeof cls === 'string' ? [cls] : []
  if (!arr.includes(value)) arr.push(value)
  return arr
}

function hasClass(cls: unknown, value: string): boolean {
  return Array.isArray(cls) ? cls.includes(value) : cls === value
}

export function isMermaidLang(className: unknown): boolean {
  if (Array.isArray(className)) {
    return className.some((c) => String(c).toLowerCase() === 'language-mermaid')
  }
  return String(className ?? '').toLowerCase() === 'language-mermaid'
}

function isMermaidPre(node: Element): boolean {
  return hasClass(node.properties?.className, 'mermaid')
}

export const mermaidPlugin: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'pre' || !parent || index === undefined) return
    const code = node.children?.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'code',
    )
    if (!code) return
    if (!isMermaidLang(code.properties?.className)) return
    const text = toString(code)
    const replacement: Element = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['mermaid'], 'data-src': text },
      children: [{ type: 'text', value: text }],
      position: node.position,
    }
    parent.children[index] = replacement
  })
}

const copyButton = (): Element => ({
  type: 'element',
  tagName: 'button',
  properties: { type: 'button', className: ['copy-btn'], 'aria-label': 'Copy code' },
  children: [{ type: 'text', value: 'Copy' }],
})

export function codeBlockPlugin(highlighted: boolean): Plugin<[], Root> {
  return () => (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'figure') {
        const isPrettyCode =
          node.properties?.['data-rehype-pretty-code-figure'] !== undefined ||
          node.properties?.dataRehypePrettyCodeFigure !== undefined
        if (!isPrettyCode) return
        const pre = node.children?.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'pre',
        )
        const lang = String(pre?.properties?.['data-language'] ?? 'text')
        node.properties = {
          ...(node.properties ?? {}),
          className: addClass(node.properties.className, 'code-block'),
          'data-lang': lang,
        }
        if (node.position?.start?.line) {
          node.properties['data-line'] = String(node.position.start.line)
        }
        removeEmptyLineMarkers(node)
        node.children.unshift(copyButton())
        return
      }
      if (node.tagName !== 'pre') return
      if (!parent || index === undefined) return
      if (parent.type === 'element' && parent.tagName === 'figure') return
      if (isMermaidPre(node)) return
      const code = node.children?.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      )
      const langs = Array.isArray(code?.properties?.className) ? code?.properties?.className : []
      const lang = String(
        (langs.find((c) => c.startsWith('language-')) ?? 'text').replace(/^language-/, ''),
      )
      const wrap: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: addClass([], 'code-block').concat(highlighted ? [] : ['plain']),
          'data-lang': lang,
        },
        children: [copyButton(), node],
        position: node.position,
      }
      parent.children[index] = wrap
    })
  }
}

function removeEmptyLineMarkers(figure: Element): void {
  visit(figure, 'element', (el) => {
    if (el.tagName === 'span' && el.properties) {
      delete el.properties['data-line']
      delete el.properties.dataLine
    }
  })
}

export function tablePlugin(showAllTables: boolean): Plugin<[], Root> {
  return () => (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return
      const rows: { row: Element; parent: Element; index: number }[] = []
      visit(node, 'element', (el, elIndex, elParent) => {
        if (
          el.tagName === 'tr' &&
          elParent &&
          elParent.type === 'element' &&
          elIndex !== undefined
        ) {
          rows.push({ row: el, parent: elParent, index: elIndex })
        }
      })
      node.properties = { ...(node.properties ?? {}), 'data-rows': String(rows.length) }
      if (rows.length > ROW_LIMIT && !showAllTables) {
        for (let i = rows.length - 1; i >= ROW_SHOWN; i--) {
          const { parent: rowParent, index: rowIndex } = rows[i]
          rowParent.children.splice(rowIndex, 1)
        }
      }
      const wrap: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
        position: node.position,
      }
      if (rows.length > ROW_LIMIT && !showAllTables) {
        wrap.children.push({
          type: 'element',
          tagName: 'button',
          properties: { type: 'button', className: ['table-show-all'] },
          children: [{ type: 'text', value: `Show all ${rows.length} rows` }],
        })
      }
      parent.children[index] = wrap
    })
  }
}

export function internalLinksPlugin(
  ctx: Pick<RenderContext, 'root' | 'fileSet' | 'currentPath'>,
): Plugin<[], Root> {
  return () => (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return
      const href = String(node.properties?.href ?? '')
      if (/^(https?:|mailto:)/i.test(href)) {
        node.properties.target = '_blank'
        node.properties.rel = ['noopener noreferrer']
        node.properties.className = addClass(node.properties.className, 'external')
        return
      }
      if (href.startsWith('#')) return
      const res = resolveInternal(ctx.currentPath, href, ctx.fileSet)
      if (res.kind === 'md') {
        node.properties.href =
          '?root=' +
          encodeURIComponent(ctx.root) +
          '&path=' +
          encodeURIComponent(res.path) +
          (res.anchor ? '#' + res.anchor : '')
        node.properties['data-internal-path'] = res.path
        if (res.anchor) node.properties['data-anchor'] = res.anchor
      } else if (res.kind === 'above') {
        node.properties['data-internal-path'] = res.rest
        node.properties['data-above'] = String(res.upLevels)
      } else if (res.kind === 'unsupported') {
        node.properties.className = addClass(node.properties.className, 'unsupported-link')
        node.properties.title = 'Unsupported file type'
      } else {
        node.properties.className = addClass(node.properties.className, 'broken-link')
        node.properties.title = 'Broken link'
      }
    })
  }
}

export function dataLinePlugin(frontmatterLines: number): Plugin<[], Root> {
  return () => (tree) => {
    for (const child of tree.children) {
      if (child.type !== 'element') continue
      const line = child.position?.start?.line
      if (line) {
        child.properties = {
          ...(child.properties ?? {}),
          'data-line': String(line + frontmatterLines),
        }
      }
    }
  }
}

export function headingsPlugin(sink: Heading[]): Plugin<[], Root> {
  return () => (tree) => {
    visit(tree, 'element', (node) => {
      if (!/^h[1-4]$/.test(node.tagName)) return
      const level = Number(node.tagName[1])
      const slug = String(node.properties?.id ?? '')
      sink.push({ level, slug, text: toString(node) })
    })
  }
}

const CALLOUT_TYPES: Record<string, string> = {
  NOTE: 'note',
  TIP: 'tip',
  WARNING: 'warning',
  IMPORTANT: 'important',
  CAUTION: 'caution',
}

export const calloutPlugin: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node) => {
    if (node.tagName !== 'blockquote') return
    const first = node.children?.find((c): c is Element => c.type === 'element')
    if (!first || first.tagName !== 'p') return
    const head = first.children?.[0]
    if (head?.type !== 'text') return
    const m = /^\[!\s*([A-Z]+)\s*\](?:\s|$)/i.exec(head.value)
    if (!m) return
    const cls = CALLOUT_TYPES[m[1].toUpperCase()]
    if (!cls) return
    const rest = head.value.slice(m[0].length)
    const label = m[1][0] + m[1].slice(1).toLowerCase()
    node.properties = {
      ...(node.properties ?? {}),
      className: addClass(node.properties?.className, 'callout').concat([`callout-${cls}`]),
    }
    if (rest.trim() === '') {
      node.children = node.children.filter((c) => c !== first)
    } else {
      head.value = rest
    }
    node.children.unshift({
      type: 'element',
      tagName: 'div',
      properties: { className: ['callout-title'] },
      children: [{ type: 'text', value: label }],
    })
  })
}
