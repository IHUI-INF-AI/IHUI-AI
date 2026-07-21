/**
 * P1-2.2 SaaS 部署层管理后台 — API 端点
 *
 * 调用链:web 端 → /api/admin-saas/* → Next.js Route Handler → admin-api /admin/api/*
 * 鉴权:由 Next.js middleware 注入 X-Admin-User,web 端无需关心
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

import type {
  BackupDeleteResult,
  BackupListResult,
  CertificateListResult,
  CustomerMetrics,
  CustomerQuota,
  MetricsSummary,
  TenantActionResult,
  TenantCreateResult,
  TenantDetailResult,
  TenantForm,
  TenantListResult,
  TenantRestoreBody,
} from './admin-tenants.types.js'

export type {
  Tenant,
  TenantState,
  TenantForm,
  Backup,
  TenantListResult,
  TenantDetailResult,
  TenantCreateResult,
  TenantActionResult,
  BackupDeleteResult,
  BackupListResult,
  TenantRestoreBody,
  CertStatus,
  CertSource,
  CertificateListResult,
  QuotaWindow,
  QuotaStorage,
  CustomerQuota,
  CustomerMetrics,
  TenantMetricsSummary,
  MetricsSummary,
} from './admin-tenants.types.js'

// 注意:Certificate 类型与 resource.ts 冲突(均为证书领域类型,字段含义不同),
// 不在此处 export,使用方请按需从子路径导入或重命名:
import type { Certificate as TenantCertificate } from './admin-tenants.types.js'
export type { TenantCertificate }

/** 列出所有租户 */
export async function adminListTenants(): Promise<ApiResult<TenantListResult>> {
  return fetchApi<TenantListResult>('/api/admin-saas/customers')
}

/** 租户详情 */
export async function adminGetTenant(slug: string): Promise<ApiResult<TenantDetailResult>> {
  return fetchApi<TenantDetailResult>(`/api/admin-saas/customers/${encodeURIComponent(slug)}`)
}

/** 创建租户 */
export async function adminCreateTenant(
  body: TenantForm,
): Promise<ApiResult<TenantCreateResult>> {
  return fetchApi<TenantCreateResult>('/api/admin-saas/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 暂停租户 */
export async function adminPauseTenant(slug: string): Promise<ApiResult<TenantActionResult>> {
  return fetchApi<TenantActionResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/pause`,
    { method: 'POST' },
  )
}

/** 恢复租户 */
export async function adminResumeTenant(slug: string): Promise<ApiResult<TenantActionResult>> {
  return fetchApi<TenantActionResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/resume`,
    { method: 'POST' },
  )
}

/** 备份租户 */
export async function adminBackupTenant(slug: string): Promise<ApiResult<TenantActionResult>> {
  return fetchApi<TenantActionResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/backup`,
    { method: 'POST' },
  )
}

/** 从备份恢复租户 */
export async function adminRestoreTenant(
  slug: string,
  body?: TenantRestoreBody,
): Promise<ApiResult<TenantActionResult>> {
  return fetchApi<TenantActionResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/restore`,
    {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    },
  )
}

/** 销毁租户 */
export async function adminDeleteTenant(slug: string): Promise<ApiResult<TenantActionResult>> {
  return fetchApi<TenantActionResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}`,
    { method: 'DELETE' },
  )
}

/** 列出租户备份 */
export async function adminListBackups(slug: string): Promise<ApiResult<BackupListResult>> {
  return fetchApi<BackupListResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/backups`,
  )
}

/** P1-2.2b: 删除指定备份 */
export async function adminDeleteBackup(
  slug: string,
  timestamp: string,
): Promise<ApiResult<BackupDeleteResult>> {
  return fetchApi<BackupDeleteResult>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/backups/${encodeURIComponent(timestamp)}`,
    { method: 'DELETE' },
  )
}

/* ==================== P1-2.2c: 证书 + 配额 ==================== */

/** 列出所有证书(扫描 Traefik acme.json) */
export async function adminListCertificates(): Promise<ApiResult<CertificateListResult>> {
  return fetchApi<CertificateListResult>('/api/admin-saas/certificates')
}

/** 获取租户配额(P1-2.2c 占位,等待 P1-2.3 Prometheus 接入) */
export async function adminGetCustomerQuota(slug: string): Promise<ApiResult<CustomerQuota>> {
  return fetchApi<CustomerQuota>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/quota`,
  )
}

/* ==================== P1-2.3: Prometheus 实时指标 ==================== */

/** per-tenant 详细指标(数据源:Prometheus via admin-api) */
export async function adminGetCustomerMetrics(
  slug: string,
): Promise<ApiResult<CustomerMetrics>> {
  return fetchApi<CustomerMetrics>(
    `/api/admin-saas/customers/${encodeURIComponent(slug)}/metrics`,
  )
}

/** 多租户横向对比(CPU/内存聚合) */
export async function adminGetMetricsSummary(): Promise<ApiResult<MetricsSummary>> {
  return fetchApi<MetricsSummary>('/api/admin-saas/metrics/summary')
}
