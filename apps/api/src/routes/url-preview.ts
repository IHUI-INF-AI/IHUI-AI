// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * D166 链接预览探测路由(2026-09-30 立,承 V4 §9.4③)。
 *
 * 背景:聊天输入框粘贴链接没有预览卡,发出去之后才知道读不到。竞品已有
 * previewLoading / previewUnavailable 两态;本票补齐发送前的"来源可达性预检",
 * 回答"这条 URL 能不能读、读到什么标题"。
 *
 * 端点(注册前缀 /api/url-preview):
 * - GET /preview?url=…  轻量探测一条 http(s) 链接,返回三态封闭结果。
 *
 * 边界纪律(票面铁律):
 * - 预检绝不变成"抓取两次":单次 GET,流式读前 128KB 即止(标题/描述都在文档头部),
 *   正文不落盘、不缓存、不进库 —— 探测完即丢;
 * - 结果是提示不是闸门:调用方(聊天输入卡)不得以本端点结果阻断发送;
 * - 三态封闭:ok(读到标题/摘要)| unavailable(判定读不到:404/410/5xx/公网域名不存在)
 *   | undetermined(未判定:需登录 401/403、超时、内网/SSRF 拦截、网络错误、重定向超限)。
 *   "把没判写成判过"是同一禁令 —— undetermined 必须与 unavailable 区分,内网/需登录
 *   站点探测失败显示"未判定"而不是"读不到"。
 *
 * 方法选型:用带字节上限的 GET 而不是 HEAD —— 大量站点对 HEAD 返回 404/405,
 * 会把"能读的页面"误判成"读不到"(反向造假);GET 首段读满 128KB 即 abort 断流。
 *
 * 安全:JWT 鉴权 + 每 userId 内存限流 + SSRF 防护(数值化 IP 判定 + DNS 解析级复检,
 * 重定向落点逐跳复检,口径对齐 embed-proxy)+ 3s 总时限 + 字节上限。
 *
 * 已知局限(与 embed-proxy 同):非 UTF-8(GBK 等)页面标题可能乱码 —— 只影响
 * 展示质量,不影响三态判定。
 */

import * as dns from 'node:dns'

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

/** 探测总时限:覆盖重定向各跳 + 首段正文(票面:显式 3s)。 */
export const URL_PREVIEW_TIMEOUT_MS = 3000
/** 正文读取上限:标题/描述都在文档头部,读前 128KB 足够,超限即中止。 */
export const URL_PREVIEW_MAX_BYTES = 128 * 1024
/** 重定向跟随上限(逐跳 SSRF 复检)。 */
const MAX_REDIRECTS = 3
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 三态封闭的探测结果(unavailable 与 undetermined 严禁合并)。 */
export type UrlPreviewProbeResult =
  | { status: 'ok'; url: string; title?: string; description?: string }
  | { status: 'unavailable'; url: string; reason: string }
  | { status: 'undetermined'; url: string; reason: string }

export interface UrlPreviewProbeOptions {
  /** 测试注入点:缺省 globalThis.fetch。 */
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /** 测试注入点:DNS 解析级禁判(缺省真实 lookup)。 */
  resolveForbidden?: (hostname: string) => Promise<boolean>
}

// ─────────────────────────────────────────────────────────────
// SSRF 防护(口径对齐 embed-proxy:数值化 IP 判定 + 解析级复检,fail-closed)
// ─────────────────────────────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  // 只接受两种可无歧义还原的形式,其余一律 fail-closed(混合进制绕过直接拒绝)。
  let parts: number[]
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    parts = ip.split('.').map(Number)
  } else if (/^(0[xX][0-9a-fA-F]+|\d+)$/.test(ip)) {
    const n = Number(ip)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return true
    parts = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  } else {
    return true
  }
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a = -1, b = -1] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // 组播/保留
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isPrivateIPv4(mapped[1])
  if (v.startsWith('::ffff:')) return true // mapped 但非点分 → 一律禁止
  if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true
  if (v.startsWith('ff')) return true // 组播
  if (v.startsWith('64:ff9b:') || v.startsWith('100::')) return true // NAT64 / 保留
  return false
}

function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true
  }
  if (h.includes(':')) return isPrivateIPv6(h)
  if (/^[\da-fx.]+$/i.test(h)) return isPrivateIPv4(h)
  return false
}

/** DNS 解析级校验:hostname 全部解析地址逐一判禁(防 DNS 重绑定)。 */
async function defaultResolveForbidden(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.promises.lookup(hostname, { all: true })
    if (addrs.length === 0) return true
    for (const { address, family } of addrs) {
      const blocked = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address)
      if (blocked) return true
    }
    return false
  } catch {
    return true // 解析失败一律禁止
  }
}

// ─────────────────────────────────────────────────────────────
// 标题/描述提取(轻正则,只面向预览卡展示,不做全文解析)
// ─────────────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)
  const raw = m?.[1] ? collapseSpace(decodeHtmlEntities(m[1])) : ''
  return raw.length > 0 ? raw : undefined
}

function extractMetaContent(html: string, key: 'description' | 'og:description'): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']{0,300})["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']{0,300})["'][^>]*(?:name|property)=["']${key}["']`,
      'i',
    ),
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    const raw = m?.[1] ? collapseSpace(decodeHtmlEntities(m[1])) : ''
    if (raw.length > 0) return raw
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────
// 探测主体:单次出口,重定向手动跟随(逐跳 SSRF 复检),共享 3s 时限
// ─────────────────────────────────────────────────────────────

export async function probeUrl(
  rawUrl: string,
  options: UrlPreviewProbeOptions = {},
): Promise<UrlPreviewProbeResult> {
  const doFetch = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? URL_PREVIEW_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? URL_PREVIEW_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS
  const resolveForbidden = options.resolveForbidden ?? defaultResolveForbidden

  const undetermined = (reason: string): UrlPreviewProbeResult => ({
    status: 'undetermined',
    url: rawUrl,
    reason,
  })

  let first: URL
  try {
    first = new URL(rawUrl)
  } catch {
    return undetermined('invalid_url')
  }
  if (first.protocol !== 'http:' && first.protocol !== 'https:') {
    return undetermined('unsupported_scheme')
  }

  const deadline = Date.now() + timeoutMs
  let current = first
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // SSRF:字面量/数值判定 + DNS 解析级复检,每一跳都做(含重定向落点)。
    // 内网/保留地址 ⇒ 未判定(不是"读不到"—— 我们根本没去读,不能把没判写成判过)。
    if (isForbiddenHost(current.hostname) || (await resolveForbidden(current.hostname))) {
      return undetermined('ssrf_blocked')
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) return undetermined('timeout')

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, remaining)
    ;(timer as { unref?: () => void }).unref?.()

    let res: Response
    try {
      res = await doFetch(current.toString(), {
        method: 'GET',
        headers: {
          'user-agent': PROBE_UA,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        },
        credentials: 'omit', // 探测不带任何凭据出站
        redirect: 'manual', // 重定向手动跟随,落点逐跳复检
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timer)
      return undetermined(timedOut ? 'timeout' : 'network_error')
    }
    clearTimeout(timer)

    // 重定向:解析落点(相对/绝对均可),校验 scheme 后进下一跳。
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return undetermined('redirect_no_location')
      let next: URL
      try {
        next = new URL(location, current)
      } catch {
        return undetermined('redirect_invalid_location')
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        return undetermined('redirect_unsupported_scheme')
      }
      current = next
      continue
    }

    // 状态 → 三态映射:
    //   2xx ⇒ ok;404/410/5xx ⇒ unavailable(判定读不到);
    //   其余(401/403/405/429 等) ⇒ undetermined(未判定:多半是访问侧原因,不冤枉链接)。
    if (res.status >= 200 && res.status < 300) {
      const contentType = res.headers.get('content-type') ?? ''
      const isHtml = /text\/html|application\/xhtml/i.test(contentType)
      if (!isHtml) {
        // 非 HTML(图片/PDF/JSON 等)是可读链接,只是没有标题可提 —— ok + 无标题,
        // 前端回落展示主机名,绝不误报"读不到"。
        return { status: 'ok', url: rawUrl }
      }
      const html = await readHead(res, maxBytes)
      if (html === null) return undetermined('read_error')
      return {
        status: 'ok',
        url: rawUrl,
        ...(extractTitle(html) ? { title: extractTitle(html) } : {}),
        ...(extractMetaContent(html, 'description')
          ? { description: extractMetaContent(html, 'description') }
          : {}),
      }
    }
    if (res.status === 404 || res.status === 410 || res.status >= 500) {
      return { status: 'unavailable', url: rawUrl, reason: `http_${res.status}` }
    }
    return undetermined(`http_${res.status}`)
  }
  return undetermined('redirect_limit')
}

/** 流式读取首段 HTML,读满 maxBytes 即 abort 断流(绝不整包读入)。失败返回 null。 */
async function readHead(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let total = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        text += decoder.decode(value, { stream: true })
        if (total >= maxBytes) {
          // 读满即止:abort 撕掉底层连接,残余正文一字节都不多拿。
          try {
            await reader.cancel()
          } catch {
            // 连接回收失败不影响已读内容
          }
          break
        }
      }
    }
  } catch {
    return null
  }
  return text
}

// ─────────────────────────────────────────────────────────────
// 路由:JWT 鉴权 + 每 userId 限流 + Zod 校验(形态对齐 context-mentions.ts)
// ─────────────────────────────────────────────────────────────

const previewQuerySchema = z.object({
  url: z.string().min(1).max(2048),
})

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const rateMap = new Map<string, number[]>()

/** 简单内存滑窗限流(探测是出站行为,必须防滥用)。 */
function isRateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (rateMap.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_MAX) {
    rateMap.set(key, hits)
    return true
  }
  hits.push(now)
  rateMap.set(key, hits)
  return false
}

export const urlPreviewRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // GET /preview — 轻量探测一条链接(三态封闭;结果仅供提示,不得阻断发送)
  server.get('/preview', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = previewQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (isRateLimited(request.userId)) {
      return reply.status(429).send(error(429, '链接预览探测过于频繁,请稍后再试'))
    }
    try {
      const result = await probeUrl(parsed.data.url)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '链接预览探测失败'))
    }
  })
}

export default urlPreviewRoutes

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
