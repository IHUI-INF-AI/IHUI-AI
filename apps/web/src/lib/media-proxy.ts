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

export function toMediaImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url)
      // 白名单域名直连(CSP img-src 已放行);其余任意公网直链走同源代理。
      if (isWhitelistedHost(u.hostname)) return url
    } catch {
      // 解析失败(异常输入)一律进代理,由后端 SSRF 闸门兜底拦截。
    }
    return `/api/media/image?url=${encodeURIComponent(url)}`
  }
  return url
}

/** 下载代理路径(后端 /api/media/download 带 Content-Disposition,同源无 CORS 问题)。 */
export function toMediaDownloadUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  if (/^https?:\/\//i.test(url)) {
    return `/api/media/download?url=${encodeURIComponent(url)}`
  }
  return url
}
