export type TreeNode =
  | { type: 'dir'; name: string; path: string; children: TreeNode[] }
  | { type: 'file'; name: string; path: string }

export interface RootInfo {
  root: string
  lastOpened: number
}
export interface RootsResponse {
  roots: RootInfo[]
  initial?: OpenResult
}
export interface OpenResult {
  root: string
  initialPath?: string
}
export interface TreeResponse {
  tree: TreeNode[]
  files: string[]
  fileCount: number
  builtAt: number
}

export interface FileResult {
  path: string
  content: string
  frontmatter: Record<string, unknown> | null
  frontmatterLines: number
  mtimeMs: number
  size: number
}

export interface SearchMatch {
  line: number
  text: string
  ranges: [number, number][]
  prefixTruncated: boolean
  suffixTruncated: boolean
}
export interface SearchFileResult {
  path: string
  matches: SearchMatch[]
}
export interface SearchResponse {
  results: SearchFileResult[]
  truncated: boolean
  elapsedMs: number
}
export interface ApiError {
  error: string
}
