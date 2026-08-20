import DOMPurify from 'dompurify'

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['details', 'summary', 'svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'style', 'foreignObject', 'div', 'span'],
    ADD_ATTR: [
      'data-line',
      'data-internal-path',
      'data-anchor',
      'data-src',
      'data-lang',
      'data-rendered',
      'data-error',
      'data-processed',
      'data-zoom',
      'role',
      'aria-label',
      'aria-hidden',
      'target',
      'viewBox',
      'preserveAspectRatio',
      'd',
      'transform',
      'class',
      'style',
    ],
    ALLOW_DATA_ATTR: true,
  })
}
