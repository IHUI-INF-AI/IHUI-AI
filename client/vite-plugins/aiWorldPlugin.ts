/**
 * Vite 插件 - ai-world 静态资源与 HTML 处理
 *
 * 功能：
 * 1. /ai-world/* 路径下的静态文件（HTML、CSS、JS、图片、字体）服务
 * 2. HTML 内容改写：替换 CDN 路径为本地相对路径
 * 3. WordPress theme JS 改用 jsDelivr CDN（避免 404 与 $ 未定义）
 * 4. 移除广告/分析脚本（googlesyndication、bytegoofy、baidu 等）
 * 5. /wp-content/, /wp-includes/ 反向代理到 /ai-world/
 * 6. CSP 头注入 + 字体 CSS 注入
 */

import type { Plugin, ViteDevServer } from 'vite'
import { resolve } from 'path'
import fs from 'fs'
import { DEV_CSP_STRING, REPORT_TO_HEADER } from '../config/csp'

/** WordPress 静态文件目录（public/ai-world） */
const AI_WORLD_DIR = resolve(__dirname, '..', 'public', 'ai-world')

/** ai-bot.cn 远程 URL → 本地 /ai-world/ 路径 */
const WP_URL_REWRITES: [RegExp, string][] = [
  [/https:\/\/ai-bot\.cn\/wp-content\//g, '/ai-world/wp-content/'],
  [/https:\/\/ai-bot\.cn\/wp-includes\//g, '/ai-world/wp-includes/'],
  [/href=["']logo\//g, 'href="/ai-world/logo/'],
  [/src=["']logo\//g, 'src="/ai-world/logo/'],
  [/href=["']index\.html/g, 'href="/ai-world/'],
]

/** theme js → jsDelivr CDN（避免 404 与 $ 未定义） */
const JS_CDN_MAP: [RegExp, string][] = [
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/jquery\.min\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js',
  ],
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/swiper-bundle\.min\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js',
  ],
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/popper\.min\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js',
  ],
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/bootstrap\.min\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js',
  ],
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/theia-sticky-sidebar\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/theia-sticky-sidebar@1.7.0/dist/theia-sticky-sidebar.min.js',
  ],
  [
    /\/ai-world\/wp-content\/themes\/onenav\/js\/lazyload\.min\.js[^"']*/g,
    'https://cdn.jsdelivr.net/npm/vanilla-lazyload@17.8.3/dist/lazyload.min.js',
  ],
]

/** theme js 文件名 → CDN URL（用于 302 跳转） */
const ONENAV_JS_CDN: Record<string, string> = {
  'jquery.min.js': 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js',
  'swiper-bundle.min.js': 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js',
  'popper.min.js': 'https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js',
  'bootstrap.min.js':
    'https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js',
  'theia-sticky-sidebar.js':
    'https://cdn.jsdelivr.net/npm/theia-sticky-sidebar@1.7.0/dist/theia-sticky-sidebar.min.js',
  'lazyload.min.js': 'https://cdn.jsdelivr.net/npm/vanilla-lazyload@17.8.3/dist/lazyload.min.js',
  'html5.min.js': 'https://cdn.jsdelivr.net/npm/html5shiv@3.7.3/dist/html5.min.js',
}

/** 要移除的广告/分析脚本（保留 iframe 主体） */
const AD_SCRIPT_REMOVALS: RegExp[] = [
  /<script[^>]*src=["'][^"']*(?:pagead2\.googlesyndication|googlesyndication\.com|googletagmanager\.com|doubleclick\.net)[^"']*["'][^>]*>\s*<\/script>/gi,
  /<script>\s*\(function\s*\(\)\s*\{[\s\S]*?\.src\s*=\s*["']https?:\/\/(?:lf1-cdn-tos\.bytegoofy|hm\.baidu)[\s\S]*?\}\s*\)\s*\([^)]*\)\s*;?\s*<\/script>/gi,
]

/** MIME 表 */
const MIME_TYPES: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

/** 改写 HTML 内容：替换 CDN、移除广告、注入字体 */
function rewriteHtml(html: string): string {
  for (const [re, repl] of WP_URL_REWRITES) html = html.replace(re, repl)
  for (const [re, url] of JS_CDN_MAP) html = html.replace(re, url)
  for (const re of AD_SCRIPT_REMOVALS) html = html.replace(re, '<!-- ad removed -->')
  html = html.replace(
    '</head>',
    '<link rel="stylesheet" href="/ai-world/ai-world-unified-fonts.css">\n</head>'
  )
  return html
}

/** 判断是否为 WebSocket 升级请求 */
const isWebSocket = (req: { headers?: { upgrade?: string } }): boolean =>
  (req.headers?.upgrade || '').toLowerCase() === 'websocket'

/** 设置 Content-Type 与 Cache-Control */
function setAssetHeaders(res: { setHeader: (k: string, v: string) => void }, ext: string): void {
  const mime = MIME_TYPES[ext]
  if (mime) res.setHeader('Content-Type', mime)
  const cacheable = ['html', 'json'].includes(ext) ? 'no-cache' : 'public, max-age=31536000'
  res.setHeader('Cache-Control', cacheable)
}

/** 读取并改写 HTML 后返回 */
function sendRewrittenHtml(
  res: { setHeader: (k: string, v: string) => void; end: (s?: string) => void },
  filePath: string
): void {
  let html = fs.readFileSync(filePath, 'utf-8')
  html = rewriteHtml(html)
  res.setHeader('Content-Security-Policy', DEV_CSP_STRING)
  res.setHeader('Report-To', REPORT_TO_HEADER)
  res.end(html)
}

export function aiWorldPlugin(): Plugin {
  return {
    name: 'ai-world-plugin',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // 1. /ai-world/* 静态文件
      server.middlewares.use((req, res, next) => {
        if (isWebSocket(req)) return next()
        const url = req.url || ''
        if (req.method !== 'GET' || !url.startsWith('/ai-world/')) return next()

        const pathname = url.split('?')[0]
        if (pathname === '/ai-world' || pathname === '/ai-world/') return next()

        // 302 跳转：theme js → jsDelivr
        const jsMatch = pathname.match(
          /\/ai-world\/wp-content\/themes\/onenav\/js\/([^/?#]+\.js)(?:\?|$)/
        )
        if (jsMatch && ONENAV_JS_CDN[jsMatch[1]]) {
          res.setHeader('Location', ONENAV_JS_CDN[jsMatch[1]])
          res.statusCode = 302
          res.end()
          return
        }

        const filePath = resolve(AI_WORLD_DIR, pathname.replace('/ai-world', ''))
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = filePath.split('.').pop()?.toLowerCase() || ''
            if (ext === 'html') {
              sendRewrittenHtml(res, filePath)
              return
            }
            setAssetHeaders(res, ext)
            fs.createReadStream(filePath).pipe(res)
            return
          }
          // 目录请求：尝试 index.html
          if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            const indexPath = resolve(filePath, 'index.html')
            if (fs.existsSync(indexPath)) {
              sendRewrittenHtml(res, indexPath)
              return
            }
          }
        } catch {
          // 文件不存在则继续后续中间件
        }
        next()
      })

      // 2. /wp-content/, /wp-includes/ 反向代理到 /ai-world/
      server.middlewares.use((req, res, next) => {
        if (isWebSocket(req)) return next()
        const url = req.url || ''
        if (!url.includes('/wp-content/') && !url.includes('/wp-includes/')) return next()
        const m = url.match(/\/(wp-content\/.*|wp-includes\/.*)/)
        if (!m) return next()
        const localPath = resolve(__dirname, '..', 'public', 'ai-world', m[1])
        try {
          if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            const ext = localPath.split('.').pop()?.toLowerCase() || ''
            setAssetHeaders(res, ext)
            fs.createReadStream(localPath).pipe(res)
            return
          }
        } catch {
          // 静默失败
        }
        next()
      })
    },
  }
}

export default aiWorldPlugin
