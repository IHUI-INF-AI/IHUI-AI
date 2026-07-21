/**
 * P1-2.2 SaaS 部署层管理后台 — 类型定义
 * 配合 @ihui/api-client/endpoints/admin-tenants 使用
 */

export type TenantState =
  | 'active'
  | 'paused'
  | 'creating'
  | 'not-found'
  | 'destroyed'

export interface Tenant {
  slug: string
  state: TenantState
  stateChangedAt: string | null
  exists: boolean
  containersRunning: number
  containersTotal: number
  memory: string
  cpu: string
  domain: string
}

export interface TenantForm {
  slug: string
  memory?: string
  cpu?: string
  plan?: 'free' | 'pro' | 'enterprise'
}

export interface Backup {
  timestamp: string
  mtime: string
  size: string
  age: string
  fileCount: number
}

export interface TenantListResult {
  customers: Tenant[]
}

export interface TenantDetailResult extends Tenant {
  slug: string
}

export interface TenantCreateResult {
  status: string
  slug: string
  memory: string
  cpu: string
  plan: 'free' | 'pro' | 'enterprise'
  output: string
}

export interface TenantActionResult {
  status: string
  slug: string
  output?: string
}

export interface BackupListResult {
  backups: Backup[]
}

export interface TenantRestoreBody {
  timestamp?: string
}
