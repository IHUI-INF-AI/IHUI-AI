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
} from './admin-tenants.types.js'

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
