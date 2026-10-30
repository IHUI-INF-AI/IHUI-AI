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
 * 非 http(s)(data:/blob:/同源相对路径如 /uploads/ /remote-images/)原样返回,不进代理。
 */
export function toMediaImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  if (/^https?:\/\//i.test(url)) {
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
