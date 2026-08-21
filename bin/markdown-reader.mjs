#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

function printHelp() {
  const msg = `
markdown-reader — local read-only Markdown browser

Usage:
  markdown-reader [options] [--root <dir>] [--open <file>] [--port <port>] [--host <host>]
  mdr [options]             # alias

Options:
  --root <dir>        Open directory as root (default: prompt)
  --open <file.md>    Open single markdown file (root = dirname)
  --port <port>       Port to listen on (default: 5180, env PORT also works)
  --host <host>       Host to bind (default: 127.0.0.1, env HOST also works)
                      Docker: HOST=0.0.0.0 is set by the image; run with
                      -p 127.0.0.1:5180:5180 to keep it local.
  --help, -h          Show this help
  --version, -v       Show version

Examples:
  npx markdown-reader --root /path/to/docs
  npx markdown-reader --open /path/to/docs/README.md
  npx markdown-reader --port 3000 --root ./docs
  mdr --root .        # short alias after npm i -g markdown-reader

Env:
  PORT, HOST, NODE_ENV, XDG_CONFIG_HOME

Requires:
  ripgrep (rg) 14.1.0+ on PATH — https://github.com/BurntSushi/ripgrep
  Node.js >=22.6

Docs: https://github.com/jommar/markdown-reader
`.trimStart()
  process.stdout.write(msg + '\n')
}

function printVersion() {
  try {
    const pkgPath = path.join(ROOT_DIR, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    process.stdout.write(`${pkg.version ?? '0.0.0'}\n`)
  } catch {
    process.stdout.write('0.0.0\n')
  }
}

function hasFlag(argv, ...flags) {
  return argv.some((a) => flags.includes(a))
}

function parsePortHost(argv) {
  let port
  let host
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      port = argv[i + 1]
      i++
    } else if (argv[i].startsWith('--port=')) {
      port = argv[i].slice('--port='.length)
    } else if (argv[i] === '--host' && argv[i + 1]) {
      host = argv[i + 1]
      i++
    } else if (argv[i].startsWith('--host=')) {
      host = argv[i].slice('--host='.length)
    }
  }
  return { port, host }
}

const argv = process.argv.slice(2)

if (hasFlag(argv, '--help', '-h')) {
  printHelp()
  process.exit(0)
}
if (hasFlag(argv, '--version', '-v', '--verson')) {
  printVersion()
  process.exit(0)
}

// Node 22.6+ enables native type stripping by default but refuses to strip
// files under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
// This package ships server/*.ts and relies on tsx, so we must disable
// native stripping and let tsx handle it. Re-exec with --no-strip-types
// + --import tsx when the flags are supported and not already present.
// --no-strip-types alone leaves .ts as ERR_UNKNOWN_FILE_EXTENSION; the
// dynamic `await import('tsx/esm/api')` below is not enough on Node 25
// when native stripping is disabled, so we need the --import hook.
// Placed after --help/--version so those remain fast and work even if
// tsx is missing.
if (!process.execArgv.includes('--no-strip-types')) {
  let flagAllowed = false
  try {
    // @ts-ignore - not in older @types/node
    flagAllowed = !!process.allowedNodeEnvironmentFlags?.has('--no-strip-types')
  } catch {
    flagAllowed = false
  }
  if (flagAllowed) {
    const hasTsxImport = process.execArgv.some((a) => a.includes('tsx'))
    const reExecArgs = ['--no-strip-types']
    if (!hasTsxImport) reExecArgs.push('--import', 'tsx')
    reExecArgs.push(...process.argv.slice(1))
    const res = spawnSync(process.execPath, reExecArgs, { stdio: 'inherit' })
    if (!res.error) process.exit(res.status ?? 0)
  }
}

// Map --port/--host to env for server/index.ts (it reads process.env.PORT/HOST)
// Keep original argv intact — server also handles --root/--open via parseArgs().
const { port, host } = parsePortHost(argv)
if (port !== undefined) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`error: invalid --port "${port}" (must be 1-65535)`)
    process.exit(1)
  }
  process.env.PORT = String(n)
}
if (host !== undefined) {
  if (!host.trim()) {
    console.error('error: --host requires a value')
    process.exit(1)
  }
  process.env.HOST = host
}

// Check ripgrep availability (server also checks at runtime, but friendlier here)
const rgCheck = spawnSync('rg', ['--version'], { encoding: 'utf8' })
if (rgCheck.error && rgCheck.error.code === 'ENOENT') {
  console.error(
    [
      'error: ripgrep (rg) not found on PATH.',
      '  Install it and retry:',
      '    Ubuntu/Debian: sudo apt-get install ripgrep',
      '    macOS:         brew install ripgrep',
      '    Cargo:         cargo install ripgrep',
      '  https://github.com/BurntSushi/ripgrep',
      '',
      `  Checked: rg --version → ${rgCheck.error.message}`,
    ].join('\n'),
  )
  process.exit(1)
}
if (rgCheck.status !== 0 && rgCheck.status !== null) {
  // rg exists but weird exit — let server handle; warn only
  console.error(`warn: rg --version exited ${rgCheck.status}: ${(rgCheck.stderr || '').trim()}`)
}

// Register tsx ESM loader, then import the server (which calls main()).
// This lets Node load server/*.ts files without a separate spawn.
try {
  await import('tsx/esm/api')
} catch (e) {
  console.error(
    [
      'error: missing dependency "tsx".',
      '  This should have been installed with markdown-reader.',
      '  Try: npm install -g markdown-reader@latest',
      '       or: npm install',
      `  Details: ${(e && e.message) || e}`,
    ].join('\n'),
  )
  process.exit(1)
}

// Import server — its top-level main() starts listening.
await import(path.join(ROOT_DIR, 'server/index.ts'))
