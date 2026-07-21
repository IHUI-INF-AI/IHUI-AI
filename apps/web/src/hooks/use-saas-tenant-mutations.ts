/**
 * P1-2.2: SaaS 租户管理 — React Query 变更钩子
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  adminBackupTenant,
  adminCreateTenant,
  adminDeleteTenant,
  adminPauseTenant,
  adminRestoreTenant,
  adminResumeTenant,
} from '@ihui/api-client'

import type {
  TenantActionResult,
  TenantCreateResult,
  TenantForm,
  TenantRestoreBody,
} from '@ihui/api-client'

const SAAS_QUERY_KEYS = ['admin', 'saas'] as const

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SAAS_QUERY_KEYS })
}

export function useCreateTenant(): UseMutationResult<
  TenantCreateResult,
  Error,
  TenantForm
> {
  const qc = useQueryClient()
  return useMutation<TenantCreateResult, Error, TenantForm>({
    mutationFn: async (body) => {
      const r = await adminCreateTenant(body)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantCreateResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 创建已发起,等待健康检查完成`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  })
}

export function usePauseTenant(): UseMutationResult<
  TenantActionResult,
  Error,
  string
> {
  const qc = useQueryClient()
  return useMutation<TenantActionResult, Error, string>({
    mutationFn: async (slug) => {
      const r = await adminPauseTenant(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantActionResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 已暂停`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`暂停失败: ${e.message}`),
  })
}

export function useResumeTenant(): UseMutationResult<
  TenantActionResult,
  Error,
  string
> {
  const qc = useQueryClient()
  return useMutation<TenantActionResult, Error, string>({
    mutationFn: async (slug) => {
      const r = await adminResumeTenant(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantActionResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 已恢复`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`恢复失败: ${e.message}`),
  })
}

export function useBackupTenant(): UseMutationResult<
  TenantActionResult,
  Error,
  string
> {
  const qc = useQueryClient()
  return useMutation<TenantActionResult, Error, string>({
    mutationFn: async (slug) => {
      const r = await adminBackupTenant(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantActionResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 备份已创建`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`备份失败: ${e.message}`),
  })
}

export function useRestoreTenant(): UseMutationResult<
  TenantActionResult,
  Error,
  { slug: string; body?: TenantRestoreBody }
> {
  const qc = useQueryClient()
  return useMutation<
    TenantActionResult,
    Error,
    { slug: string; body?: TenantRestoreBody }
  >({
    mutationFn: async ({ slug, body }) => {
      const r = await adminRestoreTenant(slug, body)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantActionResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 已从备份恢复`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`恢复失败: ${e.message}`),
  })
}

export function useDeleteTenant(): UseMutationResult<
  TenantActionResult,
  Error,
  string
> {
  const qc = useQueryClient()
  return useMutation<TenantActionResult, Error, string>({
    mutationFn: async (slug) => {
      const r = await adminDeleteTenant(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantActionResult
    },
    onSuccess: (data) => {
      toast.success(`租户 ${data.slug} 已销毁`)
      invalidateAll(qc)
    },
    onError: (e) => toast.error(`销毁失败: ${e.message}`),
  })
}
