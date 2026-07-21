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
  /** P1-2.2b: 实际字节数(KB),用于前端排序与统计 */
  sizeKb: number
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

export interface BackupDeleteResult {
  status: 'deleted'
  slug: string
  timestamp: string
  output?: string
}

export interface BackupListResult {
  backups: Backup[]
}

export interface TenantRestoreBody {
  timestamp?: string
}

/* ==================== P1-2.2c: 证书 + 配额 ==================== */

export type CertStatus = 'healthy' | 'warning' | 'critical' | 'expired'
export type CertSource = 'letsencrypt' | 'self-signed' | 'custom'

export interface Certificate {
  domain: string
  sans: string[]
  issuer: string
  subject: string
  notBefore: string
  notAfter: string
  daysUntilExpiry: number
  status: CertStatus
  source: CertSource
  serialNumber?: string
  fingerprint?: string
}

export interface CertificateListResult {
  certificates: Certificate[]
  total: number
  healthy: number
  warning: number
  critical: number
  expired: number
  acmePath: string
  acmeExists: boolean
  generatedAt: string
}

export interface QuotaWindow {
  used: number
  limit: number | null
  window: 'all' | 'day' | 'month'
  resetAt: string | null
}

export interface QuotaStorage {
  usedBytes: number
  limitBytes: number | null
}

export interface CustomerQuota {
  slug: string
  apiCalls: QuotaWindow
  storage: QuotaStorage
  aiTokens: QuotaWindow
  /** P1-2.2c 占位:等待 P1-2.3 接入 Prometheus 后置为 false */
  placeholder: boolean
  expectedFrom: string
  generatedAt: string
}

/* ==================== P1-2.3: Prometheus 实时指标 ==================== */

/** per-tenant 详细实时指标(数据源:Prometheus) */
export interface CustomerMetrics {
  slug: string
  /** CPU 占用核数(5m 速率 × 5min 累计) */
  cpu: number
  /** 内存占用字节数 */
  memoryBytes: number
  /** 网络下行字节/秒 */
  networkRxBytesPerSec: number
  /** 网络上行字节/秒 */
  networkTxBytesPerSec: number
  /** Prometheus 不可达时为 false,UI 降级显示 */
  available: boolean
  generatedAt: string
}

/** 横向对比 — 单一租户聚合 */
export interface TenantMetricsSummary {
  slug: string
  cpu: number
  memoryBytes: number
  containers: number
}

/** 横向对比 — 多租户聚合 */
export interface MetricsSummary {
  tenants: TenantMetricsSummary[]
  total: number
  available: boolean
  generatedAt: string
}
