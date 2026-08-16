import {
  setTokenProvider,
  setBaseUrl,
  setStreamBaseUrl,
  setDeviceFingerprintProvider,
  fetchApi as fetchApiShared,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
import { getAuthCookie } from '@/lib/cookie-utils'
import { webDeviceFingerprintCollector } from '@/hooks/use-device-fingerprint'

// 2026-07-25 修复 CSRF:内存 token 为 null 时从 auth_token cookie 兜底读取。
// P2-18 修复(2026-08-06):auth_token 已 httpOnly,getAuthCookie() 恒返回 null,
// 该兜底自然失效——请求凭内存 token 发 Bearer;内存无 token 时由浏览器自动附带
// httpOnly cookie(api-client transport 默认 credentials: 'include')兜底认证。
setTokenProvider({
  getToken: () => useAuthStore.getState().token ?? getAuthCookie(),
  // 2026-08-06 401 自动续期:access token 过期(15min)时,api-client 收到 401 会调用
  // 此回调,用 httpOnly refresh_token cookie(30 天)静默换取新 access token。
  // 走 fetchApi 自身(经 isAuthEndpoint 判断 /auth/refresh 不递归续期)。
  // 刷新失败(401,refresh token 也失效)→ 返回 null → 调用方按登录过期处理。
  refreshAccessToken: async () => {
    const res = await fetchApiShared<{
      accessToken: string
      refreshToken?: string | null
    }>('/auth/refresh', { method: 'POST', body: JSON.stringify({}) })
    if (res.success && res.data?.accessToken) {
      // 更新内存 token;refreshToken 由后端 httpOnly cookie 轮转,前端不落地
      useAuthStore.getState().setToken(res.data.accessToken, res.data.refreshToken ?? null)
      return res.data.accessToken
    }
    return null
  },
})

// A 套壳:rewrites 失效后(output: 'export'),前端直连 apps/api
// - Tauri 环境:直连 http://127.0.0.1:8802(本地 API server)
// - 浏览器 dev 环境(localhost:8801):走同源 /api/*(Next.js dev rewrites 代理到 8802),
//   避免跨端口 POST 触发 SameSite=Lax cookie 不附带 → /auth/refresh 等鉴权 POST 接口 400
// - 浏览器生产/其他:用 NEXT_PUBLIC_API_BASE_URL 环境变量;未设置时空字符串依赖同源反代
// 只在客户端执行(build/SSR 时跳过,避免循环依赖导致模块导出未初始化)
function detectApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Tauri 2 环境 IPC 桥(2026-07-29:withGlobalTauri 关闭后只检测此标识)
    if ('__TAURI_INTERNALS__' in window) {
      return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8802'
    }
    // 2026-08-14 P0 修复:浏览器 dev 环境强制走同源 /api/* —— Next.js dev rewrites
    // (next.config.ts:188-300)已配齐全部 /api/* → 8802/8803 代理。同源 POST 自动带 cookie,
    // 解决"自动登录 /auth/refresh 永远 400"问题(跨端口 8801→8802 时 SameSite=Lax 不带 cookie)。
    // 显式设置 NEXT_PUBLIC_API_BASE_URL 时仍优先(支持需要直连 8802 的特殊场景,如 cookie 调试)。
    if (
      window.location.hostname === 'localhost' &&
      window.location.port === '8801' &&
      !process.env.NEXT_PUBLIC_API_BASE_URL
    ) {
      return ''
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || ''
}

// 2026-07-27 修复 SSE 流被 Next.js dev proxy 中断:
// Next.js dev server 的 rewrite 代理对 SSE 流式响应有超时/缓冲问题,导致 net::ERR_ABORTED。
// streamChat 用独立的 streamBaseUrl 直连 API 服务器,绕过 dev proxy。
// 检测策略(按优先级):
// 1. Tauri 环境:直连 http://localhost:8802
// 2. 开发环境(localhost:8801):直连 http://localhost:8802(绕过 Next.js dev proxy)
// 3. 显式 env 配置:NEXT_PUBLIC_STREAM_API_BASE_URL
// 4. 生产环境:留空走同源(baseUrl 复用)
// 2026-07-27 修复:用 localhost 替代 127.0.0.1 — Chrome 系统代理/PAC 文件常把 127.0.0.1
// 路由到代理服务器导致 ERR_CONNECTION_REFUSED,而 localhost 走 bypass 列表能正常访问。
function detectStreamBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Tauri 2 环境 IPC 桥(2026-07-29:withGlobalTauri 关闭后只检测此标识)
    if ('__TAURI_INTERNALS__' in window) {
      return process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || 'http://localhost:8802'
    }
    // 开发环境:Next.js dev server 运行在 localhost:8801
    // SSE 流直连 API 服务器 localhost:8802,绕过 dev proxy 的超时/缓冲
    if (window.location.hostname === 'localhost' && window.location.port === '8801') {
      return process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || 'http://localhost:8802'
    }
  }
  // 生产环境或显式配置(留空则复用 baseUrl,走同源反代)
  return process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || ''
}

if (typeof window !== 'undefined') {
  setBaseUrl(detectApiBaseUrl())
  setStreamBaseUrl(detectStreamBaseUrl())
  // 设备维度风控:注入 web 采集器,api-client 自动把指纹塞进 x-device-fingerprint header
  setDeviceFingerprintProvider(webDeviceFingerprintCollector)
}

/**
 * Web 端 fetchApi 包装:401 未授权时自动打开登录弹窗。
 *
 * 懒触发策略(2026-07-23 用户要求"刚进页面不弹出,只有需要登录的功能点击后才弹出"):
 * - GET 请求(页面初始加载 / 查询)的 401 不弹窗,避免一进页面就被弹窗打断
 * - 非 GET 请求(POST/PUT/DELETE/PATCH,即用户主动操作如安装/评分/发消息)的 401 才弹窗
 * - 业务调用方无需关心 401 → 弹窗的串联
 * - 统一走 openLoginDialogOnce(2026-07-24 深度根治):自带全局去重 guard + 公开路径白名单
 */
export async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const result = await fetchApiShared<T>(url, options)
  if (!result.success && result.status === 401) {
    const method = (options.method ?? 'GET').toUpperCase()
    // 仅用户主动操作(非 GET)的 401 才弹窗
    if (method !== 'GET') {
      // 2026-08-14 修复:页面刷新后 isAuthenticated=true 但 token=null(刷新中)时,
      // 不触发弹窗。避免 bootstrap 静默刷新期间被其他并发请求的 401 打断。
      // refresh 成功 → token 恢复 → 后续请求正常;refresh 失败 → logout() 降级 isAuthenticated=false,
      // 再遇到 401 才弹窗(用户确实需要登录)。
      const { isAuthenticated, token } = useAuthStore.getState()
      if (isAuthenticated && !token) return result
      const currentPath = window.location.pathname + window.location.search
      openLoginDialogOnce(currentPath)
    }
  }
  return result
}

export function getStreamBaseUrl(): string {
  return detectStreamBaseUrl()
}

export { setTokenProvider, setBaseUrl, setStreamBaseUrl, streamChat, getToken } from '@ihui/api-client'
export type { ApiResult, ApiResponse } from '@ihui/types'
