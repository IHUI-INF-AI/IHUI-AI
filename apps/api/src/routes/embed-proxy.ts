/**
 * 同源嵌入代理(2026-09-02 立,WorkPanel 真实内嵌方案)
 *
 * 背景:跨源站点 X-Frame-Options / CSP frame-ancestors 禁止 iframe 嵌入,
 * 前端原先直接降级 CDP 截图流(canvas 贴图,文字不可选中、帧率低)。
 * 本路由把目标页面经后端取回、剥离防嵌入头,以**同源响应**喂给 iframe,
 * 浏览器不再拦截 → 真实 HTML 渲染(可交互/可选中/矢量清晰)。
 *
 * 数据流:iframe(/api/embed-proxy/raw?url=X) → api 取回 X 剥头重写 → 同源 HTML
 *        → 页面内 a/form 经重写回到代理;子资源(img/css/js)经 <base> 直连目标站。
 *
 * 安全设计(免鉴权的原因:iframe 加载无法附带 Bearer token):
 * - SSRF 防护:仅 http/https,拦截 localhost/私网/链路本地/ULA/保留地址(含重定向落点复检)
 * - 限流:每 IP 60s 窗口 120 次
 * - 不转发上游 Set-Cookie;剥离压缩/传输头后由 Fastify 重新编码
 * - 前端 iframe sandbox 无 allow-same-origin(外部 JS 为 opaque origin,
 *   无法触碰本站 DOM/存储;postMessage 消息仅用于导航同步与失败降级)
 *
 * 已知局限(MVP):GBK 等非 UTF-8 页面可能乱码;强反爬(Cloudflare 盾)返回
 * 挑战页无法通过 → 前端 20s 超时/错误页 postMessage 自动降级 CDP 截图流。
 */

import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { error } from '../utils/response.js'

const PROXY_TIMEOUT_MS = 15000
/** HTML 全量改写需读入内存,设上限防大文件打爆内存 */
const MAX_HTML_BYTES = 8 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 剥离的响应头:防嵌入头 + 压缩/传输头(由 Fastify 重新编码)+ cookie + 安全策略头 */
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'set-cookie',
  'strict-transport-security',
  'clear-site-data',
  'refresh',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
])

/** SSRF:禁内网/保留地址(SS 2026-09-02;DNS 重绑定未做解析级校验,见局限) */
const FORBIDDEN_HOST_PATTERNS: RegExp[] = [
  /^localhost$/,
  /\.localhost$/,
  /\.local$/,
  /\.internal$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^\[::1\]$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
]

function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return FORBIDDEN_HOST_PATTERNS.some((p) => p.test(h))
}

/** 简单内存限流(每 IP 滑窗) */
const rateBuckets = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

/** 目标 URL → 代理 URL */
function proxyUrlFor(target: string): string {
  return `/api/embed-proxy/raw?url=${encodeURIComponent(target)}`
}

/**
 * iframe 桥接脚本(opaque origin 下 postMessage 的 e.origin='null',父页以 type 前缀白名单校验)
 *
 * 关键设计:页面注入了 <base href="目标站">(子资源直连目标站),因此 document.baseURI
 * 指向目标站而非代理地址。凡 href 已被服务端重写为 `/api/embed-proxy/raw?url=...`
 * (相对代理路径)的链接,**绝不能**再用 base 解析(会解析到 目标站/api/... 错误地址),
 * 必须直接从 href 内 decode 出原始目标 URL。
 */
const BRIDGE_SCRIPT = [
  '(function(){try{',
  "var post=function(t,u){try{parent.postMessage({type:t,url:u},'*')}catch(e){}};",
  "var P='/api/embed-proxy/raw?url=';",
  'var isP=function(h){return typeof h===\'string\'&&h.indexOf(P)===0};',
  'var dec=function(h){var i=h.indexOf(\'url=\');return i<0?h:decodeURIComponent(h.slice(i+4))};',
  'var cur=function(){var h=location.href;return isP(h)?dec(h):h};',
  'var push=history.pushState,rep=history.replaceState;',
  'history.pushState=function(){var a=[].slice.call(arguments),u=a[2];',
  "var abs=u!==undefined&&u!==null?new URL(String(u),document.baseURI).href:cur();",
  'try{push.apply(this,a)}catch(e){}',
  "post('ihui-embed-nav',abs);",
  'if(/^https?:/i.test(abs)){try{location.href=P+encodeURIComponent(abs)}catch(e){}}};',
  'history.replaceState=function(){var a=[].slice.call(arguments),u=a[2];',
  "var abs=u!==undefined&&u!==null?new URL(String(u),document.baseURI).href:cur();",
  'try{rep.apply(this,a)}catch(e){}',
  "post('ihui-embed-nav',abs)};",
  "window.addEventListener('popstate',function(){post('ihui-embed-nav',cur())});",
  "document.addEventListener('click',function(e){",
  'var t=e.target;var a=t&&t.closest?t.closest("a"):null;if(!a)return;',
  "var href=a.getAttribute('href');if(!href)return;",
  "if(href.charAt(0)==='#')return;",
  'if(/^(javascript|mailto|tel|data):/i.test(href))return;',
  'if(isP(href)){e.preventDefault();post("ihui-embed-nav",dec(href));location.href=href;return}',
  'var abs;try{abs=new URL(href,document.baseURI).href}catch(err){return}',
  'if(!/^https?:/i.test(abs))return;',
  'e.preventDefault();post("ihui-embed-nav",abs);',
  'location.href=P+encodeURIComponent(abs)',
  '},true);',
  '}catch(e){}})();',
].join('')

/** HTML 改写:删 CSP meta、注入 <base>、a/form 重写回代理、注入桥接脚本 */
function rewriteHtml(html: string, baseUrl: string): string {
  // 1. 删除 CSP meta(meta 层 CSP 同样会拦子资源/内联脚本)
  let out = html.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '')

  // 2. 移除已有 <base>,注入指向目标站的 base(子资源直连目标站,不受 XFO 限制)
  out = out.replace(/<base\b[^>]*>/gi, '')
  const baseHref = baseUrl.replace(/"/g, '&quot;')
  const baseTag = `<base href="${baseHref}">`
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => m + baseTag)
  } else {
    out = baseTag + out
  }

  // 3. <a href> 绝对化后改写为代理 URL,去掉 target(避免弹出/顶层导航)
  out = out.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
    if (!href) return _m
    const raw = href[1] ?? href[2] ?? href[3] ?? ''
    if (!raw || /^(javascript:|mailto:|tel:|data:|#)/i.test(raw)) return _m
    let abs: string
    try {
      abs = new URL(raw, baseUrl).href
    } catch {
      return _m
    }
    if (!/^https?:/i.test(abs)) return _m
    const newAttrs = attrs
      .replace(/\shref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ` href="${proxyUrlFor(abs)}"`)
      .replace(/\starget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    return `<a${newAttrs}>`
  })

  // 4. <form action> 改写回代理,去掉 method(强制 GET,代理仅支持 GET)
  out = out.replace(/<form\b([^>]*)>/gi, (_m, attrs: string) => {
    const action = /action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
    let abs = baseUrl
    if (action) {
      const raw = action[1] ?? action[2] ?? action[3] ?? ''
      try {
        abs = new URL(raw || baseUrl, baseUrl).href
      } catch {
        abs = baseUrl
      }
    }
    const newAttrs = attrs
      .replace(/\saction\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ` action="${proxyUrlFor(abs)}"`)
      .replace(/\smethod\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    return `<form${newAttrs}>`
  })

  // 5. 注入桥接脚本(覆盖 SPA pushState/JS 生成锚点)
  const bridge = `<script>${BRIDGE_SCRIPT}</script>`
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${bridge}</body>`)
  } else {
    out += bridge
  }
  return out
}

/** 代理失败页:向父页面 postMessage 触发 CDP 降级 */
function errorPage(message: string): string {
  const safe = message.replace(/[<>&"]/g, '').slice(0, 200)
  return [
    '<!doctype html><html><head><meta charset="utf-8"></head>',
    '<body style="font:13px sans-serif;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">',
    `<p>${safe}</p>`,
    `<script>try{parent.postMessage({type:'ihui-embed-proxy-error',message:${JSON.stringify(safe)}},'*')}catch(e){}</script>`,
    '</body></html>',
  ].join('')
}

const rawQuerySchema = z.object({ url: z.string().min(1) })

export const embedProxyRoutes: FastifyPluginAsync = async (server) => {
  server.get('/raw', async (request, reply) => {
    // iframe 加载不带 token,本路由免鉴权,以 SSRF 防护 + 限流兜底
    if (isRateLimited(request.ip)) {
      return reply.status(429).send(error(429, '嵌入代理请求过于频繁,请稍后再试'))
    }

    const parsed = rawQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '缺少 url 参数'))
    }

    let target: URL
    try {
      target = new URL(parsed.data.url)
    } catch {
      return reply.status(400).send(error(400, 'url 参数格式非法'))
    }
    if (!/^https?:$/.test(target.protocol) || isForbiddenHost(target.hostname)) {
      return reply.status(403).send(error(403, '该地址不允许通过嵌入代理访问'))
    }

    let upstream: Response
    try {
      upstream = await fetch(target.href, {
        redirect: 'follow',
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        headers: {
          'user-agent': DEFAULT_UA,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reply.type('text/html; charset=utf-8')
      return reply.send(errorPage(`嵌入代理取回页面失败: ${msg}`))
    }

    // 重定向落点复检(防止 302 跳内网)
    let finalUrl = target.href
    try {
      const landed = new URL(upstream.url)
      if (isForbiddenHost(landed.hostname)) {
        reply.type('text/html; charset=utf-8')
        return reply.send(errorPage('目标重定向到了内网地址,已被拦截'))
      }
      finalUrl = upstream.url
    } catch {
      // 保留 target.href
    }

    reply.header('cache-control', 'no-store')
    reply.header('x-content-type-options', 'nosniff')
    for (const [name, value] of upstream.headers.entries()) {
      if (STRIP_HEADERS.has(name)) continue
      try {
        reply.header(name, value)
      } catch {
        // 个别非法头名跳过
      }
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      // 非文档资源(css/js/img/字体)直接流式透传
      if (!upstream.body) {
        return reply.status(502).send(error(502, '上游无响应体'))
      }
      return reply.send(Readable.fromWeb(upstream.body as NodeWebReadableStream))
    }

    // HTML:全量读入 → 剥 CSP 头已在上方 → 重写后同源输出
    const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_HTML_BYTES) {
      reply.type('text/html; charset=utf-8')
      return reply.send(errorPage('页面过大,嵌入代理不支持(请用外部浏览器打开)'))
    }
    let html: string
    try {
      const buf = await upstream.arrayBuffer()
      if (buf.byteLength > MAX_HTML_BYTES) {
        reply.type('text/html; charset=utf-8')
        return reply.send(errorPage('页面过大,嵌入代理不支持(请用外部浏览器打开)'))
      }
      html = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reply.type('text/html; charset=utf-8')
      return reply.send(errorPage(`读取页面失败: ${msg}`))
    }

    reply.type('text/html; charset=utf-8')
    return reply.send(rewriteHtml(html, finalUrl))
  })
}
