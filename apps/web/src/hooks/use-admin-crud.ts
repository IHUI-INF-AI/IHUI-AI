'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface AdminCrudOptions {
  /** 资源路径，如 /api/admin/users */
  resource: string
  /** react-query 缓存键 */
  queryKey: string
}

export interface AdminListResponse<T> {
  list: T[]
  total: number
}

export interface UseAdminCrudReturn<T extends { id: string }> {
  list: T[]
  total: number
  isLoading: boolean
  creating: boolean
  updating: boolean
  deleting: boolean
  error: Error | null
  fetchList: (params?: Record<string, unknown>) => Promise<void>
  create: (data: Partial<T>) => Promise<T | null>
  update: (id: string, data: Partial<T>) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
  invalidate: () => void
}

/** Admin CRUD 通用逻辑 Hook，封装 fetchApi + react-query，适用于后台资源管理 */
export function useAdminCrud<T extends { id: string }>(
  options: AdminCrudOptions,
): UseAdminCrudReturn<T> {
  const { resource, queryKey } = options
  const queryClient = useQueryClient()
  const [params, setParams] = React.useState<Record<string, unknown>>({})

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [queryKey, params],
    queryFn: async () => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      const url = qs ? `${resource}?${qs}` : resource
      const res = await fetchApi<AdminListResponse<T>>(url)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: Partial<T>) => {
      const res = await fetchApi<T>(resource, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [queryKey] }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
      const res = await fetchApi<T>(`${resource}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [queryKey] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`${resource}/${id}`, { method: 'DELETE' })
      return res.success
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [queryKey] }),
  })

  const fetchList = React.useCallback(
    async (next?: Record<string, unknown>) => {
      if (next) setParams(next)
      await refetch()
    },
    [refetch],
  )

  const create = React.useCallback(
    async (data: Partial<T>) => {
      try {
        return await createMutation.mutateAsync(data)
      } catch {
        return null
      }
    },
    [createMutation],
  )

  const update = React.useCallback(
    async (id: string, data: Partial<T>) => {
      try {
        return await updateMutation.mutateAsync({ id, data })
      } catch {
        return null
      }
    },
    [updateMutation],
  )

  const remove = React.useCallback(
    async (id: string) => {
      try {
        return await deleteMutation.mutateAsync(id)
      } catch {
        return false
      }
    },
    [deleteMutation],
  )

  return {
    list: data?.list ?? [],
    total: data?.total ?? 0,
    isLoading,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    error: error as Error | null,
    fetchList,
    create,
    update,
    remove,
    invalidate: () => void queryClient.invalidateQueries({ queryKey: [queryKey] }),
  }
}
