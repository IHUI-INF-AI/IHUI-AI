'use client'

import { useCallback, useMemo } from 'react'
// 2026-08-01:改用 @/components/common 的 toastProxy(而非 sonner 直接),统一走
// window event 总线,由 Toaster.tsx 接收渲染。error/warning 会被自动中文化。
import { toast } from '@/components/common'

export interface UseToastReturn {
  toast: typeof toast
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

/**
 * 稳定引用的 toast hook(2026-07-31 修复:防止消费者 useCallback 依赖无限循环)。
 *
 * 根因:原实现每次 render 返回新对象 + 新函数,导致依赖 `toast` 的 useCallback
 * 每次失效,进而触发 useEffect 无限重跑(如 usePublishAccounts 在未登录时疯狂
 * 重发 GET /api/publish/accounts/me → 100+ 次 toast.error("Authentication required"))。
 *
 * 修复:4 个 wrapper 用 useCallback([]) 固化,返回对象用 useMemo 固化。
 * toastProxy 本身是模块级稳定引用,无需处理。
 *
 * 2026-08-01:改用 toastProxy 后,error/warning 调用会被 Toaster.tsx 的 handler
 * 自动中文化(toUserFriendlyMessage),业务方无需逐个处理英文错误消息。
 */
export function useToast(): UseToastReturn {
  const success = useCallback(
    (message: string, description?: string) =>
      toast.success(message, description ? { description } : undefined),
    [],
  )
  const error = useCallback(
    (message: string, description?: string) =>
      toast.error(message, description ? { description } : undefined),
    [],
  )
  const warning = useCallback(
    (message: string, description?: string) =>
      toast.warning(message, description ? { description } : undefined),
    [],
  )
  const info = useCallback(
    (message: string, description?: string) =>
      toast.info(message, description ? { description } : undefined),
    [],
  )
  return useMemo(() => ({ toast, success, error, warning, info }), [success, error, warning, info])
}

// 加载状态管理
let loadingCount = 0
const loadingListeners: Set<(loading: boolean) => void> = new Set()

export function useLoading() {
  const setLoading = (loading: boolean) => {
    if (loading) {
      loadingCount++
    } else {
      loadingCount = Math.max(0, loadingCount - 1)
    }
    const isLoading = loadingCount > 0
    loadingListeners.forEach((fn) => fn(isLoading))
  }

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true)
    try {
      return await fn()
    } finally {
      setLoading(false)
    }
  }

  return { setLoading, withLoading }
}
