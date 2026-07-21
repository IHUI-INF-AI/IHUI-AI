/**
 * P1-2.2: SaaS 租户管理 — React Query 查询钩子
 */
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  adminGetTenant,
  adminListBackups,
  adminListTenants,
} from '@ihui/api-client'

import type {
  Backup,
  BackupListResult,
  Tenant,
  TenantDetailResult,
  TenantListResult,
} from '@ihui/api-client'

/** 租户列表(默认 30s 轮询,管理后台期望看到状态实时变化) */
export function useTenantsQuery(options?: {
  refetchInterval?: number
  enabled?: boolean
}): UseQueryResult<Tenant[], Error> {
  return useQuery<Tenant[], Error>({
    queryKey: ['admin', 'saas', 'tenants'],
    queryFn: async () => {
      const r = await adminListTenants()
      if (!r.success) throw new Error(r.error)
      return (r.data as TenantListResult).customers ?? []
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    enabled: options?.enabled ?? true,
    staleTime: 10_000,
  })
}

/** 租户详情 */
export function useTenantDetail(
  slug: string | null,
): UseQueryResult<TenantDetailResult, Error> {
  return useQuery<TenantDetailResult, Error>({
    queryKey: ['admin', 'saas', 'tenants', 'detail', slug],
    queryFn: async () => {
      if (!slug) throw new Error('slug required')
      const r = await adminGetTenant(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as TenantDetailResult
    },
    enabled: Boolean(slug),
    refetchInterval: 30_000,
  })
}

/** 租户备份列表 */
export function useBackupsQuery(
  slug: string | null,
): UseQueryResult<Backup[], Error> {
  return useQuery<Backup[], Error>({
    queryKey: ['admin', 'saas', 'tenants', 'backups', slug],
    queryFn: async () => {
      if (!slug) throw new Error('slug required')
      const r = await adminListBackups(slug)
      if (!r.success) throw new Error(r.error)
      return (r.data as BackupListResult).backups ?? []
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  })
}
