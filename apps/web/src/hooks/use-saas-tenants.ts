/**
 * P1-2.2: SaaS 租户管理 — React Query 查询钩子
 */
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  adminGetCustomerMetrics,
  adminGetCustomerQuota,
  adminGetMetricsSummary,
  adminGetTenant,
  adminListBackups,
  adminListCertificates,
  adminListTenants,
} from '@ihui/api-client'

import type {
  Backup,
  BackupListResult,
  CertificateListResult,
  CustomerMetrics,
  CustomerQuota,
  MetricsSummary,
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

/** P1-2.2c: 证书列表(扫描 Traefik acme.json) */
export function useCertificatesQuery(options?: {
  refetchInterval?: number
  enabled?: boolean
}): UseQueryResult<CertificateListResult, Error> {
  return useQuery<CertificateListResult, Error>({
    queryKey: ['admin', 'saas', 'certificates'],
    queryFn: async () => {
      const r = await adminListCertificates()
      if (!r.success) throw new Error(r.error)
      return r.data as CertificateListResult
    },
    refetchInterval: options?.refetchInterval ?? 60_000,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  })
}

/** P1-2.2c: 租户配额(P1-2.2c 占位,等 P1-2.3 Prometheus) */
export function useCustomerQuotaQuery(
  slug: string | null,
): UseQueryResult<CustomerQuota, Error> {
  return useQuery<CustomerQuota, Error>({
    queryKey: ['admin', 'saas', 'tenants', 'quota', slug],
    queryFn: async () => {
      if (!slug) throw new Error('slug required')
      const r = await adminGetCustomerQuota(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as CustomerQuota
    },
    enabled: Boolean(slug),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

/** P1-2.3: per-tenant 实时 Prometheus 指标(CPU/内存/网络) */
export function useCustomerMetricsQuery(
  slug: string | null,
  options?: { refetchInterval?: number; enabled?: boolean },
): UseQueryResult<CustomerMetrics, Error> {
  return useQuery<CustomerMetrics, Error>({
    queryKey: ['admin', 'saas', 'tenants', 'metrics', slug],
    queryFn: async () => {
      if (!slug) throw new Error('slug required')
      const r = await adminGetCustomerMetrics(slug)
      if (!r.success) throw new Error(r.error)
      return r.data as CustomerMetrics
    },
    enabled: (options?.enabled ?? true) && Boolean(slug),
    refetchInterval: options?.refetchInterval ?? 15_000,
    staleTime: 10_000,
  })
}

/** P1-2.3: 多租户横向对比 */
export function useMetricsSummaryQuery(options?: {
  refetchInterval?: number
  enabled?: boolean
}): UseQueryResult<MetricsSummary, Error> {
  return useQuery<MetricsSummary, Error>({
    queryKey: ['admin', 'saas', 'metrics', 'summary'],
    queryFn: async () => {
      const r = await adminGetMetricsSummary()
      if (!r.success) throw new Error(r.error)
      return r.data as MetricsSummary
    },
    refetchInterval: options?.refetchInterval ?? 30_000,
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  })
}
