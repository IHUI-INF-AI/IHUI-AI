'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'
import type {
  Rule,
  RuleInput,
  RuleListResponse,
  RuleTestRequest,
  RuleTestResult,
  RuleUpdate,
} from '@ihui/types'

/**
 * Rules 数据 hooks(2026-07-22 立,对标 Trae IDE Rules)。
 *
 * 使用 react-query 管理服务端状态:
 *  - listRules:useQuery 拉 /api/rules
 *  - createRule/updateRule/deleteRule:useMutation + invalidate
 *  - testRule:useMutation(不 invalidate,只返回结果)
 *
 * fetchApi 在 401 时自动弹登录弹窗(见 lib/api.ts)。
 */

const QUERY_KEY = ['rules'] as const

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 列出全部规则 */
export function useRulesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api<RuleListResponse>('/api/rules').then((res) => res.rules),
  })
}

/** 创建规则 */
export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RuleInput) =>
      api<Rule>('/api/rules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** 更新规则 */
export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RuleUpdate }) =>
      api<Rule>(`/api/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** 删除规则 */
export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; deleted: boolean }>(
        `/api/rules/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** 启用/禁用规则(乐观更新) */
export function useToggleRuleEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<Rule>(`/api/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData<Rule[]>(QUERY_KEY)
      qc.setQueryData<Rule[]>(QUERY_KEY, (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, enabled } : r)),
      )
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** 测试规则 */
export function useTestRule() {
  return useMutation({
    mutationFn: ({ id, message }: { id: string } & RuleTestRequest) =>
      api<RuleTestResult>(
        `/api/rules/${encodeURIComponent(id)}/test`,
        {
          method: 'POST',
          body: JSON.stringify({ message }),
        },
      ),
  })
}

/** 便捷聚合 hook:一次性拿到所有规则操作 */
export function useRules() {
  const list = useRulesList()
  const create = useCreateRule()
  const update = useUpdateRule()
  const del = useDeleteRule()
  const toggle = useToggleRuleEnabled()
  const test = useTestRule()

  return React.useMemo(
    () => ({
      rules: list.data ?? [],
      loading: list.isLoading,
      error: list.error,
      refresh: list.refetch,
      createRule: create.mutateAsync,
      updateRule: update.mutateAsync,
      deleteRule: del.mutateAsync,
      toggleEnabled: toggle.mutateAsync,
      testRule: test.mutateAsync,
      isPending: {
        create: create.isPending,
        update: update.isPending,
        delete: del.isPending,
        test: test.isPending,
      },
    }),
    [list, create, update, del, toggle, test],
  )
}
