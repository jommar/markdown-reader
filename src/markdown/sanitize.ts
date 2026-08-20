import DOMPurify from 'dompurify'

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: [
      'data-line',
      'data-internal-path',
      'data-anchor',
      'data-src',
      'data-lang',
      'data-rendered',
      'target',
    ],
    ALLOW_DATA_ATTR: true,
  })
}
