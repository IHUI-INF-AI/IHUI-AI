'use client'

import * as React from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'

/**
 * Admin 批量操作通用 hook。
 *
 * 抽取自 281 个 admin 页面中重复出现的 `string[]` 数组 mutation 模式(批量删除/批量授权等),
 * 统一管理:invalidate + toast 成功/失败 + isLoading + 空数组守卫。
 *
 * 用法:
 * ```ts
 * const { mutate, isPending } = useBatchMutation({
 *   endpoint: '/api/v1/admin/<resource>',
 *   method: 'DELETE',
 *   queryKey: ['admin', '<resource>'],
 *   ids: [...selected],
 *   successMessage: t('deleteSuccess'),
 *   onSuccess: () => setSelected(new Set()),
 * })
 * ```
 */
export interface UseBatchMutationOptions {
  /** 后端资源路径,如 `/api/v1/admin/<resource>` */
  endpoint: string
  /** HTTP 方法,默认 `DELETE`(admin 场景绝大多数为批量删除) */
  method?: 'POST' | 'DELETE' | 'PUT'
  /** 成功后需要 invalidate 的 react-query key */
  queryKey: QueryKey
  /** 本次操作的 ID 列表,空数组时 `mutate` 自动跳过 */
  ids: string[]
  /**
   * ID 传参模式:
   * - `body`(默认):`{ ids }` JSON body
   * - `url`:拼到 path 末尾(`/endpoint/{id1,id2}`)
   */
  mode?: 'body' | 'url'
  /** 成功 toast 文本;不传则不弹 */
  successMessage?: string
  /** 失败 toast 文本(默认读取后端 error message) */
  errorMessage?: string
  /** 业务侧额外回调,接收实际处理的 ID 数量 */
  onSuccess?: (count: number) => void
  /** 业务侧错误回调 */
  onError?: (error: Error) => void
}

export interface UseBatchMutationResult {
  /** 触发批量操作;不传参数时使用 options.ids,空数组则跳过请求 */
  mutate: (overrideIds?: string[]) => void
  /** 是否正在请求中 */
  isPending: boolean
  /** 最近一次错误 */
  error: Error | null
}

export function useBatchMutation(options: UseBatchMutationOptions): UseBatchMutationResult {
  const {
    endpoint,
    method = 'DELETE',
    queryKey,
    ids,
    mode = 'body',
    successMessage,
    errorMessage,
    onSuccess,
    onError,
  } = options
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (inputIds: string[]) => {
      if (inputIds.length === 0) return { count: 0 }
      const url = mode === 'url' ? `${endpoint}/${inputIds.join(',')}` : endpoint
      const body = mode === 'body' ? JSON.stringify({ ids: inputIds }) : undefined
      const res = await fetchApi(url, { method, body })
      if (!res.success) throw new Error(res.error)
      return { count: inputIds.length }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey })
      if (data.count > 0 && successMessage) toast.success(successMessage)
      onSuccess?.(data.count)
    },
    onError: (e: Error) => {
      if (errorMessage) toast.error(errorMessage)
      else toast.error(e.message)
      onError?.(e)
    },
  })

  const mutate = React.useCallback(
    (overrideIds?: string[]) => {
      const target = overrideIds ?? ids
      if (target.length === 0) return
      mutation.mutate(target)
    },
    [mutation, ids],
  )

  return {
    mutate,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
