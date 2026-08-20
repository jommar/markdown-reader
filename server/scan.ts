import { spawn } from 'node:child_process'
import type { TreeNode, TreeResponse } from './types.ts'
import { status } from './safe-path.ts'

const RG_ARGS = [
  '--files',
  '--hidden',
  '--no-ignore-vcs',
  '-g',
  '!.git',
  '-g',
  '!node_modules',
  '-g',
  '!**/node_modules/**',
  '--glob',
  '*.md',
  '--glob',
  '*.markdown',
]

interface CacheEntry {
  tree: TreeNode[]
  files: string[]
  fileCount: number
  builtAt: number
  scannedAt: number
}

const TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

export async function getTree(root: string): Promise<TreeResponse> {
  const existing = cache.get(root)
  if (existing && Date.now() - existing.scannedAt < TTL_MS) {
    return {
      tree: existing.tree,
      files: existing.files,
      fileCount: existing.fileCount,
      builtAt: existing.builtAt,
    }
  }
  const files = await scanFiles(root)
  const builtAt = Date.now()
  const tree = buildTree(files)
  const entry: CacheEntry = { tree, files, fileCount: files.length, builtAt, scannedAt: builtAt }
  cache.set(root, entry)
  return { tree, files, fileCount: files.length, builtAt }
}

export function refreshTree(root: string): void {
  cache.delete(root)
}

function scanFiles(root: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('rg', [...RG_ARGS], { cwd: root })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (d: Buffer) => stdout.push(d))
    child.stderr.on('data', (d: Buffer) => stderr.push(d))
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(status(503, 'ripgrep (rg) is required; install it and restart'))
      } else {
        reject(err)
      }
    })
    child.on('close', (code) => {
      if (code !== 0) return reject(status(500, `rg exited ${code}`))
      const out = Buffer.concat(stdout).toString('utf8')
      const files = out
        .split('\n')
        .filter(Boolean)
        .map((p) => p.replace(/^\.\//, ''))
        .sort()
      resolve(files)
    })
  })
}

function buildTree(files: string[]): TreeNode[] {
  const rootNodes: TreeNode[] = []
  const dirMap = new Map<
    string,
    { node: { type: 'dir'; name: string; path: string; children: TreeNode[] } }
  >()

  const ensureDir = (dirPath: string): NonNullable<ReturnType<typeof dirMap.get>>['node'] => {
    const existing = dirMap.get(dirPath)
    if (existing) return existing.node
    const name = dirPath.includes('/') ? dirPath.slice(dirPath.lastIndexOf('/') + 1) : dirPath
    const node: { type: 'dir'; name: string; path: string; children: TreeNode[] } = {
      type: 'dir',
      name,
      path: dirPath,
      children: [],
    }
    dirMap.set(dirPath, { node })
    const parent = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : ''
    if (parent) {
      ensureDir(parent).children.push(node)
    } else {
      rootNodes.push(node)
    }
    return node
  }

  for (const file of files) {
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
    const name = file.includes('/') ? file.slice(file.lastIndexOf('/') + 1) : file
    const node: TreeNode = { type: 'file', name, path: file }
    if (dir) {
      ensureDir(dir).children.push(node)
    } else {
      rootNodes.push(node)
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    for (const n of nodes) if (n.type === 'dir') sortNodes(n.children)
    return nodes
  }

  return sortNodes(rootNodes)
}
