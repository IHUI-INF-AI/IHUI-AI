import { setTokenProvider, setBaseUrl, fetchApi as fetchApiShared } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
import { getAuthCookie } from '@/lib/cookie-utils'

// 2026-07-25 修复 CSRF:内存 token 为 null 时从 auth_token cookie 兜底读取。
// 原因:登录后只把 accessToken 写到 cookie(2026-07-21 安全加固后未持久化到 localStorage),
// 刷新页面后 useAuthStore.token 丢失,但 cookie 仍在。CSRF 插件(csrf.ts)对非 Bearer
// 写请求直接拒绝,导致新增服务商等表单无法保存。
setTokenProvider({
  getToken: () => useAuthStore.getState().token ?? getAuthCookie(),
})

// A 套壳:rewrites 失效后(output: 'export'),前端直连 apps/api
// - Tauri 环境:直连 http://127.0.0.1:8802(本地 API server)
// - 浏览器环境:用 NEXT_PUBLIC_API_BASE_URL 环境变量(开发时设 http://localhost:8802)
// - 未设置时 baseUrl 为空,依赖同源反代(如 Nginx)
// 只在客户端执行(build/SSR 时跳过,避免循环依赖导致模块导出未初始化)
function detectApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Tauri 2 环境:window.__TAURI_INTERNALS__ 或 window.__TAURI__
    if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
      return 'http://127.0.0.1:8802'
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || ''
}

if (typeof window !== 'undefined') {
  setBaseUrl(detectApiBaseUrl())
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
      const currentPath = window.location.pathname + window.location.search
      openLoginDialogOnce(currentPath)
    }
  }
  return result
}

export { setTokenProvider, setBaseUrl, streamChat } from '@ihui/api-client'
export type { ApiResult, ApiResponse } from '@ihui/types'
