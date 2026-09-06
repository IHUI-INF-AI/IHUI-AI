// 轻量静态服务器:托管 H5 构建产物(dist/),用于无 dev-server 的浏览器预览。
// 用法: node scripts/serve-h5.mjs [port]  默认 8807
import http from 'http'
import { createReadStream, existsSync, statSync, readFileSync } from 'fs'
import { join, extname, normalize } from 'path'
import { fileURLToPath } from 'url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const port = Number(process.argv[2] || 8807)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  // 防止路径穿越
  let file = normalize(join(root, urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html')
  }
  if (!existsSync(file) && !extname(urlPath)) {
    // SPA fallback(哈希路由下一般用不到,兜底)
    file = join(root, 'index.html')
  }
  if (!existsSync(file)) {
    res.writeHead(404)
    res.end('Not found: ' + urlPath)
    return
  }
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
  })
  createReadStream(file).pipe(res)
})

server.listen(port, () => {
  console.log(`h5 preview: http://localhost:${port}/`)
})