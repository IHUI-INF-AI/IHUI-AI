// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 后端寻址统一判定(2026-09-21 根治"桌面端连不上生产后端")。
 *
 * 问题:桌面端是薄壳模式 —— tauri.conf.json 的 windows[0].url =
 * https://aizhs.top/agents,主窗口直接加载**线上**前端;而线上 web 构建刻意把
 * NEXT_PUBLIC_API_BASE_URL 置空(scripts/build-next-prod.ps1:浏览器走同源 /api/* 反代)。
 * 旧逻辑把它写成:
 *   '__TAURI_INTERNALS__' in window ? NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8802' : ...
 * 即把"Tauri 运行时"等同于"本地三端联调":线上构建的空 env 被 `||` 吞掉,回退到本机 API。
 * 结果桌面端全部 REST/SSE/WS 请求打到 http://127.0.0.1:8802:
 *   - 用户机器没跑本地后端 → ECONNREFUSED,登录页报无法连接后端;
 *   - 用户机器恰好跑着 dev 后端 → 打到本地库,生产账号不存在 → 登录失败。
 * 同时 Rust 侧健康探活是指向 https://aizhs.top/api/health 的(正确),两侧语义分裂。
 *
 * 正确语义:**按窗口实际 origin 判定**,而不是按"是不是 Tauri":
 *   1. NEXT_PUBLIC_API_BASE_URL 显式非空 → 最高优先(桌面端 SaaS 烘焙场景);
 *   2. Tauri + 窗口加载远端站点 → ''(同源 /api/*,与线上浏览器完全一致;cookie 同源
 *      自动附带,顺带恢复 SameSite=Lax 的 refresh 轮转);
 *   3. Tauri + 窗口是本地 origin(localhost:8801 dev / tauri.localhost 本地壳 /
 *      offline 兜底页)→ 本机 API(本地三端联调语义原样保留);
 *   4. 浏览器 dev(localhost:8801)→ ''(同源,Next dev rewrites 代理到 8802);
 *   5. 其它 → ''(生产同源)。
 *
 * 平台特有:依赖 window.location 与 Tauri 运行时标识,不适合下沉 packages/shared。
 */

/** 视为"本地开发 / 本地壳"的 hostname —— 命中才走本机 API */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'tauri.localhost'])

/** 本机 API(本地三端联调)。用 127.0.0.1 避免系统代理/PAC 影响 */
const LOCAL_API_BASE = 'http://127.0.0.1:8802'

/** 本机 SSE 基址。用 localhost:PAC 常把 127.0.0.1 路由到代理导致 ERR_CONNECTION_REFUSED */
const LOCAL_STREAM_BASE = 'http://localhost:8802'

/** Tauri 运行时标识(Tauri 2 在 withGlobalTauri=false 下只注入 __TAURI_INTERNALS__) */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * 当前窗口是否加载远端站点(生产桌面端的常态)。
 * 非 http(s) 协议(file: / offline: / tauri:)一律视为本地壳。
 */
export function isRemoteWindow(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return false
  return !LOCAL_HOSTNAMES.has(hostname)
}

/** 浏览器本地 dev(Next dev server:8801) */
function isLocalDevOrigin(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' && window.location.port === '8801'
}

/**
 * REST 基址。
 * @returns 空字符串 = 同源(window.location.origin 的 /api/*)
 */
export function resolveApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL
  if (env) return env
  if (typeof window === 'undefined') return ''
  if (isTauriRuntime()) return isRemoteWindow() ? '' : LOCAL_API_BASE
  return ''
}

/**
 * SSE / 流式 REST 基址。
 *
 * 浏览器 dev 走本机直连是为了绕过 Next dev proxy 对 SSE 的缓冲/超时;
 * 生产构建同源(`NODE_ENV==='development'` 门控,防止 CI e2e 的 next build 跑在
 * localhost:8801 被误判成 dev → 跨源直连被 CSP connect-src 'self' 拦截)。
 *
 * @returns 空字符串 = 同源
 */
export function resolveStreamApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_STREAM_API_BASE_URL
  if (env) return env
  if (typeof window === 'undefined') return ''
  if (isTauriRuntime()) {
    if (isRemoteWindow()) return ''
    // 本地壳:若已烘焙线上 API 基址(scripts/desktop-build-saas.mjs),
    // SSE 必须复用同一线上地址,否则会误连本机 dev 后端
    return process.env.NEXT_PUBLIC_API_BASE_URL || LOCAL_STREAM_BASE
  }
  if (process.env.NODE_ENV === 'development' && isLocalDevOrigin()) return LOCAL_STREAM_BASE
  return ''
}

/**
 * WebSocket 基址(通知 / agent 控制 / UI 控制桥)。
 *
 * 与 REST 的差异:**必须是绝对地址** —— packages/api-client 的 buildNotificationWsUrl
 * 内部走 `new URL(baseUrl)`,传空串会抛 TypeError,所以不能用 resolveApiBaseUrl() 的
 * "" 同源约定,需显式回退到 window.location.origin。
 *
 * 优先级:NEXT_PUBLIC_WS_BASE_URL(生产 WS 独立子域,见 lib/ws-url.ts 的 101/000 实测)
 * → REST 基址(桌面端本地壳/浏览器 dev)→ 当前 origin(同源)。
 */
export function resolveWsApiBaseUrl(): string {
  const wsEnv = process.env.NEXT_PUBLIC_WS_BASE_URL
  if (wsEnv) return wsEnv.replace(/\/+$/, '')
  const rest = resolveApiBaseUrl()
  if (rest) return rest
  return typeof window !== 'undefined' ? window.location.origin : ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
