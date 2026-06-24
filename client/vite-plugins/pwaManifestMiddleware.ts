/**
 * pwaManifestMiddleware - dev server 强制设置 PWA manifest 的 Content-Type
 *
 * 问题：Vite dev server 不会识别 .webmanifest 后缀，浏览器会因为
 *       Content-Type 不是 application/manifest+json 而拒绝安装 PWA。
 *
 * 解决：拦截 /manifest.webmanifest 与 /manifest.json 请求，
 *       读取 public/manifest.* 强制设置 application/manifest+json; charset=utf-8。
 */
import { resolve } from 'path'
import fs from 'fs'
import type { ViteDevServer } from 'vite'

export function pwaManifestMiddleware() {
  return {
    name: 'pwa-manifest-middleware',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (req.headers?.upgrade === 'websocket') return next()
        const url = (req.url || '').split('?')[0]
        if (url === '/manifest.webmanifest' || url === '/manifest.json') {
          const filePath = resolve(__dirname, 'public', url.replace(/^\//, ''))
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
              res.setHeader('Cache-Control', 'public, max-age=3600')
              fs.createReadStream(filePath).pipe(res)
              return
            }
          } catch (_e) {
            // file missing: fall through to Vite default handler
          }
        }
        next()
      })
    },
  }
}
