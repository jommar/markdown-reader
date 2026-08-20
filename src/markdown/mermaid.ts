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
}

let mermaidPromise: Promise<MermaidModule> | null = null
const sourceCache = new WeakMap<HTMLElement, string>()

async function getMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mod = (m as { default?: MermaidModule }).default ?? (m as unknown as MermaidModule)
      return mod
    })
  }
  return mermaidPromise
}

export async function renderMermaid(root: HTMLElement, theme: 'dark' | 'light'): Promise<void> {
  const pres = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'))
  if (pres.length === 0) return
  const mmd = await getMermaid()
  const resolvedTheme = theme === 'light' ? 'default' : 'dark'
  mmd.initialize({ ...CONFIG, theme: resolvedTheme })
  for (const el of pres) {
    let src = sourceCache.get(el)
    if (src === undefined) {
      src = el.getAttribute('data-src') ?? el.textContent ?? ''
      sourceCache.set(el, src)
    }
    if (!src) continue
    el.removeAttribute('data-processed')
    el.removeAttribute('data-rendered')
    el.textContent = src
    try {
      await mmd.run({ nodes: [el] })
      el.setAttribute('data-rendered', 'true')
    } catch (e) {
      el.textContent = ''
      const err = document.createElement('div')
      err.className = 'mermaid-error text-danger p-2 text-sm'
      err.textContent = (e as Error)?.message ?? 'Mermaid render error'
      el.appendChild(err)
      el.appendChild(document.createTextNode(src))
      // make visible even though it's an error
      el.setAttribute('data-rendered', 'true')
      el.setAttribute('data-error', 'true')
    }
  }
}
