/**
 * mockDataPlugin - dev server 期间将 /mock-data/*.json 请求指向 public/mock-data/ 静态文件
 *
 * 使用场景：开发环境在没有真实后端时，前端请求 /mock-data/news.json
 *          等种子数据，此中间件直接从 public/mock-data/ 读取并返回。
 *
 * 仅在 dev 模式（apply: 'serve'）生效，不影响生产构建。
 */
import { resolve } from 'path'
import fs from 'fs'
import type { ViteDevServer } from 'vite'

export function mockDataPlugin() {
  return {
    name: 'mock-data-static',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/mock-data/') || !url.endsWith('.json')) return next()
        const fileName = url.replace('/mock-data/', '')
        const filePath = resolve(__dirname, 'public/mock-data', fileName)
        if (!fs.existsSync(filePath)) return next()
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(content)
        } catch (_err) {
          next()
        }
      })
    },
  }
}
