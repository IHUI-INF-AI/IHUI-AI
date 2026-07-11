'use client'

import * as React from 'react'

import { useToast } from '@/hooks/use-toast'

export interface ApiErrorContext {
  url: string
  method?: string
  error: string
  timestamp: number
}

export interface UseApiErrorReturn {
  errors: ApiErrorContext[]
  lastError: ApiErrorContext | null
  capture: (ctx: Omit<ApiErrorContext, 'timestamp'>) => void
  clear: () => void
  /** 包装一个 Promise，失败时自动捕获并提示 */
  guard: <T>(promise: Promise<T>, ctx?: { url?: string; method?: string }) => Promise<T | null>
}

/** API 错误处理 Hook，统一收集错误上下文并通过 toast 提示 */
export function useApiError(): UseApiErrorReturn {
  const toast = useToast()
  const [errors, setErrors] = React.useState<ApiErrorContext[]>([])

  const capture = React.useCallback(
    (ctx: Omit<ApiErrorContext, 'timestamp'>) => {
      const entry: ApiErrorContext = { ...ctx, timestamp: Date.now() }
      setErrors((prev) => [entry, ...prev].slice(0, 50))
      toast.error('请求失败', ctx.error)
    },
    [toast],
  )

  const clear = React.useCallback(() => setErrors([]), [])

  const guard = React.useCallback(
    async <T>(promise: Promise<T>, ctx?: { url?: string; method?: string }): Promise<T | null> => {
      try {
        return await promise
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        capture({
          url: ctx?.url ?? '',
          method: ctx?.method,
          error: message,
        })
        return null
      }
    },
    [capture],
  )

  const lastError = errors[0] ?? null

  return { errors, lastError, capture, clear, guard }
}
