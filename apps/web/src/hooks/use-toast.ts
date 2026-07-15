'use client'

import { toast } from 'sonner'

export interface UseToastReturn {
  toast: typeof toast
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

export function useToast(): UseToastReturn {
  const success = (message: string, description?: string) =>
    toast.success(message, description ? { description } : undefined)
  const error = (message: string, description?: string) =>
    toast.error(message, description ? { description } : undefined)
  const warning = (message: string, description?: string) =>
    toast.warning(message, description ? { description } : undefined)
  const info = (message: string, description?: string) =>
    toast.info(message, description ? { description } : undefined)

  return { toast, success, error, warning, info }
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
