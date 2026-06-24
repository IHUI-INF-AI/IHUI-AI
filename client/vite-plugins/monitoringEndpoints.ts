/**
 * monitoringEndpoints - dev server 接收 CSP 违规与 RUM 指标并写入本地 logs/
 *
 * 端点：
 *   POST /api/csp-report  -> logs/csp-report.log
 *   POST /api/rum         -> logs/rum.log
 *
 * 生产环境：Nginx 通过 log_format 上报到远端，不走此中间件（见 nginx-production.conf）。
 */
import { resolve } from 'path'
import fs from 'fs'
import type { ViteDevServer } from 'vite'

export function monitoringEndpoints() {
  const logDir = resolve(__dirname, 'logs')
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  } catch (_) {
    // dir creation may fail in read-only envs; continue silently
  }
  const appendLog = (file: string, line: string) => {
    try {
      fs.appendFileSync(resolve(logDir, file), line + '\n', 'utf-8')
    } catch (_) {
      // ignore
    }
  }
  const readBody = (req: any): Promise<string> =>
    new Promise((resolveBody) => {
      let data = ''
      req.on('data', (chunk: Buffer | string) => { data += chunk.toString('utf-8') })
      req.on('end', () => resolveBody(data))
    })

  return {
    name: 'monitoring-endpoints',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== '/api/csp-report') return next()
        if (req.method !== 'POST') return next()
        try {
          const body = await readBody(req)
          appendLog('csp-report.log', `[${new Date().toISOString()}] ${body}`)
          res.statusCode = 204
          res.end()
        } catch (_err) {
          res.statusCode = 400
          res.end('bad request')
        }
      })
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== '/api/rum') return next()
        if (req.method !== 'POST') return next()
        try {
          const body = await readBody(req)
          appendLog('rum.log', `[${new Date().toISOString()}] ${body}`)
          res.statusCode = 204
          res.end()
        } catch (_err) {
          res.statusCode = 400
          res.end('bad request')
        }
      })
    },
  }
}
