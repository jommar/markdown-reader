const CONFIG = {
  startOnLoad: false,
  theme: 'dark' as 'dark' | 'default',
  securityLevel: 'strict',
  suppressErrorRendering: true,
  flowchart: { useMaxWidth: false },
  sequence: { useMaxWidth: false },
}

type MermaidModule = {
  initialize: (config: unknown) => void
  run: (options: { nodes: HTMLElement[] }) => Promise<void>
  render: (id: string, text: string) => Promise<{ svg: string }>
  parse?: (text: string) => Promise<boolean>
}

let mermaidPromise: Promise<MermaidModule> | null = null
const sourceCache = new WeakMap<HTMLElement, string>()
let renderCounter = 0

async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mod =
        (m as unknown as { default?: MermaidModule }).default ??
        (m as unknown as MermaidModule)
      return mod
    })
  }
  return mermaidPromise
}

function getSource(el: HTMLElement): string {
  let src = sourceCache.get(el)
  if (src === undefined) {
    // Use hasAttribute to distinguish missing vs empty (empty is valid empty check)
    const raw = el.hasAttribute('data-src') ? el.getAttribute('data-src') : null
    src = raw ?? el.textContent ?? ''
    sourceCache.set(el, src)
  }
  return src
}

function showError(el: HTMLElement, src: string, message: string): void {
  el.textContent = ''
  const err = document.createElement('div')
  err.className = 'mermaid-error text-danger p-2 text-sm'
  err.textContent = message
  el.appendChild(err)
  el.appendChild(document.createTextNode(src))
  el.setAttribute('data-rendered', 'true')
  el.setAttribute('data-error', 'true')
}

export async function renderMermaid(root: HTMLElement, theme: 'dark' | 'light'): Promise<void> {
  const pres = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'))
  if (pres.length === 0) return
  const mmd = await getMermaid()
  const resolvedTheme = theme === 'light' ? 'default' : 'dark'
  // Re-initialize with current theme; mermaid mutates global config
  mmd.initialize({ ...CONFIG, theme: resolvedTheme })
  for (const el of pres) {
    if (!el.isConnected) continue
    const src = getSource(el)
    if (!src.trim()) continue
    el.removeAttribute('data-processed')
    el.removeAttribute('data-rendered')
    el.removeAttribute('data-error')
    // Preserve raw source as text until we have SVG; mermaid.render does not need DOM text
    el.textContent = src
    // Prefer render(id, text) which is the stable string-in/svg-out path (same as VSCode)
    // and avoids run({nodes}) detached-node getAttribute(null) race.
    const id = `mermaid-${Date.now()}-${renderCounter++}`
    try {
      if (typeof mmd.render === 'function') {
        const { svg } = await mmd.render(id, src)
        // Guard again after await — el may have been replaced by Vue patch
        if (!el.isConnected) continue
        el.innerHTML = svg
        el.setAttribute('data-rendered', 'true')
      } else {
        await mmd.run({ nodes: [el] })
        if (!el.isConnected) continue
        el.setAttribute('data-rendered', 'true')
      }
    } catch (e) {
      if (!el.isConnected) continue
      // Fallback: try run if render failed, otherwise show error
      const msg = (e as Error)?.message ?? 'Mermaid render error'
      // If render threw but run might still work (e.g. duplicate id), try once
      if (typeof mmd.render === 'function' && msg.includes('getAttribute')) {
        try {
          el.textContent = src
          el.removeAttribute('data-processed')
          await mmd.run({ nodes: [el] })
          el.setAttribute('data-rendered', 'true')
          el.removeAttribute('data-error')
          continue
        } catch {
          // fall through to error display
        }
      }
      showError(el, src, msg)
    }
  }
}
