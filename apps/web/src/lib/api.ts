import { setTokenProvider, fetchApi as fetchApiShared } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'

setTokenProvider({ getToken: () => useAuthStore.getState().token })

/**
 * 公开路径白名单 — 这些页面的 401 不弹登录窗。
 * 用户在首页 / 落地页 / 定价页等刷新时不弹窗,
 * 只有进入需要登录的功能页或主动操作时才弹窗(2026-07-23 用户要求)。
 */
const PUBLIC_PATHNAMES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/contact',
  '/pricing',
  '/help',
  '/docs',
  '/forbidden',
  '/not-found',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHNAMES.includes(pathname)) return true
  // sso / auth 回调路径
  if (pathname.startsWith('/sso/') || pathname.startsWith('/auth/')) return true
  // h5 分享页
  if (pathname.startsWith('/h5/share/')) return true
  return false
}

/** 防止 401 风暴:同一时刻只允许一个全局登录弹窗 */
let loginDialogOpenGuard = false
function openLoginDialogFor401(): void {
  if (typeof window === 'undefined') return
  if (loginDialogOpenGuard) return
  // 公开页面(/, /pricing 等)的 401 不弹窗
  // 用户主动操作需要登录的功能时,由各业务 hook(use-chat 等)自己弹窗
  if (isPublicPath(window.location.pathname)) return
  loginDialogOpenGuard = true
  const currentPath = window.location.pathname + window.location.search
  useLoginDialogStore.getState().open('login', currentPath)
  const unsub = useLoginDialogStore.subscribe((s) => {
    if (!s.isOpen) {
      loginDialogOpenGuard = false
      unsub()
    }
  })
}

/**
 * Web 端 fetchApi 包装:在 401 未授权时自动打开登录弹窗(避免重复弹窗)。
 * 业务调用方无需关心 401 → 弹窗的串联。
 */
export async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const result = await fetchApiShared<T>(url, options)
  if (!result.success && result.status === 401) {
    openLoginDialogFor401()
  }
  return result
}

export { setTokenProvider, setBaseUrl, streamChat } from '@ihui/api-client'
export type { ApiResult, ApiResponse } from '@ihui/types'
