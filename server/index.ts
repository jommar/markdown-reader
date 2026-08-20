import express from 'express'
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeApiRouter } from './routes.ts'
import { registerRoot } from './safe-path.ts'
import type { OpenResult } from './types.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 5180)
const HOST = process.env.HOST ?? '127.0.0.1'
const isProd = process.env.NODE_ENV === 'production'

function parseArgs(): { root?: string; open?: string } {
  const argv = process.argv.slice(2)
  const out: { root?: string; open?: string } = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      out.root = argv[i + 1]
      i++
    } else if (argv[i] === '--open' && argv[i + 1]) {
      out.open = argv[i + 1]
      i++
    } else if ((argv[i] === '--port' || argv[i] === '--host') && argv[i + 1]) {
      // consumed by bin wrapper via env; skip here
      i++
    } else if (argv[i].startsWith('--port=') || argv[i].startsWith('--host=')) {
      // already handled
    }
  }
  return out
}

async function main() {
  const args = parseArgs()

  let initial: OpenResult | undefined
  if (args.open) {
    const abs = path.resolve(args.open)
    const real = await fs.realpath(abs).catch(() => null)
    if (real) {
      const stat = await fs.stat(real).catch(() => null)
      if (stat?.isFile()) {
        await registerRoot(path.dirname(real))
        initial = { root: path.dirname(real), initialPath: path.basename(real) }
      }
    }
  } else if (args.root) {
    const abs = path.resolve(args.root)
    const real = await fs.realpath(abs).catch(() => null)
    if (real) {
      const stat = await fs.stat(real).catch(() => null)
      if (stat?.isDirectory()) {
        await registerRoot(real)
        initial = { root: real }
      }
    }
  }

  const app = express()
  const server = http.createServer(app)

  app.use('/api', makeApiRouter({ port: PORT, initial }))

  if (isProd) {
    const token = (await import('./guard.ts')).SESSION_TOKEN
    app.use(express.static(path.join(ROOT_DIR, 'dist'), { index: false }))
    app.use(async (_req, res) => {
      const raw = await fs.readFile(path.join(ROOT_DIR, 'dist/index.html'), 'utf8')
      res.status(200).set('Content-Type', 'text/html').end(raw.replace('__MDR_TOKEN__', token))
    })
  } else {
    const { createServer } = await import('vite')
    const vite = await createServer({
      root: ROOT_DIR,
      appType: 'custom',
      server: { middlewareMode: true, hmr: { server } },
    })
    const token = (await import('./guard.ts')).SESSION_TOKEN
    app.use(vite.middlewares)
    app.use(async (req, res, next) => {
      try {
        const raw = await fs.readFile(path.join(ROOT_DIR, 'index.html'), 'utf8')
        let html = await vite.transformIndexHtml(req.originalUrl, raw)
        html = html.replace('__MDR_TOKEN__', token)
        res.status(200).set('Content-Type', 'text/html').end(html)
      } catch (e) {
        vite.ssrFixStacktrace(e as Error)
        next(e)
      }
    })
  }

  // HOST defaults to 127.0.0.1 (local, DNS-rebinding safe). Docker sets HOST=0.0.0.0
  // via the image ENV; guard stays strict (Host must be 127.0.0.1:<PORT>) so you
  // should publish as -p 127.0.0.1:5180:5180 to keep it local.
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST
  server.listen(PORT, HOST, () => {
    console.log(`markdown-reader → http://${displayHost}:${PORT}`)
    if (HOST === '0.0.0.0') console.log(`  (listening on 0.0.0.0:${PORT}, publish as -p 127.0.0.1:${PORT}:${PORT} to keep local)`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
