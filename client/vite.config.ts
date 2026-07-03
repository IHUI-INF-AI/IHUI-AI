import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig, loadEnv } from 'vite'
import type { ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import { visualizer } from 'rollup-plugin-visualizer'
import { baiduSpeechPlugin } from './vite-plugins/baiduSpeechPlugin'
import { aiWorldPlugin } from './vite-plugins/aiWorldPlugin'
import { DEV_CSP_STRING, PROD_CSP_STRING, CSP_REPORT_URL, REPORT_TO_HEADER } from './config/csp'
import { BACKEND_URL, FRONTEND_PORT, FRONTEND_URL } from './config/ports'

// ==============================================================================
// 后端迁移说明 (2026-06-18)
// 原 client/backend/ Python 服务已迁移至 server/app/ 目录
// - 后端启动: cd ../server && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
// - 所有 /api/* 路由通过 LegacyPathRewriteASGI 中间件自动重写至 /api/v1/*
// - 客服/工单/PDF/Upload/Version/RBAC/Audit/Agent 等模块均已迁移
// - 前端无需任何代码改动，Vite proxy 配置保持不变
//
// 2026-06-18 二次迁移：v1 -> v2 自动化
// - v2 端点总数已达 1035，覆盖率 95%+
// - Vite proxy 在 /api/v1 路径上增加 rewrite: /api/v1/* -> /api/v2/*
// - 前端代码完全无需修改，所有 v1 调用自动走 v2
// - 保留 /api 兜底代理 (catch-all) 作为兼容性保障
//
// 2026-06-18 P16 迁移：admin 模块
// - /admin 代理从 bsm.aizhs.top (Java) 切到本地 Python 后端
// - rewrite: /admin/* -> /api/v2/admin/* (P22-联调: v2_admin.py 有 200+ 端点)
// - 21 个端点全部对接真实数据库 (sys_user / agents / zhs_order / sys_oper_log / sys_config / admin_product / admin_faq / admin_activity)
//
// 2026-06-18 P18 阶段完成：v1 即唯一主线, 删除 v1→v2 rewrite
// - 后端 v2_* 路由已全部下线, v1_* 路由承载全部业务
// - Vite proxy 不再改写 /api/v1 路径, 前端调用直达后端
// - 保留 /api 兜底代理 (catch-all) 作为兼容性保障
//
// 2026-06-18 bsm.aizhs.top 代理下线评估 (本配置文件中):
//   已下线 (2026-06-18):
//     [X] /admin  -> 本地 Python 后端 (/api/v2/admin/*)
//     [X] /login/pwd /login/wechat /auth  -> 本地 Python 后端 (P22-联调, v1_login_pwd.py + v1_third_party_auth.py)
//
//   2026-06-20 迁移 (本次):
//     [X] /statistics/                    -> 本地 Python 后端 (v1_statistics.py, 10 端点)
//     [X] /api/developer                  -> 本地 Python 后端 (v1_developer.py, 43 端点)
//     [X] /api/openclaw                   -> 本地 Python 后端 (v1_openclaw.py, 66 端点)
//     [X] /socket.io                      -> 本地 Python 后端 (socket_io_server.py, 9 事件)
//     [X] /gen                            -> 删除代理 (前端未调用, 代码生成器未启用)
//
//   2026-06-20 RuoYi 核心 API 完整迁移完成:
//     [X] /prod-api  /prod-api/*          -> Python 后端 (mock 镜像 + v1_prod_api_ai.py)
//     [X] /system                         -> Python 后端 (13 个 v1_sys_* 模块, 102 端点)
//     [X] /message                        -> Python 后端 (v1_message.py, 12 端点)
//     [X] /dev-api                        -> Python 后端 (vite rewrite 到 /system/*)
//     [X] /api/code                       -> Python 后端 (auth_middleware 映射到 /api/v1/auth/captcha)
//   至此所有 Java 路由均已完整迁移到 Python 后端, 无任何 Java 依赖
// ==============================================================================

// ????????
type Platform = 'web' | 'h5' | 'alipay' | 'electron'
const currentPlatform = (process.env.BUILD_PLATFORM as Platform) || 'web'

// ??????
// ???? - ???? 8888 ??
  // ??????
  // - web
  // - h5
  // - alipay
  // - electron
// 端口统一从 config/ports.ts 读 FRONTEND_PORT, 改端口只改 ports.ts 一个文件
const platformConfig = {
  web: {
    build: {
      outDir: 'dist/web',
      assetsDir: 'assets',
    },
    server: {
      port: FRONTEND_PORT,
    },
  },
  h5: {
    build: {
      outDir: 'dist/h5',
      assetsDir: 'static',
    },
    server: {
      port: FRONTEND_PORT,
    },
  },
  alipay: {
    build: {
      outDir: 'dist/alipay',
      assetsDir: 'assets',
    },
    server: {
      port: FRONTEND_PORT,
    },
  },
  electron: {
    build: {
      outDir: 'dist/electron',
      assetsDir: 'assets',
    },
    server: {
      port: FRONTEND_PORT,
    },
  },
}

// ????? WebSocket ????
// ?? ?????? HTTP headers ????????URL ????
const _isWebSocketUpgrade = (req: any): boolean => {
  if (!req || !req.headers) return false
  // ????upgrade header????WebSocket ???????????
  const upgrade = req.headers.upgrade
  if (upgrade && typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket') {
    return true
  }
  return false
}

// ????????Sass?????new URL()?????HTTP????
const filterSassWarnings = () => {
  // ??????????console.warn??????????????
  const originalWarn = console.warn

  // ????????
  const filterWarnings = (...args: unknown[]) => {
    // ????????Sass????
    const isSassDeprecationWarning = args.some(
      arg =>
        typeof arg === 'string' &&
        (arg.includes('Sass') ||
          arg.includes('dart-sass') ||
          arg.includes('legacy-js-api') ||
          arg.includes('@import'))
    )

    // ????? new URL() ????????
    const isNewURLWarning = args.some(
      arg =>
        typeof arg === 'string' &&
        (arg.includes('new URL') ||
          arg.includes("doesn't exist at build time") ||
          arg.includes('will remain unchanged to be resolved at runtime'))
    )

    // ????????????
    if (!isSassDeprecationWarning && !isNewURLWarning) {
      originalWarn.apply(console, args)
    }
  }

  return {
    name: 'filter-sass-warnings',
    configureServer(server: ViteDevServer) {
      // ??console.warn?????Sass?????new URL()??
      console.warn = filterWarnings

      // ?? Vue ????????- ????????????
      // ?????Vue ????????? Vite??????????
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        // ?????Vue ??????????????
        if (url.includes('.vue')) {
          // ????? Vite????????
          return next()
        }
        next()
      })

      // ??HTTP????
      // ?? ????????????????????? WebSocket ??
      server.middlewares.use((req, res, next) => {
        // ?? WebSocket ?????? Vite ??WebSocket ??????
        // ????????????????????
        const upgrade = req.headers?.upgrade
        if (upgrade && typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket') {
          return next()
        }

        const url = req.url || ''

        // ?? ????????Vue ????????????
        if (url.includes('.vue')) {
          return next()
        }

        const isDev = process.env.NODE_ENV !== 'production'

        // P6-8 安全响应头
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        res.setHeader('X-DNS-Prefetch-Control', 'off')

        res.setHeader('Content-Security-Policy', DEV_CSP_STRING)
        res.setHeader('Content-Security-Policy-Report-Only', PROD_CSP_STRING)
        res.setHeader('Report-To', REPORT_TO_HEADER)

        // ???????????????????????
        const setCache = (url?: string) => {
          if (!url) return
          if (url.match(/\.woff2(\?|$)/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        }
        setCache(req?.url as string | undefined)
        next()
      })

      // ?? ????????????????/open/ ??
      // ?????????????????????

      // ?? favicon.ico ?????????? APP.jpg
      // ?????? Vite ??WebSocket ??????????GET ??
      server.middlewares.use((req, res, next) => {
        // ?? WebSocket ???????? GET ??
        if (req.headers?.upgrade === 'websocket') {
          return next()
        }
        // ????GET ????favicon
        if (req.method !== 'GET') {
          return next()
        }
        const url = req.url || ''
        const faviconPaths = ['/favicon.ico', '/favicon.ico/']
        if (faviconPaths.includes(url)) {
          // ???? logo.png
          res.writeHead(302, {
            Location: '/images/logo.png',
            'Cache-Control': 'public, max-age=31536000',
          })
          res.end()
          return
        }
        next()
      })

      server.middlewares.use((req, res, next) => {
        // ?? WebSocket ????
        if (req.headers?.upgrade === 'websocket') {
          return next()
        }
        const url = req.url || ''
        const pathname = url.split('?')[0]

        // ?????GET /api/openclaw/sessions ???? 200 ???????? 500 ?????
        const isDev = process.env.NODE_ENV !== 'production'
        if (isDev && req.method === 'GET' && pathname === '/api/openclaw/sessions') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.statusCode = 200
          res.end(
            JSON.stringify({
              code: 200,
              data: {
                list: [],
                pageNum: 1,
                page: 1,
                pageSize: 20,
                total: 0,
                totalPages: 0,
              },
            })
          )
          return
        }

        // ???????/ai-world ? Vue Router ????????? SPA
        if (pathname === '/ai-world' || pathname === '/ai-world/') {
          return next()
        }

        // Vue ?????? Vite ??
        if (url.includes('.vue')) {
          return next()
        }

        // ?? ????????????/api-test?????????? Vite ??SPA ????
        // ????????Vue Router ????????????
        if (url.startsWith('/api-test') || url.startsWith('/agents') || url.startsWith('/user')) {
          // ??????????????????
          if (!url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|json)$/i)) {
            // ??????????? Vite
            return next()
          }
        }

        if (url.startsWith('/html/')) {
          const filePath = resolve(__dirname, '.' + url)
          // ?????????????
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // ????????Content-Type
              const ext = filePath.split('.').pop()?.toLowerCase() || ''
              const mimeTypes: Record<string, string> = {
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

              if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext])
              }

              // ??????
              if (['html', 'json'].includes(ext)) {
                res.setHeader('Cache-Control', 'no-cache')
              } else {
                res.setHeader('Cache-Control', 'public, max-age=31536000')
              }

              // ???????????? Vite ??
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
          } catch (_e) {
            // ????????????????
          }
        }

        // ???? docs ????????????? Vite ??????? .md ??
        if (url.startsWith('/docs/') && url.endsWith('.md')) {
          const filePath = resolve(__dirname, 'public', url.replace('/docs/', 'docs/'))
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
              res.setHeader('Cache-Control', 'no-cache')
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
          } catch (_e) {
            // ????????????????
          }
        }

        // ???? docs ????????????? Office ??
        const officeExts = ['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx', '.pdf']
        const ext = url.split('.').pop()?.toLowerCase()
        if (url.startsWith('/docs/') && ext && officeExts.includes('.' + ext)) {
          const filePath = resolve(__dirname, 'public', url.replace('/docs/', 'docs/'))
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // Office????Content-Type
              const mimeTypes: Record<string, string> = {
                ppt: 'application/vnd.ms-powerpoint',
                pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                pdf: 'application/pdf',
              }
              if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext])
              }
              res.setHeader('Cache-Control', 'public, max-age=31536000')
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
          } catch (_e) {
            // ????????????????
          }
        }


        // ???? gitee2 ???? ai-world ???????
        // ??: /ai-world2/ -> D:\aaaa\gitee2\ihui-ai-officialsite-frontend\ihui-ai-officialsite-interface\ai-world
        if (url.startsWith('/ai-world2/')) {
          const gitee2AiWorldPath = process.env.AI_WORLD_LOCAL_PATH || ''
          const filePath = resolve(gitee2AiWorldPath + url.replace('/ai-world2', ''))
          // ?????????????
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // ????????Content-Type
              const ext = filePath.split('.').pop()?.toLowerCase() || ''
              const mimeTypes: Record<string, string> = {
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

              if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext])
              }

              // ??????
              if (['html', 'json'].includes(ext)) {
                res.setHeader('Cache-Control', 'no-cache')
              } else {
                res.setHeader('Cache-Control', 'public, max-age=31536000')
              }

              // ????HTML ??????????????????
              if (ext === 'html') {
                let htmlContent = fs.readFileSync(filePath, 'utf-8')
                // ?? https://ai-bot.cn/wp-content/ ??/ai-world2/wp-content/
                htmlContent = htmlContent.replace(
                  /https:\/\/ai-bot\.cn\/wp-content\//g,
                  '/ai-world2/wp-content/'
                )
                // ?? https://ai-bot.cn/wp-includes/ ??/ai-world2/wp-includes/
                htmlContent = htmlContent.replace(
                  /https:\/\/ai-bot\.cn\/wp-includes\//g,
                  '/ai-world2/wp-includes/'
                )
                // ????????logo/ ??/ai-world2/logo/
                htmlContent = htmlContent.replace(/href=["']logo\//g, 'href="/ai-world2/logo/')
                htmlContent = htmlContent.replace(/src=["']logo\//g, 'src="/ai-world2/logo/')
                // ????????index.html ??
                htmlContent = htmlContent.replace(/href=["']index\.html/g, 'href="/ai-world2/')
                res.end(htmlContent)
                return
              }

              // ???????????? Vite ??
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
            // ???????????? index.html
            else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
              const indexPath = resolve(filePath, 'index.html')
              if (fs.existsSync(indexPath)) {
                res.setHeader('Content-Type', 'text/html')
                res.setHeader('Cache-Control', 'no-cache')
                const stream = fs.createReadStream(indexPath)
                stream.pipe(res)
                return
              }
            }
            // ??????/ai-world2/ ????????index.html
            else if (url === '/ai-world2' || url === '/ai-world2/') {
              const indexPath = resolve(gitee2AiWorldPath, 'index.html')
              if (fs.existsSync(indexPath)) {
                res.setHeader('Content-Type', 'text/html')
                res.setHeader('Cache-Control', 'no-cache')
                const stream = fs.createReadStream(indexPath)
                stream.pipe(res)
                return
              }
            }
          } catch (_e) {
            // ????????????????
          }
        }

        // ?? ai-bot.cn ?????????????? ai-world ??
        // ???????? HTML ??????????
        if (url.includes('/wp-content/') || url.includes('/wp-includes/')) {
          // ????????????
          const pathMatch = url.match(/\/(wp-content\/.*|wp-includes\/.*)/)
          if (pathMatch) {
            const localPath = resolve(__dirname, 'public', 'ai-world', pathMatch[1])
            try {
              if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
                // ????????Content-Type
                const ext = localPath.split('.').pop()?.toLowerCase() || ''
                const mimeTypes: Record<string, string> = {
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
                  map: 'application/json',
                }

                if (mimeTypes[ext]) {
                  res.setHeader('Content-Type', mimeTypes[ext])
                }

                // ??????
                if (['html', 'json', 'map'].includes(ext)) {
                  res.setHeader('Cache-Control', 'no-cache')
                } else {
                  res.setHeader('Cache-Control', 'public, max-age=31536000')
                }

                // ????????
                const stream = fs.createReadStream(localPath)
                stream.pipe(res)
                return
              }
            } catch (_e) {
              // ????????????????
            }
          }
        }

        // ?????? /src/assets ??????????????????
        // ?? ???????????CSS/SCSS ????Vue ????Vite ??
        if (url.startsWith('/src/assets/')) {
          const localPath = resolve(__dirname, `.${url}`)
          if (fs.existsSync(localPath)) {
            const ext = localPath.split('.').pop() || ''
            // ?? ???Vue ??????Vite ??????????
            if (ext === 'vue' || url.includes('.vue')) {
              return next()
            }
            // ????????CSS/SCSS ????Vite ????
            if (/(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(ext)) {
              if (ext === 'png') res.setHeader('Content-Type', 'image/png')
              else if (ext === 'jpg' || ext === 'jpeg') res.setHeader('Content-Type', 'image/jpeg')
              else if (ext === 'gif') res.setHeader('Content-Type', 'image/gif')
              else if (ext === 'svg') res.setHeader('Content-Type', 'image/svg+xml')
              else if (ext === 'webp') res.setHeader('Content-Type', 'image/webp')
              else if (ext === 'ico') res.setHeader('Content-Type', 'image/x-icon')
              res.setHeader('Cache-Control', 'public, max-age=31536000')
              fs.createReadStream(localPath).pipe(res)
              return
            }
            // ????CSS/SCSS ????????????Vite ??
            // ????????????Vite ????
          }
        }
        next()
      })

      // ??footer?????? - ??/footer/* ??????resources ??
      server.middlewares.use((req, res, next) => {
        if (req.headers?.upgrade === 'websocket') {
          return next()
        }
        const url = req.url || ''
        if (url.startsWith('/footer/')) {
          const resourcesPublicPath = resolve(__dirname, '../ihui-ai-officialsite-resources/public')
          const filePath = resolve(resourcesPublicPath, url.substring(1))
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = filePath.split('.').pop()?.toLowerCase() || ''
              const mimeTypes: Record<string, string> = {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                gif: 'image/gif',
                svg: 'image/svg+xml',
                webp: 'image/webp',
                ico: 'image/x-icon',
              }
              if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext])
              }
              res.setHeader('Cache-Control', 'public, max-age=31536000')
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
          } catch (_e) {
            // 文件不存在或读取失败，静默跳过，继续下一个中间件
          }
        }
        next()
      })

      // ??????????MIME???CORS??
      // ???????CSS/SCSS????Vite?????Vite?????SCSS??????MIME????
      server.middlewares.use((req, res, next) => {
        // ?? WebSocket ????
        if (req.headers?.upgrade === 'websocket') {
          return next()
        }
        const url = req.url || ''

        // ?? ???????CSS/SCSS????Vite??
        // Vite?????SCSS?CSS??????MIME??
        // ???????????Vite????????

        // ?????????MIME??????????????
        if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
          if (url.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png')
          } else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg')
          } else if (url.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif')
          } else if (url.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml')
          } else if (url.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp')
          } else if (url.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon')
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000')
        }

        // ?????????MIME???CORS??
        if (url.endsWith('.woff2')) {
          res.setHeader('Content-Type', 'font/woff2')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else if (url.endsWith('.woff')) {
          res.setHeader('Content-Type', 'font/woff')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else if (url.endsWith('.ttf')) {
          res.setHeader('Content-Type', 'font/ttf')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }

        // ?? OPTIONS ????
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.writeHead(200)
          res.end()
          return
        }

        next()
      })

      // ????????????
      server.httpServer?.once('close', () => {
        console.warn = originalWarn
      })
    },
    // ????????
    buildStart() {
      console.warn = filterWarnings
    },
    buildEnd() {
      // ????????????
      console.warn = originalWarn
    },
  }
}

// ????????HMR????????
const handleDeletedFilesHMR = () => {
  return {
    name: 'handle-deleted-files-hmr',
    configureServer(server: ViteDevServer) {
      // ????????HMR??
      server.ws.on('connection', socket => {
        socket.on('message', data => {
          // ????????????????[0xc001d766b0 ...]??xc00bddb3b0??
          if (typeof data === 'string') {
            // ???????????????
            if (
              /^\[0x[0-9a-fA-F]+(\s+0x[0-9a-fA-F]+)*\]$/.test(data) ||
              /^0x[0-9a-fA-F]+(\s+0x[0-9a-fA-F]+)*$/.test(data)
            ) {
              // ????????????
              return
            }
            try {
              const msg = JSON.parse(data)
              // ????????????
              if (msg.type === 'update' && msg.updates) {
                msg.updates = msg.updates.filter((update: any) => {
                  if (update.path && update.path.includes('Down.vue')) {
                    return false
                  }
                  return true
                })
                // ????????????????
                if (msg.updates.length === 0) {
                  return
                }
              }
            } catch {
              // ?JSON????????
            }
          }
        })
      })
    },
  }
}

const forceNumericHostBanner = () => {
  return {
    name: 'force-numeric-host-banner',
    configureServer(server: ViteDevServer) {
      const original = server.printUrls.bind(server)
      server.printUrls = () => {
        try {
          const port = server.config.server?.port || 8888
          const protocol = server.config.server?.https ? 'https' : 'http'
          const local = `${protocol}://127.0.0.1:${port}/`
          const network = (server.resolvedUrls?.network || []).map(u =>
            u.replace('localhost', '127.0.0.1')
          )
          server.resolvedUrls = {
            local: [local],
            network: network.length ? network : [local],
            open: [local],
          } as any
        } catch {}
        original()
      }
    },
  }
}

// ????CSP???? - ??localhost??27.0.0.1??
const productionCSPOptimizer = () => {
  return {
    name: 'production-csp-optimizer',
    transformIndexHtml(html: string, context: any) {
      // ??????????context.server?????????
      if (context.server) {
        return html // ???????
      }

      // ??CSP meta??????????????????
      // ???????????????????meta??
      const cspRegex =
        /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?content=["']([\s\S]*?)["']\s*\/?>/i
      const match = html.match(cspRegex)

      if (!match || !match[1]) {
        return html // ????CSP????????
      }

      let cspContent = match[1]
      const originalTag = match[0]

      // ??????????????????
      cspContent = cspContent.replace(/\s+/g, ' ').trim()

      // ?????????????img-src, connect-src, frame-src??
      // 1. ?? http://localhost:* ??http://127.0.0.1:* ??????????
      cspContent = cspContent.replace(/\s*https?:\/\/(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')
      // 2. ?? ws://localhost:* ??ws://127.0.0.1:* ??
      cspContent = cspContent.replace(/\s*(ws|wss):\/\/(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')
      // 3. ??????? localhost:* ??127.0.0.1:* ??????????????
      cspContent = cspContent.replace(/\s*(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')

      // ????????????????
      cspContent = cspContent.replace(/\s+/g, ' ').replace(/;\s*;/g, ';').trim()

      // ?????????????????
      cspContent = cspContent.replace(/\s*;\s*/g, '; ').replace(/;\s*$/, '')

      // ????meta??
      const newTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`

      // ????CSP??
      const newHtml = html.replace(originalTag, newTag)

      return newHtml
    },
  }
}

// Monitoring endpoints: dev server receives /api/csp-report (CSP violation)
// and /api/rum (Web Vitals), writing to logs/ for local inspection.
// Production forwards via nginx log_format (see nginx-production.conf).
const monitoringEndpoints = () => {
  const logDir = resolve(__dirname, 'logs')
  try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }) } catch (_) {}
  const appendLog = (file: string, line: string) => {
    try { fs.appendFileSync(resolve(logDir, file), line + '\n', 'utf-8') } catch (_) {}
  }
  const readBody = (req: any): Promise<string> => new Promise((resolveBody) => {
    let data = ''
    req.on('data', (chunk: Buffer | string) => { data += chunk.toString('utf-8') })
    req.on('end', () => resolveBody(data))
  })
  return {
    name: 'monitoring-endpoints',
    apply: 'serve',
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

// P6-4 PWA：dev server 不识别 .webmanifest 后缀
// 加中间件强制 application/manifest+json MIME，否则浏览器安装 PWA 失败
const pwaManifestMiddleware = () => {
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
            // 文件不存在则走 Vite 自身处理
          }
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/

// 单一后端源: 8000 端口 (FastAPI / uvicorn)
// 所有 Vite proxy target 都引用此常量, 修改即全局生效
// 历史双端口 (18000) 已废弃 2026-06-18, 不再使用
// 改端口只改 client/config/ports.ts 一个文件, vite.config.ts 不再持有端口字面量
const BACKEND_TARGET = BACKEND_URL

// P14.4 mock-data 中间件:dev server 期间将 /mock-data/*.json 指向 public/mock-data/
function mockDataPlugin() {
  return {
    name: 'mock-data-static',
    apply: 'serve',
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

export default defineConfig(async ({ mode, command }): Promise<import('vite').UserConfig> => {
  // ??????????
  const isDevelopment = command === 'serve'
  const isProduction = mode === 'production'
  // ??????
  const env = loadEnv(mode, process.cwd(), '')
  // ?? ???? - ????
  // ????????8888??????????????????
  // ????????????????
  const devPort = platformConfig[currentPlatform]?.server?.port || 8888
  const devHost = env.VITE_DEV_HOST || '0.0.0.0'
  const devOrigin = env.VITE_DEV_ORIGIN
  const hmrHost = env.VITE_DEV_HMR_HOST
  const hmrProtocol = env.VITE_DEV_HMR_PROTOCOL || 'ws'
  const enableVisualizer = isProduction && env.VITE_ENABLE_VISUALIZER === 'true'
  /** 使用 Vize（Rust Vue 工具链）作为 SFC 编译后端；仅当 VITE_USE_VIZE=true 时动态加载，避免与当前 Vite 版本冲突 */
  const useVize = env.VITE_USE_VIZE === 'true' || env.VITE_USE_VIZE === '1'
  const vueOrVizePlugin = useVize
    ? (await import('@vizejs/vite-plugin')).default({
        include: /\.vue$/,
        exclude: [/node_modules/],
        isProduction: isProduction,
        sourceMap: isDevelopment,
      })
    : vue({
        template: {
          compilerOptions: {
            isCustomElement: (_tag: string) => false,
          },
        },
      })

  return {
    // ?? base ????
    base: '/',
    plugins: [
      vueOrVizePlugin,
      tailwindcss(),
      // P10 国际化深化测试 mock (仅在 P10_I18N_MOCK=on 时启用)
      ...(process.env.P10_I18N_MOCK === 'on'
        ? [
            {
              name: 'p10-i18n-mock',
              configureServer(server: any) {
                const LANGS = [
                  { code: 'zh-CN', display_name: '简体中文', english_name: 'Chinese (Simplified)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 1, plural_rule: 'other_only', number_grouping: 3 },
                  { code: 'en-US', display_name: 'English', english_name: 'English (US)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'one_other', number_grouping: 3 },
                  { code: 'ar', display_name: 'العربية', english_name: 'Arabic', direction: 'rtl', is_rtl: true, decimal_separator: '٫', thousands_separator: '٬', currency_position: 'after', first_day_of_week: 6, plural_rule: 'arabic', number_grouping: 3 },
                  { code: 'he', display_name: 'עברית', english_name: 'Hebrew', direction: 'rtl', is_rtl: true, decimal_separator: '.', thousands_separator: ',', currency_position: 'after', first_day_of_week: 0, plural_rule: 'hebrew', number_grouping: 3 },
                  { code: 'fr', display_name: 'Français', english_name: 'French', direction: 'ltr', is_rtl: false, decimal_separator: ',', thousands_separator: ' ', currency_position: 'after', first_day_of_week: 1, plural_rule: 'french', number_grouping: 3 },
                  { code: 'es', display_name: 'Español', english_name: 'Spanish', direction: 'ltr', is_rtl: false, decimal_separator: ',', thousands_separator: '.', currency_position: 'before', first_day_of_week: 1, plural_rule: 'one_other', number_grouping: 3 },
                  { code: 'ja', display_name: '日本語', english_name: 'Japanese', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'other_only', number_grouping: 3 },
                  { code: 'ko', display_name: '한국어', english_name: 'Korean', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 0, plural_rule: 'other_only', number_grouping: 3 },
                  { code: 'zh-TW', display_name: '繁體中文', english_name: 'Chinese (Traditional)', direction: 'ltr', is_rtl: false, decimal_separator: '.', thousands_separator: ',', currency_position: 'before', first_day_of_week: 1, plural_rule: 'other_only', number_grouping: 3 },
                ]
                const KEYS = ['common.welcome', 'common.save', 'common.items', 'common.search', 'report.title', 'notify.sensitive_action']
                server.middlewares.use(async (req: any, res: any, next: any) => {
                  if (!req.url || !/^\/api\/v[12]\/i18n-v2\//.test(req.url)) return next()
                  const url = new URL(req.url, 'http://localhost')
                  const path = url.pathname.replace(/^\/api\/v[12]\/i18n-v2/, '')
                  let body: any = {}
                  if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const chunks: Buffer[] = []
                    for await (const c of req) chunks.push(c as Buffer)
                    if (chunks.length) {
                      try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) } catch { /* ignore */ }
                    }
                  }
                  const respond = (data: any) => {
                    res.setHeader('content-type', 'application/json')
                    res.statusCode = 200
                    res.end(JSON.stringify({ code: 0, msg: 'success', data, timestamp: Date.now() }))
                  }
                  if (path === '/languages') return respond({ languages: LANGS, count: LANGS.length })
                  const langMatch = path.match(/^\/languages\/([^/]+)$/)
                  if (langMatch) {
                    const m = LANGS.find(l => l.code === langMatch[1]) || LANGS[0]
                    return respond(m)
                  }
                  if (path === '/keys') return respond({ keys: KEYS, count: KEYS.length })
                  if (path.startsWith('/entry/')) {
                    const key = decodeURIComponent(path.replace('/entry/', ''))
                    return respond({ key, translations: { 'zh-CN': `${key} 中文`, 'en-US': `${key} EN` }, plurals: {}, description: '', updated_at: 1, version: 1 })
                  }
                  if (path === '/pull') {
                    const lang = url.searchParams.get('lang')
                    const keys: Record<string, string> = {}
                    KEYS.forEach(k => { keys[k] = lang ? `[${lang}] ${k}` : k })
                    return respond({ scope: lang || 'all', keys, plurals: {}, count: KEYS.length })
                  }
                  if (path === '/push') return respond({ key: body.key, version: 1, updated_at: 1, translations: { 'zh-CN': body.value || '' } })
                  if (path === '/push-plural') return respond({ key: body.key, version: 1, updated_at: 1, plurals: { [body.lang || 'zh-CN']: body.forms || {} } })
                  if (path === '/sync-log') return respond({ events: [], count: 0 })
                  if (path === '/stats') return respond({ total_keys: KEYS.length, per_language: { 'zh-CN': KEYS.length, 'en-US': KEYS.length }, plural_keys: 1, languages: 9 })
                  if (path === '/diff') return respond({ lang_a: url.searchParams.get('lang_a'), lang_b: url.searchParams.get('lang_b'), a_missing: [], b_missing: [], identical: [{ key: 'common.welcome', a: '欢迎', b: 'Welcome' }], total: KEYS.length })
                  if (path === '/format') {
                    const kind = body.kind || 'number'
                    let result = ''
                    if (kind === 'number') result = '1,234.56'
                    else if (kind === 'currency') result = (body.currency || 'USD') + ' 99.50'
                    else if (kind === 'date') result = '2026-06-18'
                    else if (kind === 'plural') result = '5 items'
                    return respond({ kind, lang: body.lang, result, is_rtl: body.lang === 'ar' || body.lang === 'he' })
                  }
                  if (path === '/translate') return respond({ key: body.key, lang: body.lang, count: body.count, text: `${body.lang || 'zh-CN'}:${body.key}`, is_rtl: body.lang === 'ar' || body.lang === 'he' })
                  if (path.startsWith('/plural/')) {
                    const key = decodeURIComponent(path.replace('/plural/', ''))
                    const lang = url.searchParams.get('lang') || 'zh-CN'
                    const samples = [0, 1, 2, 3, 5, 11, 21, 100, 101].map(n => ({
                      count: n,
                      category: n === 0 ? 'zero' : n === 1 ? 'one' : n === 2 ? 'two' : n >= 11 && n <= 99 ? 'many' : 'other',
                      text: `${n} ${key} [${lang}]`,
                    }))
                    return respond({ key, lang, is_rtl: lang === 'ar' || lang === 'he', samples })
                  }
                  return respond({})
                })
              },
            },
          ]
        : []),
      // ????CSP?? - ??localhost??27.0.0.1??
      productionCSPOptimizer(),
      forceNumericHostBanner(),
      // ??Sass?????new URL()??
      filterSassWarnings(),
      monitoringEndpoints(),
      pwaManifestMiddleware(),
      // ????????HMR??
      handleDeletedFilesHMR(),
      // P14.4 种子数据 mock-data 中间件
      mockDataPlugin(),
      // ?????? API ???????? VITE_BAIDU_SPEECH_* ??????      baiduSpeechPlugin(),
      // ????Vue?Element Plus?API - ????????????
      AutoImport({
        imports: [
          'vue',
          {
            'vue-router': ['useRouter', 'useRoute'],
            pinia: ['defineStore', 'storeToRefs'],
          },
        ],
        resolvers: [
          ElementPlusResolver({
            importStyle: false,
            exclude: /^ElMessage2/,
          }),
        ],
        eslintrc: {
          enabled: true,
          filepath: './.eslintrc-auto-import.json',
          globalsPropValue: true,
        },
        vueTemplate: true,
        // ??????????????????
        dts: false,
        // ????????????
        include: [/\.[tj]sx?$/, /\.vue$/],
        exclude: [
          /[\\/]node_modules[\\/]/,
          /[\\/]\.git[\\/]/,
          /[\\/]dist[\\/]/,
          /[\\/]test[\\/]/,
          /[\\/]__tests__[\\/]/,
        ],
      }),
      // ?????? - ??????????????
      Components({
        dirs: [
          'src/components/design-system',
          'src/components/agents',
          'src/components/ai',
          'src/components/auth',
          'src/components/common',
          'src/components/header',
          'src/components/home',
          'src/components/mcp',
          'src/components/statistics',
          'src/components/user',
        ],
        resolvers: [
          ElementPlusResolver({
            importStyle: false,
          }),
        ],
        exclude: [
          /ElLoadingSpinner/,
          /src\/components\/ui\//,
          /src\/components\/top-up\//,
          /src\/components\/distribution\//,
          /src\/components\/demo\//,
          /src\/components\/agentic\//,
          /src\/components\/workspaces\//,
          /src\/components\/markdown\//,
          /src\/components\/InputArea\//,
          /src\/components\/footer\//,
          /src\/components\/mobile\//,
          /src\/components\/search\//,
        ],
        deep: false,
        extensions: ['vue'],
        // ?????????????
        dts: false,
        // ????????????????
        // include: [/^[A-Z][a-zA-Z0-9]*\.vue$/],  // 临时注释：排查 Element Plus 组件无法解析问题
      }),
      // ??????????- ??????????
      enableVisualizer &&
        visualizer({
          filename: 'dist/visualizer-stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
      // ???? ai-world ?? HTML ???????? link?? dev ????????
      (() => {
        const fontLink = '<link rel="stylesheet" href="/ai-world/ai-world-unified-fonts.css">\n'
        return {
          name: 'ai-world-inject-fonts',
          apply: 'build',
          configResolved(config) {
            (this as any)._outDir = config.build.outDir
          },
          closeBundle() {
            const outDir = (this as any)._outDir
            if (!outDir) return
            const aiWorldDir = resolve(outDir, 'ai-world')
            if (!fs.existsSync(aiWorldDir)) return
            const inject = (filePath: string) => {
              if (filePath.endsWith('.html')) {
                let html = fs.readFileSync(filePath, 'utf-8')
                if (!html.includes('ai-world-unified-fonts.css') && html.includes('</head>')) {
                  html = html.replace('</head>', fontLink + '</head>')
                  fs.writeFileSync(filePath, html)
                }
              }
            }
            const walk = (dir: string) => {
              try {
                for (const name of fs.readdirSync(dir)) {
                  const full = resolve(dir, name)
                  const stat = fs.statSync(full)
                  if (stat.isDirectory()) walk(full)
                  else inject(full)
                }
              } catch (_) {
                // 目录不存在或读取失败，静默跳过
              }
            }
            walk(aiWorldDir)
          },
        }
      })(),
    ],
    // ??????
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        open: resolve(__dirname, 'src/open-platform'),
        'lucide-vue-next': resolve(__dirname, 'src/lib/lucide-fallback.ts'),
        '~projects': resolve(__dirname, 'projects'),
        // ?? Vue ????????
        vue: 'vue/dist/vue.esm-bundler.js',
      },
    },
    // ??????- ??process.cwd()???????????????????
    // root: process.cwd(), // ??????????
    // ========================================
    // ??????? - ??????
    // ========================================
    // ?? ??????????????????
    // 统一使用8888端口，不再使用其他端口
    // ========================================
    server: {
      // ?????? - ?? 0.0.0.0 ????????????? localhost ??127.0.0.1??
      host: devHost,
      // ?? ????- ????888??????????????????????
      // ??8888??????????????????????
      // ????8888????????????????Vite????
      port: devPort,
      // ??????HMR ???????????????????????????
      origin: devOrigin || undefined,
      // Vite 5.x ??HMR ??
      hmr: isDevelopment
        ? {
            // 修复: 加括号, 让 || 与三目正常嵌套
            // 原: hmrHost || devHost === '0.0.0.0' ? 'localhost' : devHost  → 实际解析为 hmrHost || (devHost === '0.0.0.0' ? 'localhost' : devHost)
            host: hmrHost || (devHost === '0.0.0.0' ? 'localhost' : devHost),
            port: devPort,
            protocol: hmrProtocol,
            overlay: false, // ?? HMR ???????? invalidateTypeCache ??
            clientPort: devPort, // ??????????
            timeout: 60000, // ?? HMR ??????60 ??
          }
        : false, // ?????? HMR
      // ???????
      open: false,
      // ?? ???????- ???true????????????????????
      strictPort: true,
      // CORS?? - ??????
      cors: true,
      // ??????????CSP????Vite HMR ????unsafe-eval??????????
      headers: {
        'Content-Security-Policy': DEV_CSP_STRING,
        'Content-Security-Policy-Report-Only': PROD_CSP_STRING,
        'Report-To': REPORT_TO_HEADER,
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
      // ???? - ??????????????
      watch: {
        ignored: [
          '**/coverage/**',
          '**/.git/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.vite/**',
          '**/test-results/**',
          '**/projects/**/node_modules/**',
          '**/projects/**/dist/**',
          '**/ai-world/**',
          '**/html/**',
          '**/gitee2/**',
          '**/resources/**',
          '**/*.map',
          '**/public/**',
          '**/node_modules/.vite/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/logs/**',
          '**/*.log',
        ],
        // 2026-07-04 立: Windows 上原生 fs.watch 不稳定, 偶发丢失文件变更事件,
        // 导致 HMR 不刷新或样式修改不生效 (memory 已记录"Vite HMR 文件监视器在
        // Windows 环境下会导致修改被还原"). 改用 polling 模式可靠检测变更,
        // 虽略增 CPU 但彻底杜绝"改完样式重启后丢失"问题.
        usePolling: true,
        interval: 200,
        // 原子写入检测: 防止编辑器半写状态触发误事件
        atomic: true,
        // ????????????
        followSymlinks: false,
        // ??????????????
        depth: 3,
      },
      fs: {
        strict: true,
        deny: [
          // ????????????????????
          'coverage',
        ],
        allow: [
          // ????????????????
          resolve(__dirname),
          resolve(__dirname, 'src'),
          resolve(__dirname, 'public'),
          resolve(process.cwd()),
        ],
      },
      // ?? ????
      proxy: {
        // PDF处理服务代理 - 本地Python后端
        '/api/pdf': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('PDF API代理错误:', err)
            })
          },
        },
        // base: 1 智能体列表等接口, 2026-06-20 切到 Python 后端 (v1_api_kou.py, 40 端点)
        '/api-kou': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          // /api-kou/admin/aiworld/* → /api/v1/ai-bot-sites/* (AI世界站点管理走真实端点)
          // /api-kou/learn/* → /api/v1/learn/* (学习模块)
          // /api-kou/behavior/* → /api/v1/behavior/* (行为管理)
          // 其他 /api-kou/* 保持原路径 (走 v1_api_kou.py 或 mock 兜底)
          rewrite: (path: string) => {
            if (path.startsWith('/api-kou/admin/aiworld/')) {
              return path.replace(/^\/api-kou\/admin\/aiworld/, '/api/v1/ai-bot-sites')
            }
            if (path.startsWith('/api-kou/learn/')) {
              return path.replace(/^\/api-kou\/learn/, '/api/v1/learn')
            }
            if (path.startsWith('/api-kou/behavior/')) {
              return path.replace(/^\/api-kou\/behavior/, '/api/v1/behavior')
            }
            return path
          },
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('api-kou proxy error:', err)
            })
          },
        },
        // P22-联调: /login/pwd/* 已迁移到 Python 后端 (v1_login_pwd.py, 10 个端点)
        // 2026-06-21 联调: /login/pwd/* 兼容旧路径, 重写到 /api/v1/auth/*
        '/login/pwd': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/login\/pwd/, '/api/v1/auth'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('login/pwd proxy error:', err)
            })
          },
        },
        // P10 国际化深化测试 mock - 仅在 P10_I18N_MOCK=on 时启用
        // (移到下方 plugins 中以正确注册为 server middleware)
        // P22-联调: /login/wechat/* 已迁移到 Python 后端 (v1_third_party_auth.py 占位实现)
        '/login/wechat': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('login/wechat proxy error:', err)
            })
          },
        },
        // P22-联调: /auth/* 已迁移到 Python 后端 (v1_third_party_auth.py)
        // 含: /auth/wechat/*, /auth/alipay/*, /auth/google/*, /auth/apple/*, /auth/oauth/*, /auth/* service 端点
        '/auth': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/auth/, '/api/v1/auth'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('auth proxy error:', err)
            })
          },
        },
        // Ruoyi 后台 API (已迁移到 Python FastAPI, /dev-api/xxx → /xxx)
        '/dev-api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/dev-api/, ''),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Ruoyi 后台 API 代理错误:', err)
            })
          },
        },
        // ⚠️ 教育 API 代理 — 必须通过环境变量配置, 默认值指向外部 IP, 漏配会导致本地请求打到陌生服务器
        '/api/edu': {
          target: (() => {
            const base = env.VITE_EDU_API_BASE;
            if (!base) throw new Error('[vite] VITE_EDU_API_BASE 环境变量未设置, 请在 .env.local 中配置教育平台 API 地址');
            return base;
          })(),
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/api\/edu/, ''),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('???? API ????:', err)
            })
          },
        },
        // ???? SSO ?????????? edu ???? CORS??        // ?? ????/api ????????????'/api' ????????????????/api/xxx ??
        // ??SSO ???????????user-edu????
        '/edu-sso': {
          target: env.VITE_EDU_SSO_BASE || 'http://127.0.0.1:6600',
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => {
            const newPath = path.replace(/^\/edu-sso\/api/, '')
            console.log(`[EDU-SSO??] ???? ${path} ?????? ${newPath}`)
            return newPath
          },
          configure: (proxy: any, _options: any) => {
            proxy.on('proxyReq', (proxyReq: any, req: any) => {
              console.log(`[EDU-SSO??] ????? ${req.method} ${req.url} ??${env.VITE_EDU_SSO_BASE || 'http://127.0.0.1:6600'}${proxyReq.path}`)
            })
            proxy.on('proxyRes', (proxyRes: any, req: any) => {
              console.log(`[EDU-SSO??] ????: ${req.url} ?????: ${proxyRes.statusCode}`)
            })
            proxy.on('error', (err: any, req: any, _res: any) => {
              console.log(`[EDU-SSO??] ????: ${req.url}`, err.message)
            })
          },
        },
        // community 已迁移到 Python 后端, 2026-06-29 修正: v2_community.py 不存在, 走 v1 circle 模块
        '/community/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/community\//, '/api/v1/circle/'),
        },
        // ???????? /api -> /ai-program/plaza???? 8080 ?????????????? /plaza/
        // P22-联调: /tools/ 已迁移到 Python 后端 (v1_tools.py, 10 个端点)
        '/tools/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/tools\//, '/api/v1/tools/'),
        },
        // P22-联调: /content/ 已迁移到 Python 后端 (v1_content.py, 10 个端点)
        '/content/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/content\//, '/api/v1/content/'),
        },
        '/statistics/': {
          target: BACKEND_TARGET, // Python 后端 (v1_statistics.py), 2026-06-20 切换
          changeOrigin: true,
          rewrite: (path: string) => path,
        },
        // 2026-06-29: 新增短路径代理, 避免被 mock catch-all 拦截
        '/ranking/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/ranking\//, '/api/v1/ranking/'),
        },
        '/circle/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/circle\//, '/api/v1/circle/'),
        },
        '/exam/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/exam\//, '/api/v1/exam/'),
        },
        '/visit-tracking/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/visit-tracking\//, '/api/v1/visit/'),
        },
        '/commission/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/commission\//, '/api/v1/finance/commission/'),
        },
        '/home/': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/home\//, '/api/v1/resource/home/'),
        },
        // developer 已迁移到 Python 后端 (v1_developer.py), 2026-06-20 切换
        '/api/developer': {
          target: BACKEND_TARGET, // Python 后端
          changeOrigin: true,
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('developer API 代理错误:', err)
            })
          },
        },
        // 管理后台 /admin API 代理
        // 2026-06-18: 项目从 Java(RuoYi) 迁移到 Python(FastAPI)
        // 2026-06-29: v2_admin.py 不存在, 改为 /api/v1 (admin_panel.py RuoYi 系统路由)
        // 前端调用 /admin/*，后端真实路径为 /api/v1/*，通过 rewrite 桥接
        '/admin': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          // 2026-06-29: v2_admin.py 不存在, 改为 /api/v1 (admin_panel.py RuoYi 系统路由)
          rewrite: (path: string) => path.replace(/^\/admin/, '/api/v1'),
          // /admin-ruoyi 是前端路由，不代理到后端
          // 页面导航请求(Accept: text/html)是前端 SPA 路由,不代理到后端,交给 vite SPA fallback 返回 index.html
          // 这样直接访问/刷新 /admin/xxx 页面不会被代理转发为 API 请求
          bypass: (req: any) => {
            if (req.url?.startsWith('/admin-ruoyi')) {
              return req.url
            }
            if (req.headers?.accept?.includes('text/html')) {
              return req.url
            }
          },
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Admin API proxy error:', err)
            })
          },
        },
        // OpenClaw 已迁移到 Python 后端 (v1_openclaw.py), 2026-06-20 切换
        '/api/openclaw': {
          target: BACKEND_TARGET, // Python 后端
          changeOrigin: true,
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('OpenClaw API 代理错误:', err)
            })
          },
        },
        // P22-联调: v1→v2 rewrite 已删除, v1/v2 路由在后端并存
        // 客服 WebSocket：ws://localhost:8888/customer-service/chat -> Python 8000
        '/customer-service': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          configure: (proxy: any) => {
            proxy.on('error', (err: any) => console.log('客服 WebSocket 代理错误:', err))
          },
        },
        // P22-联调: 客服 HTTP API 已统一为 /api/v1/customer_service/* (下划线)
        // 前端调用走 /api 兜底代理, 不再需要专门的 /api/customer-service 代理规则
        '/api/zhs_api_ticket': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path,
          configure: (proxy: any) => {
            proxy.on('error', (err: any) => console.log('工单 API 代理错误:', err))
          },
        },
        // ??API???Java???? ????92.168.1.25:8080
        // ???????https://bsm.aizhs.top/prod-api/swagger-ui/index.html
        // ??Swagger??????????
        // - ????: /login/pwd/login
        // - ????: /login/pwd/registerLogin
        // - ????: /auth/xxx, /login/pwd/xxx ??
        // ?? ????????????/api-test???????? API ??
        // 2026-06-21 联调: /api/user/* → /api/v1/user/* (后端用户路由在 v1 下)
        '/api/user': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/user/, '/api/v1/user'),
        },
        // 通用 /api 兜底代理：默认指向本地 Python FastAPI 后端 (含 /prod-api 镜像)
        // Java 后端 (bsm.aizhs.top) 仅在远程 URL 显式配置时使用
        '/api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          // 直接转发 /api/* 到后端, 后端已注册 /api/* 具体路由 + catch-all 兜底
          rewrite: (path: string) => path,
          bypass: (req: any) => {
            const url = req.url || ''
            if (url === '/api-test' || url.startsWith('/api-test/')) {
              return url
            }
            return null
          },
        },
        // 后端健康检查端点 (/health, /health/live, /health/ready)
        '/health': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path,
        },
        // ???????? /api ??????
        // P22-联调: /message 已迁移到 Python 后端 (v1_message.py, 5 个端点)
        '/message': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/message/, '/api/v1/message'),
          // /messages (前端 SPA 路由) 不能被 /message 代理前缀吞掉
          bypass: (req: any) => {
            const url = req.url || ''
            if (url === '/messages' || url.startsWith('/messages?') || url.startsWith('/messages/')) {
              // 返回原始 URL 字符串 = 跳过代理, 由 Vite SPA 中间件返回 index.html
              return url
            }
            return null
          },
        },
        // ????????????????????
        // 统一使用8888端口，不再使用其他端口
        // ??????????base: "/open/"???????????
        // Vite ?????????? /open ?????
        // ?????????????????/open

        '/system': {
          target: BACKEND_TARGET, // Python FastAPI 后端
          changeOrigin: true,
          rewrite: (path: string) => path,
        },
        // ai-program 已迁移到 Python 后端 (FastAPI), 2026-06-20 切换
        // 后端路由无 /ai-program 前缀, 代理时去掉前缀
        '/ai-program': {
          target: BACKEND_TARGET, // Python 后端
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/ai-program/, ''),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('ai-program proxy error:', err)
            })
          },
        },

        // WebSocket ????
        // FastAPI WebSocket ????
        '/api/v1/ws/chat': {
          target: BACKEND_TARGET, // Python ??
          changeOrigin: true,
          ws: true, // ??WebSocket??
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('FastAPI WebSocket ????:', err)
            })
          },
        },
        // 支付状态 WebSocket: 前端 ws://host:8888/payment/status/{orderNo}
        // 2026-06-21 联调: 重写到 /ws/payment/status/{orderNo}, 后端 app/ws/payment_status.py
        '/payment': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) => path.replace(/^\/payment/, '/ws/payment'),
        },
        // ?? WebSocket ??
        // 2026-06-19: 切到 Python 后端 (app/ws/* 已有 /ws/chat, /ws/notice, /ws/tts/stream 等路由)
        '/ws': {
          target: BACKEND_TARGET, // Python ??
          changeOrigin: true,
          ws: true, // ??WebSocket??
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('?? WebSocket ????:', err)
            })
          },
        },
        // Socket.IO WebSocket (已迁移到 Python 后端, app/ws/socket_io_server.py), 2026-06-20 切换
        '/socket.io': {
          target: BACKEND_TARGET, // Python 后端
          changeOrigin: true,
          ws: true, // 启用 WebSocket 代理
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Socket.IO WebSocket 代理错误:', err)
            })
          },
        },
        // Qwen WebSocket 流式对话
        // 2026-06-29 联调: 重写到后端实际端点 /api/v1/chat/ws/qwen-omni (app/api/v1/chat/qwen_omni.py)
        // 前端 COZE_PATHS.ws.qwen = /cozeZhsApi/ws/qwen/stream, 经此 rewrite 对齐后端 /api/v1/chat/ws/qwen-omni
        '/cozeZhsApi/ws/qwen/stream': {
          target: BACKEND_TARGET, // Python 后端 WebSocket
          changeOrigin: true,
          ws: true, // 启用 WebSocket 代理
          rewrite: (path: string) =>
            path.replace(/^\/cozeZhsApi\/ws\/qwen\/stream/, '/api/v1/chat/ws/qwen-omni'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Qwen WebSocket 代理错误:', err)
            })
          },
        },
        // 通义千问全模态 WebSocket (chatomni)
        // 2026-06-29 联调: 前端 COZE_PATHS.ws.chatomni = /cozeZhsApi/ws/chatomni/stream
        // 后端无独立 chatomni 端点, 复用 qwen-omni 端点 (app/api/v1/chat/qwen_omni.py)
        '/cozeZhsApi/ws/chatomni/stream': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) =>
            path.replace(/^\/cozeZhsApi\/ws\/chatomni\/stream/, '/api/v1/chat/ws/qwen-omni'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('QwenOmni(chatomni) WebSocket 代理错误:', err)
            })
          },
        },
        // 智谱 AI WebSocket
        // 2026-06-29 联调: 前端 COZE_PATHS.ws.zhipu = /cozeZhsApi/ws/zhipu/stream
        // 重写到后端 /api/v1/chat/ws/zhipu (app/api/v1/chat/zhipu.py)
        '/cozeZhsApi/ws/zhipu/stream': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) =>
            path.replace(/^\/cozeZhsApi\/ws\/zhipu\/stream/, '/api/v1/chat/ws/zhipu'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Zhipu WebSocket 代理错误:', err)
            })
          },
        },
        // 豆包 WebSocket
        // 2026-06-29 联调: 前端 COZE_PATHS.ws.doubao = /cozeZhsApi/ws/doubao/streamDou
        // 重写到后端 /api/v1/chat/ws/doubao (app/api/v1/chat/doubao.py)
        '/cozeZhsApi/ws/doubao/streamDou': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) =>
            path.replace(/^\/cozeZhsApi\/ws\/doubao\/streamDou/, '/api/v1/chat/ws/doubao'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Doubao WebSocket 代理错误:', err)
            })
          },
        },
        // DeepSeek WebSocket
        // 2026-06-29 联调: 前端 COZE_PATHS.ws.chatdeepseek = /cozeZhsApi/ws/chatdeepseek/stream
        // 注意: 后端 DeepSeek 仅有 HTTP SSE 端点 (app/api/v1/chat/deepseek.py), 无 WS 端点
        // 此处保留代理透传, 前端调用时应改用 SSE; 此规则避免 WS 连接被 catch-all 错误兜底
        '/cozeZhsApi/ws/chatdeepseek/stream': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) =>
            path.replace(/^\/cozeZhsApi\/ws\/chatdeepseek\/stream/, '/api/v1/chat/ws/deepseek'),
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('DeepSeek WebSocket 代理错误 (后端无 WS, 应改用 SSE):', err)
            })
          },
        },
        // Agentic AI ???? - ??????Python ?? - 统一使用8888端口
        // ?? ??????????/api ??????????????????
        '/api/ai/agentic': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path,
          ws: false,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Agentic AI 代理错误:', err)
            })
          },
        },
        '/api/ai/agentic/swarm': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path: string) => path,
          ws: true,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('Agentic AI WebSocket 代理错误:', err)
            })
          },
        },
        // Python /api/v1 ??? /api ?????????????
        // Python ???FastAPI????- ??????
        '/python': {
          target: BACKEND_TARGET, // Python 本地后端
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/python/, ''),
        },
        // 本地上传文件 (MinIO fallback)
        '/local_uploads': {
          target: BACKEND_TARGET,
          changeOrigin: true,
        },
        // ihui-ai-api/user-sk → 本地后端
        '/ihui-ai-api/user-sk': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace('/ihui-ai-api/user-sk', '/api/v1/auth/user-sk'),
        },
        // ihui-ai-api/llm → 本地后端 (2026-07-03 修复 prefix 错位)
        // 后端 app/api/v1/router.py 第 794 行: include_router(llm_ws_router, prefix="/llm")
        // 而 llm_ws_router 自身 prefix="/ihui-ai-api/llm", 拼接后真实路径 = /api/v1/llm/ihui-ai-api/llm/*
        // 因此前端 /ihui-ai-api/llm/* 必须重写为 /api/v1/llm/ihui-ai-api/llm/* (而非通用 /api/v1/llm/*)
        // 必须在 /ihui-ai-api 通用规则前声明, vite proxy 按顺序匹配
        '/ihui-ai-api/llm': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace('/ihui-ai-api/llm', '/api/v1/llm/ihui-ai-api/llm'),
        },
        // ihui-ai-api 网关代理, 2026-06-20 切到 Python 后端 (v1/llm/ws.py 已实现 3 端点)
        // 2026-06-21 修复: /ihui-ai-api/* 重写到 /api/v1/* (后端真实路径)
        // /ihui-ai-api/user-sk 和 /ihui-ai-api/llm 已有上方更具体的规则优先匹配, 不受影响
        '/ihui-ai-api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace('/ihui-ai-api', '/api/v1'),
        },
        // ai-bot.cn 资源 - 重写到 /ai-world/ 静态目录
        // 注意: target 指向 Vite 自身 (FRONTEND_URL), 是历史遗留的"自代理"配置
        // 由下方 ai-world middleware 实际处理文件读取, 此 proxy 仅占位触发 rewrite
        '/wp-content': {
          target: FRONTEND_URL,
          changeOrigin: true,
          rewrite: (path: string) => {
            return '/ai-world' + path
          },
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('ai-bot.cn 资源代理:', err)
            })
          },
        },
        '/wp-includes': {
          target: FRONTEND_URL,
          changeOrigin: true,
          rewrite: (path: string) => {
            return '/ai-world' + path
          },
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('ai-bot.cn 资源代理:', err)
            })
          },
        },
        // ??AI????????????????????
        // ??????????100????????? /learn-ai ??????

        // ========================================
        // ?? API ????????CORS ??????
        // ========================================
        // ?? ??????????????
        // ???????????????????
        // ========================================
        // ???? API - bsm.aizhs.top/prod-api/ai (base: 2)
        // ???category?getPlazaList?addPlazaModel?getPlazaInfoById
        // 2026-06-20: 切到 Python 后端 (v1_prod_api_ai.py 实现 9 个 /remote/agent/* 端点)
        // 登录/微信登录/分类等端点已在 v1_login_pwd.py / v1_wechat_login.py / mock/__init__.py 实现
        // 前端使用位置: src/api/core/client.ts (BASE_URL_2), src/services/api.ts, src/utils/request.ts
        '/prod-api/ai': {
          target: BACKEND_TARGET, // Python 后端
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path, // 路径不重写, 原样转发
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('prod-api/ai 代理错误:', err)
            })
          },
        },
        // ???? API - bsm.aizhs.top/prod-api (base: 4)
        // ?? ??????????/prod-api/ai ????????/prod-api ????
        // ?? ??????????????????192.168.1.25:8080??????????
        // P22-联调: /prod-api/login/pwd, /prod-api/auth, /prod-api/login/wechat 三个死代理已删除
        // (前端实际走 /login/pwd, /auth, /login/wechat 代理到 Python 后端)
        // 2026-06-19: 切到 Python 后端 (app/api/mock/__init__.py 已有 /prod-api/* 镜像路由)
        '/prod-api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path,
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('prod-api ????:', err)
            })
          },
        },
        // Python 后端 (base: 3) - cozeZhsApi，代理到生产环境 zca.aizhs.top（点赞/收藏等接口）
        // 视频合成等 WebSocket 全路径：wss://zca.aizhs.top/cozeZhsApi/dashscope/video-synthesis/ws
        '/cozeZhsApi': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          secure: false, // ??????HTTPS??
          rewrite: (path: string) => path,
          ws: true, // 开启 WebSocket 代理，否则 /cozeZhsApi/dashscope/video-synthesis/ws 无法连上
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('FastAPI??API????:', err)
            })
          },
        },
      },
      // HMR???????? ???????Vite??????
      // ?host??.0.0.0??HMR?????
    },
    // ????
    build: {
      target: 'es2022', // ?? es2022 ????top-level await
      outDir: platformConfig[currentPlatform]?.build?.outDir || 'dist',
      assetsDir: platformConfig[currentPlatform]?.build?.assetsDir || 'assets',
      sourcemap: false,
      chunkSizeWarningLimit: 3000, // 提高阈值，大 vendor/views 已做 manualChunks 拆分
      cssCodeSplit: true, // ??CSS????
      cssMinify: isProduction ? 'esbuild' : false, // 使用 esbuild 压缩 CSS
      // 自动注入 <link rel="modulepreload"> 到关键 chunk，提前并行下载
      modulePreload: {
        polyfill: true, // 兼容旧浏览器（Safari < 16.3 / Firefox < 108）
        resolveDependencies: (_, deps) => {
          // 排除大型 async chunk，避免首屏被预加载浪费带宽
          // 这些组件通过 defineAsyncComponent 按需加载，不应在首屏 modulepreload
          const exclude = [
            'AIChat',
            'AIChatLegacy',
            'pdf',
            'echarts',
            'highlight',
            // vue-office 已拆分为 5 个子模块，全部排除首屏预加载
            'vue-office-docx',
            'vue-office-excel',
            'vue-office-presentation',
            'vue-office-pdf',
            'vue-office-core',
            // 国际化语言包按需加载，首屏只 modulepreload zh-CN
            'locale-en-',
            'locale-ja-',
            'locale-ko-',
            'locale-zh_TW-',
            'locale-zh-TW-',
          ]
          const filtered = deps.filter((dep) => !exclude.some((k) => dep.includes(k)))
          // 关键 chunk 排在前面，其他自动按依赖顺序
          return filtered.sort((a, b) => {
            const priority = ['vue-vendor', 'vue-i18n', 'locales', 'element-plus', 'pinia', 'vueuse', 'axios', 'vue-router']
            const ai = priority.indexOf(a)
            const bi = priority.indexOf(b)
            if (ai !== -1 && bi !== -1) return ai - bi
            if (ai !== -1) return -1
            if (bi !== -1) return 1
            return 0
          })
        },
      },
      // 使用 esbuild 作为 JS 压缩器，避免部分 terser 在现代语法下的 TDZ（Cannot access X before initialization）问题
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        // ?????????????????
        onwarn(warning: any, warn: (warning: any) => void) {
          // ?????????
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
            warning.message?.includes('dynamically imported') ||
            warning.message?.includes('will not move module')
          ) {
            return
          }
          // ????chunk ???ECharts ??????????chunk??
          if (
            warning.code === 'EMPTY_BUNDLE' ||
            warning.message?.includes('empty chunk') ||
            warning.message?.includes('Generated an empty chunk')
          ) {
            return
          }
          // ?? new URL() ????????????????????
          if (
            warning.message?.includes('new URL') ||
            warning.message?.includes("doesn't exist at build time")
          ) {
            return
          }
          warn(warning)
        },
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('vue/dist')) return 'vue-vendor'
              if (id.includes('pinia')) return 'pinia'
              if (id.includes('vue-router')) return 'vue-router'
              if (id.includes('vue-i18n')) return 'vue-i18n'
              if (id.includes('element-plus')) {
                if (id.includes('@element-plus/icons-vue')) return 'element-plus-icons'
                return 'element-plus'
              }
              if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
              if (id.includes('axios')) return 'axios'
              if (id.includes('pdfjs-dist')) return 'pdf'
              if (id.includes('highlight.js')) return 'highlight'
              if (id.includes('socket.io-client')) return 'socket-io'
              if (id.includes('@vueuse')) return 'vueuse'
              if (id.includes('dayjs')) return 'dayjs'
              if (id.includes('marked') || id.includes('dompurify')) return 'markdown'
              if (id.includes('@vue-office')) {
                if (id.includes('@vue-office/docx')) return 'vue-office-docx'
                if (id.includes('@vue-office/excel')) return 'vue-office-excel'
                if (id.includes('@vue-office/presentation')) return 'vue-office-presentation'
                if (id.includes('@vue-office/pdf')) return 'vue-office-pdf'
                return 'vue-office-core'
              }
              if (id.includes('lodash')) return 'lodash'
              if (id.includes('crypto-js')) return 'crypto'
              if (id.includes('uuid')) return 'uuid'
              if (id.includes('qrcode')) return 'qrcode'
              if (id.includes('clsx') || id.includes('class-variance-authority')) return 'utils'
              if (id.includes('@iconify')) return 'iconify'
              if (id.includes('monaco-editor')) return 'monaco'
              if (id.includes('codemirror')) return 'codemirror'
              if (id.includes('katex')) return 'katex'
              if (id.includes('mermaid')) return 'mermaid'
              if (id.includes('html2canvas')) return 'html2canvas'
              if (id.includes('jspdf')) return 'jspdf'
              if (id.includes('xlsx')) return 'xlsx'
              if (id.includes('jszip')) return 'jszip'
              if (id.includes('file-saver')) return 'file-saver'
              if (id.includes('async-validator')) return 'async-validator'
              if (id.includes('@floating-ui')) return 'floating-ui'
              if (id.includes('@popperjs')) return 'popper'
              if (id.includes('normalize-wheel')) return 'normalize-wheel'
              if (id.includes('resize-observer-polyfill')) return 'resize-observer'
              if (id.includes('memoize-one')) return 'memoize'
              if (id.includes('lodash-es')) return 'lodash-es'
              if (id.includes('@babel')) return 'babel'
              if (id.includes('core-js')) return 'core-js'
              if (id.includes('regenerator-runtime')) return 'regenerator'
              if (id.includes('three') || id.includes('@three')) return 'three'
              if (id.includes('video.js') || id.includes('videojs')) return 'videojs'
              if (id.includes('d3') || id.includes('@d3')) return 'd3'
              if (id.includes('chart.js') || id.includes('chartjs')) return 'chartjs'
              if (id.includes('animejs') || id.includes('anime.js')) return 'anime'
              if (id.includes('gsap')) return 'gsap'
              if (id.includes('swiper')) return 'swiper'
              if (id.includes('sortablejs')) return 'sortable'
              if (id.includes('cropperjs')) return 'cropper'
              if (id.includes('quill')) return 'quill'
              if (id.includes('tinymce')) return 'tinymce'
              if (id.includes('prosemirror')) return 'prosemirror'
              if (id.includes('slate')) return 'slate'
              return 'vue-vendor'
            }
            if (id.includes('/src/locales/') && id.includes('.json')) {
              // 顶级语言包: /src/locales/en.json -> locale-en
              const topMatch = id.match(/\/src\/locales\/([^/]+)\.json$/)
              if (topMatch) return `locale-${topMatch[1].replace(/-/g, '_')}`
              // full/{locale}/*.json -> locale-full-{locale}, 按语言分组避免跨语言合并成大 chunk
              const fullMatch = id.match(/\/src\/locales\/full\/([^/]+)\//)
              if (fullMatch) return `locale-full-${fullMatch[1].replace(/-/g, '_')}`
              // modules/{locale}/*.json -> locale-modules-{locale}
              const modMatch = id.match(/\/src\/locales\/modules\/([^/]+)\//)
              if (modMatch) return `locale-modules-${modMatch[1].replace(/-/g, '_')}`
              return 'locales'
            }
            if (id.includes('/src/views/')) {
              // let rollup auto-split views by shared deps (avoid single-file chunks)
              return undefined
            }
            if (id.includes('/src/components/')) {
              // let rollup auto-split components by shared deps (avoid cross-subdir cycles)
              return undefined
            }
            return undefined
          },
        },
      },
    },
    // CSS??
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/variables.scss" as *;`,
          silenceDeprecations: ['legacy-js-api', 'import'],
          importer: undefined,
        },
        less: {
          javascriptEnabled: true,
          math: 'always',
        },
      },
      postcss: {
        plugins: [],
      },
      devSourcemap: false,
      modules: {
        localsConvention: 'camelCase',
      },
    },
    // ???? - ?? flag-icons ??SVG ????????
    // ???CSS/SCSS ????Vite ?????????????
    assetsInclude: ['**/*.svg'],
    // ??????
    envPrefix: 'VITE_',
    // ?????? - ???????????????
    define: {
      'import.meta.env.VITE_BUILD_PLATFORM': JSON.stringify(currentPlatform),
    },
    // ?????? - ????????????????
    optimizeDeps: {
      entries: ['src/main.ts'],
      include: [
        'vue',
        'vue-router',
        'pinia',
        'axios',
        'element-plus',
        '@vueuse/core',
        'dayjs',
        'crypto-js',
        'js-cookie',
        'marked',
        'dompurify',
        'socket.io-client',
        'clsx',
        'class-variance-authority',
      ],
      exclude: [
        '@langchain/openai',
        '@vitejs/plugin-vue',
        'vite',
        'vitest',
        'playwright',
        'eslint',
        'prettier',
        'typescript',
        'vue-tsc',
        'lucide-vue-next',
      ],
      force: false,
    },
    // ESBuild?? - ??????
    esbuild: {
      logLevel: 'error',
      treeShaking: true,
      jsx: 'automatic',
      jsxImportSource: 'vue',
      target: 'es2022',
      legalComments: 'none',
      pure: isProduction ? ['console.log', 'console.debug', 'console.info'] : [],
      drop: isProduction ? ['console', 'debugger'] : [],
      keepNames: false,
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
      // ???????????????
      // minify: false, // ??????????
      // ?? source map???????
      sourcemap: false,
      // ??????
      supported: {
        'top-level-await': true,
      },
    },
  }
})






