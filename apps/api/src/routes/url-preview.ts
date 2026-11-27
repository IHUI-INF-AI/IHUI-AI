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
 * 安全:可选 JWT(有则按 userId 限流,无则按 IP 限流)+ SSRF 防护(数值化 IP 判定 + DNS 解析级复检,
 * 重定向落点逐跳复检,口径对齐 embed-proxy)+ 3s 总时限 + 字节上限。
 *
 * 已知局限(与 embed-proxy 同):非 UTF-8(GBK 等)页面标题可能乱码 —— 只影响
 * 展示质量,不影响三态判定。
 */

import * as dns from 'node:dns'

import type { FastifyPluginAsync } from 'fastify'
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
/** 站点图标抓取上限(200KB):20px 展示位用不到更大,但 180×180 的 apple-touch-icon 常超 64KB。 */
const ICON_MAX_BYTES = 200 * 1024
/** SVG 单独上限:矢量图标通常只有几 KB,给 96KB 已足够,也避免把大文档内联进响应。 */
const ICON_SVG_MAX_BYTES = 96 * 1024
/** 图标总预算:页面已花掉一部分 3s 预算,图标最多再给 1.8s,总耗时仍落在前端 5s 传输超时内。 */
const ICON_TIMEOUT_MS = 1800
/** 单个候选的尝试预算:首选图标慢时也要留出 favicon.ico 的兜底时间。 */
const ICON_ATTEMPT_TIMEOUT_MS = 650
/** 候选尝试上限:声明图标 + 标准路径兜底,最多 4 次,避免无图标站点被拖满预算。 */
const MAX_ICON_ATTEMPTS = 4

/** 三态封闭的探测结果(unavailable 与 undetermined 严禁合并)。 */
export type UrlPreviewProbeResult =
  | { status: 'ok'; url: string; title?: string; description?: string; icon?: string }
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

import { isPrivateIPv4Literal as isPrivateIPv4 } from '../utils/ssrf-guard.js'

import { isPrivateIPv6Literal as isPrivateIPv6 } from '../utils/ssrf-guard.js'

import { fetch as undiciFetch } from 'undici'
import { ssrfGuardedDispatcher } from '../utils/ssrf-guard.js'

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

/**
 * 主机字形校验(fail-closed)。
 *
 * 2026-11-26 实报:前端把"链接后面紧贴的中文正文"吞进 host(`https://example.com，绑定…`),
 * `new URL()` 不报错而是把它当伪 IDN 主机(`example.xn--com,,,-…`)解析"成功",于是一路走到
 * DNS 失败,三态只剩"未判定"。URL 规范里的 hostname 在解析后应是小写 ASCII 标签、punycode
 * 或 IP 字面量;含逗号/空格等越界字符的一律判非法,绝不拿去解析(DNS)或建连。
 */
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/i
const IPV6_LITERAL_RE = /^[0-9a-f:.]+$/i

function isPlausibleHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '')
  if (h.length === 0 || h.length > 253) return false
  if (h.includes(':')) return IPV6_LITERAL_RE.test(h)
  return h.split('.').every((label) => HOST_LABEL_RE.test(label))
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

function extractMetaContent(
  html: string,
  key: 'description' | 'og:description',
): string | undefined {
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
// 站点图标(2026-11-27 立):卡片要有真实站点图标,而不是字母块兜底。
// 先从已读到的 HTML 头部挑 href,再把图标字节抓成 data URL 内联返回 ——
// 浏览器只渲染 data:(CSP 已放行),不直连第三方,也不依赖媒体代理。
// ─────────────────────────────────────────────────────────────

/** 取一个 `<link>` 标签上的属性值,兼容双引号/单引号/裸值。 */
function linkAttr(tag: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  return m?.[1] ?? m?.[2] ?? m?.[3]
}

/**
 * 把候选 href 解析成绝对 http(s) 地址;data:/javascript:/相对非法一律返回 undefined。
 * 相对地址以 `<base href>`(若有)或页面落点为基准。
 */
function resolveIconUrl(raw: string, baseUrl: string): string | undefined {
  let abs: URL
  try {
    abs = new URL(decodeHtmlEntities(raw.trim()), baseUrl)
  } catch {
    return undefined
  }
  if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return undefined
  if (abs.toString().length > 2048) return undefined
  return abs.toString()
}

/**
 * 收集页面里**显式声明**的站点图标候选,按得分降序。
 *
 * 覆盖 `<link rel=icon / shortcut icon / apple-touch-icon / fluid-icon>`、带 `sizes` 的
 * 多尺寸声明,以及 Windows 磁贴的 `msapplication-TileImage*`。`mask-icon` 是 Safari
 * 单色蒙版,不作为通用图标;`data:` 一律跳过(统一由后端抓字节后内联)。
 * 同一个 URL 只保留最高分,避免重复请求。
 */
export function extractIconCandidates(html: string, pageUrl: string): string[] {
  let base = pageUrl
  const baseTag = /<base\b[^>]*>/i.exec(html)?.[0]
  if (baseTag) {
    const href = linkAttr(baseTag, 'href')
    if (href) {
      try {
        const b = new URL(decodeHtmlEntities(href.trim()), pageUrl)
        if (b.protocol === 'http:' || b.protocol === 'https:') base = b.toString()
      } catch {
        // <base> 写坏了就按页面落点解析,不因一处脏数据丢掉所有候选
      }
    }
  }

  const scored = new Map<string, number>()
  const add = (raw: string | undefined, score: number): void => {
    if (!raw) return
    const abs = resolveIconUrl(raw, base)
    if (!abs) return
    scored.set(abs, Math.max(scored.get(abs) ?? Number.NEGATIVE_INFINITY, score))
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (linkAttr(tag, 'rel') ?? '').toLowerCase()
    if (!rel.includes('icon') || rel.includes('mask-icon')) continue
    const type = (linkAttr(tag, 'type') ?? '').toLowerCase()
    const sizes = (linkAttr(tag, 'sizes') ?? '').toLowerCase()
    let score = 1
    if (rel.includes('apple-touch-icon')) score += 3
    if (rel.split(/\s+/).includes('icon')) score += 1
    if (type.includes('svg')) score += 2
    if (sizes === 'any') {
      score += 2
    } else {
      const dim = /(\d+)x(\d+)/.exec(sizes)
      if (dim) score += Math.min(3, Math.floor(Number(dim[1]) / 64))
    }
    add(linkAttr(tag, 'href'), score)
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (linkAttr(tag, 'name') ?? linkAttr(tag, 'property') ?? '').toLowerCase()
    if (
      key === 'msapplication-tileimage' ||
      key === 'msapplication-wide310x150logo' ||
      key.startsWith('msapplication-square')
    ) {
      add(linkAttr(tag, 'content'), 3)
    }
  }

  return [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url)
}

/**
 * 站点没有显式声明图标时的标准路径兜底。`/favicon.ico` 是事实标准,绝大多数站点都有;
 * 少数站点只放 `/favicon.png` 或 `/apple-touch-icon.png`,一并尝试。
 */
function fallbackIconUrls(pageUrl: string): string[] {
  try {
    const origin = new URL(pageUrl).origin
    return ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png'].map((p) =>
      new URL(p, origin).toString(),
    )
  } catch {
    return []
  }
}

/** 声明候选在前、标准路径在后;去重后交给抓取器按顺序尝试。 */
function iconCandidates(html: string, pageUrl: string): string[] {
  const merged = extractIconCandidates(html, pageUrl).slice(0, 4)
  for (const url of fallbackIconUrls(pageUrl)) {
    if (!merged.includes(url)) merged.push(url)
  }
  return merged
}

/** 读前几个字节的 ASCII(用于 magic 判定)。 */
function asciiAt(bytes: Uint8Array, offset: number, len: number): string {
  if (bytes.byteLength < offset + len) return ''
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i] ?? 0)
  return s
}

/**
 * 按文件头嗅探真实类型 —— 站点返回 `200 + image/png` 却塞一张 HTML 的情况很常见
 * (软 404、防盗链、WAF 拦截页)。只信字节,不信 Content-Type。
 * SVG 额外做危险结构检查:图标以 `<img>`/data URL 渲染,脚本本不会执行,但仍不收
 * 带 script/foreignObject/事件处理器/外链引用的文档,避免把攻击面带进前端。
 */
function sniffIconMime(bytes: Uint8Array): string | undefined {
  const n = bytes.byteLength
  if (n >= 8 && bytes[0] === 0x89 && asciiAt(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d) {
    return 'image/png'
  }
  if (n >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (n >= 6 && (asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a')) {
    return 'image/gif'
  }
  if (n >= 12 && asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }
  if (n >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) {
    return 'image/x-icon'
  }
  if (n >= 2 && asciiAt(bytes, 0, 2) === 'BM') return 'image/bmp'
  if (n >= 12 && asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }

  // SVG 是文本:解码后确认根元素,再做危险结构检查。
  const head = new TextDecoder('utf-8')
    .decode(bytes.subarray(0, Math.min(n, 8192)))
    .replace(/^\uFEFF/, '')
    .trimStart()
  if (!/<svg[\s>]/i.test(head)) return undefined
  let full = head
  if (n > 8192) {
    try {
      full = new TextDecoder('utf-8').decode(bytes)
    } catch {
      return undefined
    }
  }
  if (
    /<script|<foreignObject|\son[a-z]+\s*=|javascript:|xlink:href\s*=\s*["']\s*https?:/i.test(full)
  ) {
    return undefined
  }
  return 'image/svg+xml'
}

/** 有上限的字节读取:超过上限直接取消连接并返回 null(不截断成坏图)。 */
async function readCappedBytes(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > maxBytes) {
          try {
            await reader.cancel()
          } catch {
            // 连接回收失败不影响判定
          }
          return null
        }
        chunks.push(value)
      }
    }
  } catch {
    return null
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * 抓单个候选图标并转成 `data:image/…;base64,…`。
 *
 * 与页面探测共用一道 SSRF 尺(字面量判定 + DNS 解析级复检 + 重定向逐跳复检);
 * 只信字节嗅探出的 image/*;任何一步失败返回 undefined,由调用方换下一个候选。
 */
async function fetchIconAttempt(
  iconUrl: string,
  pageUrl: string,
  doFetch: typeof fetch,
  resolveForbidden: (hostname: string) => Promise<boolean>,
  timeoutMs: number,
): Promise<string | undefined> {
  let target: URL
  try {
    target = new URL(iconUrl)
  } catch {
    return undefined
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return undefined
  if (!isPlausibleHostname(target.hostname)) return undefined

  const deadline = Date.now() + timeoutMs
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isForbiddenHost(target.hostname) || (await resolveForbidden(target.hostname))) {
      return undefined
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) return undefined

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    ;(timer as { unref?: () => void }).unref?.()

    let res: Response
    try {
      res = await doFetch(target.toString(), {
        method: 'GET',
        headers: {
          'user-agent': PROBE_UA,
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          // 部分 CDN/防盗链按 Referer 放行,图标请求带上页面地址
          referer: pageUrl,
        },
        credentials: 'omit',
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timer)
      return undefined
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return undefined
      try {
        target = new URL(location, target)
      } catch {
        return undefined
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return undefined
      continue
    }
    if (res.status < 200 || res.status >= 300) return undefined

    const headerMime =
      (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
    // 明确是 HTML/JSON/文本描述页的直接放弃,连字节都不读;其余交给 magic 判定。
    const readable =
      headerMime === '' ||
      headerMime === 'application/octet-stream' ||
      headerMime === 'text/plain' ||
      headerMime === 'text/xml' ||
      headerMime === 'application/xml' ||
      headerMime.startsWith('image/')
    if (!readable) return undefined

    const bytes = await readCappedBytes(res, ICON_MAX_BYTES)
    if (!bytes || bytes.byteLength === 0) return undefined
    const mime = sniffIconMime(bytes)
    if (!mime) return undefined
    if (mime === 'image/svg+xml' && bytes.byteLength > ICON_SVG_MAX_BYTES) return undefined
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  }
  return undefined
}

/**
 * 依次尝试候选图标,拿到第一个有效位图/SVG 就返回。
 *
 * 顺序:页面显式声明(按尺寸/类型打分)→ `/favicon.ico` → `/favicon.png` →
 * `/apple-touch-icon.png`。总预算 1.8s、单候选 650ms、最多 4 次 —— 图标是装饰,
 * 绝不因为图标拖垮预览卡本身的 5s 前端超时。
 */
async function fetchIconDataUrl(
  candidates: string[],
  pageUrl: string,
  doFetch: typeof fetch,
  resolveForbidden: (hostname: string) => Promise<boolean>,
): Promise<string | undefined> {
  const deadline = Date.now() + ICON_TIMEOUT_MS
  let attempts = 0
  for (const candidate of candidates) {
    if (attempts >= MAX_ICON_ATTEMPTS) break
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    attempts++
    const data = await fetchIconAttempt(
      candidate,
      pageUrl,
      doFetch,
      resolveForbidden,
      Math.min(ICON_ATTEMPT_TIMEOUT_MS, remaining),
    )
    if (data) return data
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
  // 2026-10-31 安全强化第 15 批(M3):生产默认出站连接 guarded dispatcher(判定与
  // 建连共用同一次解析,收口 TTL=0 rebinding 窗口);fetchImpl 注入路径(测试替身)
  // 保持原样不受守卫影响。
  const doFetch: typeof fetch =
    options.fetchImpl ??
    (((url: string, init?: RequestInit) =>
      undiciFetch(url, {
        ...init,
        dispatcher: ssrfGuardedDispatcher(),
      }) as unknown as Promise<Response>) as typeof fetch)
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
  // 主机字形不合法(典型:中文正文被吞进 host 的伪 IDN)⇒ 未判定,不进 DNS、不发请求。
  if (!isPlausibleHostname(first.hostname)) {
    return undetermined('invalid_host')
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
      // 图标候选:声明优先,标准路径兜底 —— 覆盖"页面没写 <link icon> 但根目录有
      // favicon.ico"的大量站点;每个候选都要过同一道 SSRF 尺。
      const candidates = iconCandidates(html, current.toString())
      const icon =
        candidates.length > 0
          ? await fetchIconDataUrl(candidates, current.toString(), doFetch, resolveForbidden)
          : undefined
      return {
        status: 'ok',
        url: rawUrl,
        ...(extractTitle(html) ? { title: extractTitle(html) } : {}),
        ...(extractMetaContent(html, 'description')
          ? { description: extractMetaContent(html, 'description') }
          : {}),
        ...(icon ? { icon } : {}),
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
  /**
   * 鉴权改为「可选」(2026-11-27 实报根因)。
   *
   * 原实现无条件 `authenticate`,token 一过期就回 401,前端把 401 归入
   * undetermined('probe_request_failed'),卡片只剩"网络不可达" —— 用户看到的是
   * "我自己项目为什么不显示图标",实际连一次出站探测都没发生。预览是只读、
   * 不落盘、不碰用户数据的公共能力(`ok` 只回标题/摘要/图标),没有必须绑定身份的
   * 理由;登录态只用来做更精确的限流键,缺失时按 IP 限流。
   */
  server.get('/preview', async (request, reply) => {
    try {
      await authenticate(request)
    } catch {
      // 未登录/过期 token 一律放行:探测结果与身份无关,滥用由下面的限流兜住。
    }

    const parsed = previewQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rateKey = request.userId ?? `ip:${request.ip}`
    if (isRateLimited(rateKey)) {
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
