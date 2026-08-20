const FONT_FAMILY =
  "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"

const THEME_VARS_DARK = {
  primaryColor: '#1c2029',
  primaryTextColor: '#dde3ec',
  primaryBorderColor: '#38404f',
  lineColor: '#38404f',
  secondaryColor: '#161920',
  tertiaryColor: '#0f1115',
  background: '#0f1115',
  mainBkg: '#1c2029',
  nodeBorder: '#38404f',
  clusterBkg: '#161920',
  clusterBorder: '#262b36',
  titleColor: '#dde3ec',
  textColor: '#dde3ec',
  contrast: '#dde3ec',
  border1: '#38404f',
  border2: '#6ea8fe',
  labelColor: '#9aa4b5',
  errorBkgColor: '#f2777a',
  errorTextColor: '#0f1115',
}

const THEME_VARS_LIGHT = {
  primaryColor: '#eceef1',
  primaryTextColor: '#1b1f27',
  primaryBorderColor: '#b9c0cc',
  lineColor: '#b9c0cc',
  secondaryColor: '#f4f5f7',
  tertiaryColor: '#ffffff',
  background: '#ffffff',
  mainBkg: '#eceef1',
  nodeBorder: '#b9c0cc',
  clusterBkg: '#f4f5f7',
  clusterBorder: '#d5d9e0',
  titleColor: '#1b1f27',
  textColor: '#1b1f27',
  contrast: '#1b1f27',
  border1: '#b9c0cc',
  border2: '#2563eb',
  labelColor: '#4c5566',
  errorBkgColor: '#f2777a',
  errorTextColor: '#ffffff',
}

function buildConfig(theme: 'dark' | 'light') {
  const resolvedTheme = theme === 'light' ? 'default' : 'dark'
  const vars = theme === 'light' ? THEME_VARS_LIGHT : THEME_VARS_DARK
  return {
    startOnLoad: false,
    theme: resolvedTheme as 'dark' | 'default',
    securityLevel: 'strict' as const,
    suppressErrorRendering: true,
    fontFamily: FONT_FAMILY,
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'linear' as const },
    sequence: { useMaxWidth: true, mirrorActors: false },
    gantt: { useMaxWidth: true },
    er: { useMaxWidth: true },
    journey: { useMaxWidth: true },
    themeVariables: vars,
  }
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

export function getMermaidSourceByEl(el: HTMLElement): string | undefined {
  return sourceCache.get(el)
}

function getSource(el: HTMLElement): string {
  let src = sourceCache.get(el)
  if (src === undefined) {
    const raw = el.hasAttribute('data-src') ? el.getAttribute('data-src') : null
    src = raw ?? el.textContent ?? ''
    sourceCache.set(el, src)
  }
  // Mirror to DOM for robust copy (MarkdownView reads data-src, survives re-render)
  if (!el.hasAttribute('data-src') && src) {
    try {
      el.setAttribute('data-src', src)
    } catch {
      // ignore
    }
  }
  // Also expose via dataset for direct JS access
  try {
    ;(el as unknown as Record<string, unknown>).__mermaidSrc = src
  } catch {
    // ignore
  }
  return src
}

function showError(el: HTMLElement, src: string, message: string): void {
  // Fallback: render as styled code-block-like error with raw source
  el.textContent = ''
  el.classList.add('mermaid-error-block')
  const header = document.createElement('div')
  header.className = 'mermaid-error-header'
  header.textContent = message || 'Mermaid syntax error'
  el.appendChild(header)
  const pre = document.createElement('pre')
  pre.className = 'mermaid-error-source'
  const code = document.createElement('code')
  code.textContent = src
  pre.appendChild(code)
  el.appendChild(pre)
  el.setAttribute('data-rendered', 'true')
  el.setAttribute('data-error', 'true')
}

export async function renderMermaid(root: HTMLElement, theme: 'dark' | 'light'): Promise<void> {
  const pres = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'))
  if (pres.length === 0) return
  const mmd = await getMermaid()
  const config = buildConfig(theme)
  mmd.initialize(config)
  for (const el of pres) {
    if (!el.isConnected) continue
    const src = getSource(el)
    if (!src.trim()) continue
    el.classList.remove('mermaid-error-block')
    el.removeAttribute('data-processed')
    el.removeAttribute('data-rendered')
    el.removeAttribute('data-error')
    el.textContent = src
    const id = `mermaid-${Date.now()}-${renderCounter++}`
    // Fast fail via parse when available (mermaid 11 parse is sync or async)
    if (typeof mmd.parse === 'function') {
      try {
        await mmd.parse(src)
      } catch (e) {
        if (!el.isConnected) continue
        const msg = (e as Error)?.message ?? 'Mermaid syntax error'
        showError(el, src, msg)
        continue
      }
    }
    try {
      if (typeof mmd.render === 'function') {
        const { svg } = await mmd.render(id, src)
        if (!el.isConnected) continue
        el.innerHTML = svg
        const svgEl = el.querySelector('svg')
        if (svgEl) {
          svgEl.setAttribute('role', 'img')
          if (!svgEl.getAttribute('aria-label')) {
            const firstLine = src.trim().split('\n')[0]?.slice(0, 80) ?? 'Mermaid diagram'
            svgEl.setAttribute('aria-label', firstLine)
          }
        }
        el.setAttribute('role', 'figure')
        el.setAttribute('aria-label', 'Mermaid diagram')
        el.setAttribute('data-rendered', 'true')
      } else {
        await mmd.run({ nodes: [el] })
        if (!el.isConnected) continue
        el.setAttribute('data-rendered', 'true')
        el.setAttribute('role', 'figure')
        el.setAttribute('aria-label', 'Mermaid diagram')
      }
    } catch (e) {
      if (!el.isConnected) continue
      const msg = (e as Error)?.message ?? 'Mermaid render error'
      if (typeof mmd.render === 'function' && msg.includes('getAttribute')) {
        try {
          el.textContent = src
          el.removeAttribute('data-processed')
          await mmd.run({ nodes: [el] })
          el.setAttribute('data-rendered', 'true')
          el.setAttribute('role', 'figure')
          el.setAttribute('aria-label', 'Mermaid diagram')
          el.removeAttribute('data-error')
          continue
        } catch {
          // fall through
        }
      }
      showError(el, src, msg)
    }
  }
}
