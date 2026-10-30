// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体直链同源代理化(2026-10-30 立)。
 *
 * 把外部 http(s) 媒体直链改写成同源代理路径,浏览器经 web rewrites
 * (`/api/media/*` → ai-service 8803)同源访问,自动带 httpOnly auth cookie,
 * 源站 CDN 不再被浏览器直连 ⇒ 可把 CSP 的 img-src / media-src 收窄到 'self',
 * 外泄信道面清零(与视频流式代理 /api/media/stream 同思路)。
 *
 * 但若 URL 命中 next.config `images.remotePatterns` 已放行的白名单域名,则**原样直连**
 * (不进代理)——这些域名 CSP 的 img-src 已直接放行,直连零额外跳板、不依赖 ai-service
 * 存活,且 keep 头像/营销/OAuth 图标等高频读路径的性能。只有**白名单之外**的任意公网
 * 直链才走代理(SSRF 闸门兜底)。
 *
 * 非 http(s)(data:/blob:/同源相对路径如 /uploads/ /remote-images/)原样返回,不进代理。
 */

// 与 next.config.ts `images.remotePatterns`(2026-10-30 收口白名单)严格对齐。
// 改 remotePatterns 时此处必须同步,否则会出现「代理改写 ↔ CSP 直连」错配。
const IMG_WHITELIST_HOSTS = [
  'aizhs.top',
  'api.dicebear.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsx.com',
  'api.qrserver.com',
  'test-for-dp.oss-cn-guangzhou.aliyuncs.com',
] as const

function isWhitelistedHost(host: string): boolean {
  const h = host.toLowerCase()
  if (IMG_WHITELIST_HOSTS.includes(h as (typeof IMG_WHITELIST_HOSTS)[number])) return true
  // 仅 aizhs.top 支持 *. 子域通配(remotePatterns 中唯一 wildcard)。
  if (h.endsWith('.aizhs.top')) return true
  return false
}

/** 控制字符可以把 `java\nscript:` 伪装成看似无害的值 —— 与 doc-link-sanitizer 同一判据:先拒不修。 */
function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f))) return true
  }
  return false
}

/**
 * 入参归一:去空白 → 拒控制字符 → 协议相对补成 https。
 *
 * 协议相对(`//cdn.example.com/a.png`)必须补齐:它按页面协议解析后是**跨源**直链,
 * 既不会被下面的 http(s) 分支接住(前缀不是 `http://`),也不是站内可渲染资源 ——
 * 结果是原样落进 `src`/`href`,被 CSP 的 `img-src 'self'` 当场拦掉(图裂),且后端
 * SSRF 闸门也判不了它(无 scheme)。补齐后与普通外链同一条路走。
 */
function normalizeInput(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed || hasControlChars(trimmed)) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
}

/**
 * 非 http(s) 值的去留裁定:相对路径与 blob: 原样,data: 只放行本助手对应的媒体子类型,
 * 其余显式 scheme(`javascript:` / `vbscript:` / `file:` …)一律丢弃。
 *
 * 为什么下载路径也要这一刀:下载助手既进 `fetch()`,也被调用方拼进 `<a href>`;
 * `javascript:` 值在 `fetch` 里只是抛错,在 `href` 里却是可点的脚本 URI。丢弃比放行安全,
 * 且丢弃后渲染成空值(`src=""` / 不可点),不会把坏值伪装成能用的链接。
 */
function passThroughNonHttp(value: string, dataPattern: RegExp): string {
  const matched = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (!matched) return value // 相对路径 / 裸文件名:同源,照原样
  const scheme = (matched[1] ?? '').toLowerCase()
  if (scheme === 'blob') return value
  if (scheme === 'data') return dataPattern.test(value) ? value : ''
  return ''
}

const DATA_IMAGE = /^data:image\//i
const DATA_MEDIA = /^data:(?:video|audio)\//i

export function toMediaImageUrl(url?: string | null): string {
  const value = normalizeInput(url)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value)
      // 白名单域名直连(CSP img-src 已放行);其余任意公网直链走同源代理。
      if (isWhitelistedHost(u.hostname)) return value
    } catch {
      // 解析失败(异常输入)一律进代理,由后端 SSRF 闸门兜底拦截。
    }
    return `/api/media/image?url=${encodeURIComponent(value)}`
  }
  return passThroughNonHttp(value, DATA_IMAGE)
}

/** 下载代理路径(后端 /api/media/download 带 Content-Disposition,同源无 CORS 问题)。 */
export function toMediaDownloadUrl(url?: string | null): string {
  const value = normalizeInput(url)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) {
    return `/api/media/download?url=${encodeURIComponent(value)}`
  }
  return passThroughNonHttp(value, /^data:(?:image|video|audio|application)\//i)
}

/**
 * 媒体(视频/音频)流式播放同源代理路径(2026-10-30 立,随图片代理同源收口补齐)。
 *
 * 后端 /api/media/stream 透传 Range、支持 seek、复用 _validate_url_ssrf 闸门;
 * 与图片代理不同,这里**无 whitelist 直连分支**——CSP 的 media-src 是
 * `'self' blob:`(无 https: 通配),任意外部 http(s) 媒体直链都必须走同源代理,
 * 否则被 media-src 直接拦截。data: 媒体 URI 亦不在 media-src 白名单(本代理无法
 * 代理 data:,原样返回,沿用既有行为);same-origin / blob: 原样返回。
 */
export function toMediaStreamUrl(url?: string | null): string {
  const value = normalizeInput(url)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) {
    return `/api/media/stream?url=${encodeURIComponent(value)}`
  }
  return passThroughNonHttp(value, DATA_MEDIA)
}
