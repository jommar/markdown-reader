import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { renderRawMarkdown, type RenderedDoc } from '../markdown/renderer.ts'
import { useWorkspace } from './workspace.ts'
import { usePrefs } from './prefs.ts'

const MAX_PASTE_BYTES = 1_500_000

function needsWide(content: string, hasMermaid: boolean): boolean {
  if (hasMermaid) return true
  for (const line of content.split('\n')) {
    if (line.length > 2000) return true
  }
  for (const row of content.split('\n')) {
    const t = row.trim()
    if (t.startsWith('|') && t.endsWith('|')) {
      if (t.split('|').length - 2 > 6) return true
    }
  }
  return false
}

export const usePaste = defineStore('paste', () => {
  const raw = ref<string | null>(null)
  const doc = ref<RenderedDoc | null>(null)
  const dialogOpen = ref(false)
  const error = ref<string | null>(null)
  const showAllTables = ref(false)

  const hasPaste = computed(() => doc.value !== null)

  async function setRaw(text: string): Promise<void> {
    error.value = null
    if (text.length > MAX_PASTE_BYTES) {
      error.value = `Pasted content too large (${text.length} chars, max ${MAX_PASTE_BYTES})`
      return
    }
    raw.value = text
    try {
      const rendered = await renderRawMarkdown(text, { showAllTables: showAllTables.value })
      doc.value = rendered
      // Defer workspace/prefs access to avoid store init order issues in tests
      const workspace = useWorkspace()
      const prefs = usePrefs()
      workspace.currentHeadings = rendered.headings
      prefs.wideHint = needsWide(text, rendered.hasMermaid)
      error.value = null
    } catch (e) {
      error.value = (e as Error).message ?? String(e)
      doc.value = null
    }
  }

  async function setShowAllTables(v: boolean): Promise<void> {
    showAllTables.value = v
    if (raw.value !== null) {
      await setRaw(raw.value)
    }
  }

  function clear(): void {
    raw.value = null
    doc.value = null
    error.value = null
    showAllTables.value = false
    try {
      const workspace = useWorkspace()
      const prefs = usePrefs()
      workspace.currentHeadings = []
      prefs.wideHint = false
    } catch {
      /* ignore if stores not yet initialized */
    }
  }

  return {
    raw,
    doc,
    dialogOpen,
    error,
    hasPaste,
    showAllTables,
    setRaw,
    setShowAllTables,
    clear,
  }
})
