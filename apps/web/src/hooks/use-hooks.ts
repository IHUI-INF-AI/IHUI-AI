'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import type {
  CreateHookInput,
  Hook,
  HookLog,
  TestHookInput,
  TestHookResult,
  UpdateHookInput,
} from '@ihui/types'

/**
 * Hook 数据层(react-query)— 2026-07-22 立。
 *
 * 端点契约(后端 apps/api/src/routes/hooks.ts → 转发 ai-service):
 *  GET    /api/hooks                    → { hooks: Hook[], count: number }
 *  POST   /api/hooks                    → Hook
 *  GET    /api/hooks/:id                → Hook
 *  PATCH  /api/hooks/:id                → Hook
 *  DELETE /api/hooks/:id                → { deleted: true, id: string }
 *  POST   /api/hooks/:id/toggle         → Hook
 *  POST   /api/hooks/:id/test           → TestHookResult
 *  GET    /api/hooks/:id/logs           → { logs: HookLog[], count: number }
 *  GET    /api/hooks/logs               → { logs: HookLog[], count: number }
 */

interface HookListResponse {
  hooks: Hook[]
  count: number
}

interface HookLogsResponse {
  logs: HookLog[]
  count: number
}

/**
 * Hook 日志过滤参数(与后端 HookLogsFilter 对应,2026-07-22 立)。
 *
 * 透传给 /api/hooks/:id/logs 和 /api/hooks/logs 的 query 参数。
 */
export interface HookLogsFilter {
  /** 按触发事件过滤 */
  event?: string
  /** 按成功/失败过滤 */
  success?: boolean
  /** 耗时下限(ms,含) */
  durationMin?: number
  /** 耗时上限(ms,含) */
  durationMax?: number
  /** 起始时间(ISO 字符串,含) */
  since?: string
  /** 截止时间(ISO 字符串,含) */
  until?: string
}

/** Hook 执行统计(2026-07-22 立) */
export interface HookStats {
  total: number
  success: number
  failed: number
  avgDuration: number
}

/** 批量启用/禁用响应(2026-07-22 立) */
interface BatchToggleResponse {
  results: { id: string; success: boolean; error?: string }[]
  succeeded: number
  failed: number
}

async function fetchHooks(event?: string): Promise<Hook[]> {
  const qs = event ? `?event=${encodeURIComponent(event)}` : ''
  const res = await fetchApi<HookListResponse>(`/api/hooks${qs}`)
  if (!res.success) throw new Error(res.error)
  return res.data.hooks
}

async function fetchHookLogs(
  hookId: string,
  limit = 100,
  filter?: HookLogsFilter,
): Promise<HookLog[]> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (filter?.event) params.set('event', filter.event)
  if (filter?.success !== undefined) params.set('success', String(filter.success))
  if (filter?.durationMin !== undefined) params.set('durationMin', String(filter.durationMin))
  if (filter?.durationMax !== undefined) params.set('durationMax', String(filter.durationMax))
  if (filter?.since) params.set('since', filter.since)
  if (filter?.until) params.set('until', filter.until)
  const res = await fetchApi<HookLogsResponse>(
    `/api/hooks/${encodeURIComponent(hookId)}/logs?${params.toString()}`,
  )
  if (!res.success) throw new Error(res.error)
  return res.data.logs
}

async function createHookApi(input: CreateHookInput): Promise<Hook> {
  const res = await fetchApi<Hook>('/api/hooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function updateHookApi(id: string, input: UpdateHookInput): Promise<Hook> {
  const res = await fetchApi<Hook>(`/api/hooks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function deleteHookApi(id: string): Promise<boolean> {
  const res = await fetchApi<{ deleted: boolean; id: string }>(
    `/api/hooks/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error)
  return res.data.deleted === true
}

async function toggleHookApi(id: string, enabled: boolean): Promise<Hook> {
  const res = await fetchApi<Hook>(`/api/hooks/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function testHookApi(id: string, input: TestHookInput): Promise<TestHookResult> {
  const res = await fetchApi<TestHookResult>(
    `/api/hooks/${encodeURIComponent(id)}/test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 获取 Hook 执行统计(2026-07-22 立)。可选 hookId 过滤单个 Hook。 */
async function fetchHookStats(hookId?: string): Promise<HookStats> {
  const qs = hookId ? `?hookId=${encodeURIComponent(hookId)}` : ''
  const res = await fetchApi<HookStats>(`/api/hooks/stats${qs}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 批量启用/禁用 Hook(2026-07-22 立) */
async function batchToggleApi(
  hookIds: string[],
  enabled: boolean,
): Promise<BatchToggleResponse> {
  const res = await fetchApi<BatchToggleResponse>('/api/hooks/batch/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hookIds, enabled }),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

const HOOKS_QUERY_KEY = ['hooks'] as const
const hookLogsQueryKey = (id: string) => ['hooks', id, 'logs'] as const
const hookStatsQueryKey = (hookId?: string) => ['hooks', 'stats', hookId ?? 'all'] as const

/** Hook 列表 + CRUD mutations */
export function useHooks(event?: string) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: event ? ['hooks', { event }] : HOOKS_QUERY_KEY,
    queryFn: () => fetchHooks(event),
  })

  const createMut = useMutation({
    mutationFn: (input: CreateHookInput) => createHookApi(input),
    onSuccess: () => {
      toast.success('Hook 已创建')
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error('创建失败', { description: e.message }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHookInput }) =>
      updateHookApi(id, input),
    onSuccess: () => {
      toast.success('Hook 已更新')
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error('更新失败', { description: e.message }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteHookApi(id),
    onSuccess: () => {
      toast.success('Hook 已删除')
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error('删除失败', { description: e.message }),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleHookApi(id, enabled),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error('切换失败', { description: e.message }),
  })

  const testMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TestHookInput }) =>
      testHookApi(id, input),
    onError: (e: Error) => toast.error('测试失败', { description: e.message }),
  })

  const batchToggleMut = useMutation({
    mutationFn: ({ hookIds, enabled }: { hookIds: string[]; enabled: boolean }) =>
      batchToggleApi(hookIds, enabled),
    onSuccess: (data) => {
      if (data.failed > 0) {
        toast.warning(`批量操作:${data.succeeded} 成功,${data.failed} 失败`)
      } else {
        toast.success(`批量${data.succeeded > 0 ? '操作完成' : '无变更'}`)
      }
      void qc.invalidateQueries({ queryKey: HOOKS_QUERY_KEY })
    },
    onError: (e: Error) => toast.error('批量操作失败', { description: e.message }),
  })

  return {
    hooks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
    createHook: createMut.mutateAsync,
    updateHook: updateMut.mutateAsync,
    deleteHook: deleteMut.mutateAsync,
    toggleHook: toggleMut.mutateAsync,
    testHook: testMut.mutateAsync,
    batchToggle: batchToggleMut.mutateAsync,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
    isDeleting: deleteMut.isPending,
    isTesting: testMut.isPending,
    isBatchToggling: batchToggleMut.isPending,
  }
}

/** 单个 Hook 的日志查询(支持过滤参数,2026-07-22 立) */
export function useHookLogs(
  hookId: string | null,
  limit = 100,
  filter?: HookLogsFilter,
) {
  const query = useQuery({
    queryKey: hookId
      ? [...hookLogsQueryKey(hookId), filter]
      : ['hooks', 'logs', 'disabled'],
    queryFn: () => (hookId ? fetchHookLogs(hookId, limit, filter) : Promise.resolve([])),
    enabled: !!hookId,
  })
  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

/** Hook 执行统计(2026-07-22 立)。可选 hookId 过滤单个 Hook。 */
export function useHookStats(hookId?: string) {
  const query = useQuery({
    queryKey: hookStatsQueryKey(hookId),
    queryFn: () => fetchHookStats(hookId),
  })
  return {
    stats: query.data ?? { total: 0, success: 0, failed: 0, avgDuration: 0 },
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

export type UseHooksReturn = ReturnType<typeof useHooks>
