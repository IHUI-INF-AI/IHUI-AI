import { setTokenProvider, fetchApi as fetchApiShared } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'

setTokenProvider({ getToken: () => useAuthStore.getState().token })

/** 防止 401 风暴:同一时刻只允许一个全局登录弹窗 */
let loginDialogOpenGuard = false
function openLoginDialogFor401(): void {
  if (typeof window === 'undefined') return
  if (loginDialogOpenGuard) return
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
