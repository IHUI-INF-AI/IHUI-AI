import { setTokenProvider, fetchApi as fetchApiShared } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'

setTokenProvider({ getToken: () => useAuthStore.getState().token })

/** 防止 401 风暴:同一时刻只允许一个全局登录弹窗 */
let loginDialogOpenGuard = false

/**
 * 读取 auth_token cookie(兜底获取 token,用于 race condition 检测)。
 * zustand persist 异步 rehydrate,初次 render 时 store.token 可能为 null,
 * 但 cookie 已有 token(登录成功后立即写入),此时 401 是 race condition,不该弹窗。
 */
function getAuthTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1] ?? '') : null
}

/**
 * 401 兜底弹窗:
 * 1. 立即检查 store.token,有则不弹(token 有效但可能权限不足,业务自己处理)
 * 2. 立即检查 cookie,有则不弹(zustand persist 还没 rehydrate,等 useAuthBootstrap 处理)
 * 3. 都没有,延迟 300ms 再检查一次(给 persist rehydrate + useAuthBootstrap 一点时间)
 * 4. 仍没有 token,才真正弹窗
 *
 * 这样可以避免"已登录用户被误弹登录窗"的 race condition(2026-07-21 修)。
 */
function openLoginDialogFor401(): void {
  if (typeof window === 'undefined') return
  if (loginDialogOpenGuard) return

  // 立即检查:store 有 token → 不弹(token 可能权限不足,业务自己处理)
  if (useAuthStore.getState().token) return
  // 立即检查:cookie 有 token → 不弹(zustand persist 还没 rehydrate)
  if (getAuthTokenFromCookie()) return

  // 延迟 300ms 再检查一次,给 persist rehydrate 时间
  setTimeout(() => {
    if (loginDialogOpenGuard) return
    if (useAuthStore.getState().token) return
    if (getAuthTokenFromCookie()) return

    loginDialogOpenGuard = true
    const currentPath = window.location.pathname + window.location.search
    useLoginDialogStore.getState().open('login', currentPath)
    const unsub = useLoginDialogStore.subscribe((s) => {
      if (!s.isOpen) {
        loginDialogOpenGuard = false
        unsub()
      }
    })
  }, 300)
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
