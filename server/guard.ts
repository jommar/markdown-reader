import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

export const SESSION_TOKEN = crypto.randomUUID()

export function makeGuard(port: number) {
  const OK_HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`])
  const OK_ORIGINS = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])

  return (req: Request, res: Response, next: NextFunction) => {
    if (!OK_HOSTS.has(req.headers.host ?? '')) return res.status(403).json({ error: 'bad host' })
    const origin = req.headers.origin
    if (origin && !OK_ORIGINS.has(origin)) return res.status(403).json({ error: 'bad origin' })
    if ((req.headers['sec-fetch-site'] ?? 'same-origin') !== 'same-origin')
      return res.status(403).json({ error: 'cross-site' })
    if (req.method !== 'GET' && req.headers['x-mdr-token'] !== SESSION_TOKEN)
      return res.status(403).json({ error: 'bad token' })
    next()
  }
}
