'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { ApiResult } from '@ihui/types'

export interface UseAuthedApiReturn {
  /** 调用受保护接口；未登录时返回失败结果并提示 */
  call: <T>(url: string, options?: RequestInit) => Promise<ApiResult<T>>
  /** 未登录时自动打开登录弹窗的钩子（由调用方注入） */
  onUnauthorized: (() => void) | null
  setOnUnauthorized: (cb: (() => void) | null) => void
}

/**
 * 已认证 API 调用 Hook
 *
 * 封装 fetchApi，在未登录或遇到 401 时统一提示并触发登录回调，
 * 适用于需要登录态的业务接口调用。
 */
export function useAuthedApi(): UseAuthedApiReturn {
  const toast = useToast()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const onUnauthorizedRef = React.useRef<(() => void) | null>(null)

  const call = React.useCallback(
    async <T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> => {
      if (!isAuthenticated) {
        toast.warning('请先登录')
        onUnauthorizedRef.current?.()
        return { success: false, error: '未登录' }
      }
      const res = await fetchApi<T>(url, options)
      if (!res.success && /401|未授权|token/i.test(res.error)) {
        onUnauthorizedRef.current?.()
      }
      return res
    },
    [isAuthenticated, toast],
  )

  const setOnUnauthorized = React.useCallback((cb: (() => void) | null) => {
    onUnauthorizedRef.current = cb
  }, [])

  return { call, onUnauthorized: onUnauthorizedRef.current, setOnUnauthorized }
}
