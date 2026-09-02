// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSocket 地址统一构造(2026-09-02 立)。
 *
 * 背景:此前各 hook 直接用 `${proto}//${window.location.host}${path}` 构造 WS 地址,
 * 而桌面端(Tauri)页面 origin 是 localhost:8801(生产包为 tauri.localhost),
 * 导致 WS 永远打到本地 dev server —— 即便 REST/SSE 已通过 NEXT_PUBLIC_API_BASE_URL
 * 指向线上,实时通道仍连不上。本模块把 WS 源的解析收口为统一策略。
 *
 * 平台特有:依赖 window.location 与 Tauri 运行时检测,不适合下沉到 packages/shared。
 *
 * 解析优先级:
 *   1. NEXT_PUBLIC_WS_BASE_URL —— 显式 WS 基址(推荐)。WS 与 REST 常需分域:
 *      实测主域 aizhs.top 对 /cozeZhsApi/*、/v1/ai/capabilities/* 的 WS 升级失败(000),
 *      而 api.aizhs.top 全路径返回 101,故生产环境 WS 应指向 api.aizhs.top。
 *   2. 桌面端 + NEXT_PUBLIC_API_BASE_URL —— 由 REST 基址推导(https→wss / http→ws)。
 *   3. 其余(浏览器 dev / 生产)—— 空字符串 = 同源,与改造前行为完全一致(零回归)。
 */

/** http(s) 基址 → ws(s) 源(去尾部斜杠) */
function toWsOrigin(base: string): string {
  return base.replace(/\/+$/, '').replace(/^http/, 'ws')
}

/**
 * 解析 WebSocket 源(origin)。
 * @returns 空字符串表示走同源 window.location.host
 *          (Next dev rewrites `/ws/*` → 8802,或生产 nginx 反代)。
 */
export function detectWsOrigin(): string {
  if (typeof window === 'undefined') return ''
  const explicit = process.env.NEXT_PUBLIC_WS_BASE_URL
  if (explicit) return toWsOrigin(explicit)
  // 仅桌面端改写:浏览器 dev/生产保持同源,行为零变更
  if ('__TAURI_INTERNALS__' in window) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
    if (apiBase) return toWsOrigin(apiBase)
  }
  return ''
}

/**
 * 构造带 access token 的 WebSocket URL。
 * @param path 以 `/` 开头的路径;也接受显式配置的绝对 URL(如 NEXT_PUBLIC_WS_CHAT_URL)
 * @param token 可选;后端 WS 握手要求 `?token=<access_token>`
 * @returns SSR 环境返回空字符串(沿用改造前各 hook 的约定)
 */
export function buildWsUrl(path: string, token?: string | null): string {
  if (typeof window === 'undefined') return ''
  const sep = path.includes('?') ? '&' : '?'
  const qs = token ? `${sep}token=${encodeURIComponent(token)}` : ''
  // 显式配置了完整 URL → 直接使用(统一转成 ws/wss 协议)
  if (/^(wss?|https?):\/\//.test(path)) {
    return `${path.replace(/^http/, 'ws')}${qs}`
  }
  const origin =
    detectWsOrigin() ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  return `${origin}${path}${qs}`
}
