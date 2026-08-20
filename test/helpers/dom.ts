import { Window } from 'happy-dom'

export function setupDom(): void {
  if (globalThis.window && globalThis.document) return
  const w = new Window()
  Object.defineProperty(w.Node.prototype, 'nodeName', {
    get() {
      const t = (this as { tagName?: string }).tagName
      if (t) return String(t).toUpperCase()
      const nt = (this as { nodeType?: number }).nodeType
      if (nt === 9) return '#document'
      if (nt === 11) return '#document-fragment'
      if (nt === 3) return '#text'
      return ''
    },
    configurable: true,
  })
  globalThis.window = w
  globalThis.document = w.document
}

setupDom()
