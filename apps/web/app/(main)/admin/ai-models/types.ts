// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface ModelRow {
  id: number
  name: string
  providerCode: string
  isBuiltin: boolean
  baseUrl: string
  apiFormat: string
  modelIdForTest: string | null
  enabled: boolean
  description: string | null
  sortOrder: number
  ownerUuid: string | null
  lastTestStatus: string | null
  lastTestResponseMs: number | null
  lastTestedAt: string | null
  lastTestError: string | null
  hasApiKey: boolean
  /**
   * 列表接口按 API 的 RELAY_PROVIDERS 计算,不靠 name 里的手写后缀。
   * 兼容旧构建:缺失时按 false 处理。
   */
  isRelayProvider?: boolean
  createdAt: string
  updatedAt: string
}

export interface ListData {
  list: ModelRow[]
  total: number
  page: number
  pageSize: number
}

export type TelemetryWindow = '1h' | '24h' | '7d'

export interface ErrorBreakdown {
  auth: number
  rateLimit: number
  server: number
  timeout: number
  client: number
  other: number
}

export interface FormState {
  name: string
  providerCode: string
  baseUrl: string
  apiFormat: string
  modelIdForTest: string
  apiKey: string
  description: string
  sortOrder: string
  enabled: boolean
  ownerUuid: string
}

export interface TestResult {
  status: string
  responseMs?: number
}

/** 运行遥测:分钟桶(epoch ms)。 */
export interface TelemetrySeriesPoint {
  t: number
  calls: number
  tokens: number
  errors?: number
}

/** 运行质量分级的口径与后端 `gradeRuntime` 一一对应。 */
export type RuntimeGradeTier = 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient'

export interface RuntimeGrade {
  tier: RuntimeGradeTier
  /** 综合分 0-100;样本不足时为 null。 */
  score: number | null
  sample: number
}

/** 单个配置的近窗读数;calls5m/tokens5m 供行内 QPS/Token 速率用。 */
export interface ConfigTelemetry {
  calls: number
  tokens: number
  calls5m: number
  tokens5m: number
  errors: number
  p95LatencyMs: number | null
  lastCallAt: string | null
  grade: RuntimeGrade
  errorRate?: number | null
  ttftP95Ms?: number | null
  costCents?: number
  pricedCalls?: number
  retryableErrors?: number
  errorBreakdown?: ErrorBreakdown
}

/** GET /api/admin/ai-model-config/telemetry 的响应体。 */
export interface AiModelTelemetry {
  generatedAt: string
  window?: TelemetryWindow
  windowMinutes: number
  realtimeMinutes: number
  totals: {
    calls: number
    tokens: number
    promptTokens: number
    completionTokens: number
    errors: number
    errorRate: number | null
    avgLatencyMs: number | null
    p95LatencyMs: number | null
    activeConfigs: number
    unattributedCalls: number
    unattributedTokens: number
    attributedRate: number | null
    grade: RuntimeGrade
    ttftP95Ms?: number | null
    costCents?: number
    pricedCalls?: number
    costCoverage?: number | null
    retryableErrors?: number
    errorBreakdown?: ErrorBreakdown
    byTier?: Record<string, number>
  }
  realtime: {
    calls: number
    tokens: number
    qps: number
    tps: number
  }
  series: TelemetrySeriesPoint[]
  byConfig: Record<string, ConfigTelemetry>
}

export interface ModelTelemetry {
  model: string
  displayName: string | null
  configured: boolean
  enabled: boolean
  isRelayPublic: boolean
  calls: number
  tokens: number
  errors: number
  errorRate: number | null
  p95LatencyMs: number | null
  ttftP95Ms: number | null
  costCents: number
  pricedCalls: number
  lastCallAt: string | null
  grade: RuntimeGrade
}

export interface AiModelModelsTelemetry {
  generatedAt: string
  window: TelemetryWindow
  windowMinutes: number
  configId: number
  models: ModelTelemetry[]
}

export interface RecentAiModelCall {
  id: string
  createdAt: string
  model: string
  providerCode: string | null
  status: string
  httpStatus: number | null
  latencyMs: number
  ttftMs: number | null
  totalTokens: number
  costCents: number | null
  retryable: number
  errorMessage: string | null
  traceId: string | null
}

export interface AccountPoolSummary {
  providerCode: string
  total: number
  healthy: number
  enabled: number
  schedulable: number
  healthySchedulable: number
  sharedToOps: number
  opsTotal: number
  opsHealthy: number
  personalTotal: number
  personalHealthy: number
  tokenExpiringSoon: number
  tokenExpired: number
  lastUsedAt: string | null
}

export interface ConfigGovernance {
  id: number
  name: string
  providerCode: string
  providerGroup: string | null
  baseUrl: string
  enabled: boolean
  ownerUuid: string | null
  hasApiKey: boolean
  runtimeMode: 'account_pool' | 'local_bridge' | 'http' | 'mock'
  modelCount: number
  enabledModelCount: number
  publicModelCount: number
  duplicateName: boolean
  aliasConflictModels: string[]
  accountPool: AccountPoolSummary | null
}

export interface GovernanceIssue {
  code: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  count: number
  configIds: number[]
}

export interface AiModelGovernance {
  checkedAt: string
  summary: {
    configs: number
    models: number
    providers: number
    duplicateNameGroups: number
    aliasConflictGroups: number
    orphanModels: number
    enabledNoModels: number
    publicConfigDisabled: number
    publicZeroPrice: number
    configsWithoutTest: number
    publicNoOpsAccounts: number
  }
  byConfig: Record<string, ConfigGovernance>
  byProvider: Record<string, AccountPoolSummary>
  issues: GovernanceIssue[]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
