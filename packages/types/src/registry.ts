/**
 * 资源上游自动同步中心跨端契约类型(2026-07-24 立)。
 *
 * 设计目标:统一描述 MCP / Skill / Plugin 三类资源从多上游源
 * (GitHub / npm / MCP marketplace / 自建 registry)拉取、缓存、
 * 评分、安装、升级、回滚的完整生命周期,以及 webhook 触发记录
 * 持久化、Provider 模型列表动态拉取、上游配置漂移检测与自动迁移。
 */

// ================== 基础枚举 ==================

/** 资源类型 */
export type RegistrySourceType = 'mcp' | 'skill' | 'plugin'

/** 上游源标识 */
export type RegistryUpstreamSource =
  | 'github' // GitHub 官方仓库(modelcontextprotocol/servers 等)
  | 'npm' // npm registry(@modelcontextprotocol/* 等)
  | 'mcp_marketplace' // mcp.so / smithery.ai / glama.ai 第三方市场
  | 'custom' // 自建 registry(可对接 api 自身或外部 URL)

/** 同步状态 */
export type RegistrySyncStatus = 'success' | 'fail' | 'skipped' | 'running'

/** 列表排序键 */
export type RegistrySortKey = 'latest' | 'hot' | 'best'

/** 安装状态 */
export type RegistryInstallStatus =
  | 'not_installed'
  | 'installed'
  | 'upgradable'
  | 'failed'

// ================== 资源条目 ==================

/** 上游资源元数据(对应 registry_items 表) */
export interface RegistryItem {
  id: string
  sourceType: RegistrySourceType
  source: RegistryUpstreamSource
  /** 上游源内唯一 ID(GitHub repo full_name / npm 包名 / marketplace item id) */
  sourceId: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  homepage: string | null
  repoUrl: string | null
  downloadUrl: string | null
  categories: string[]
  tags: string[]
  installCount: number
  /** 热度评分(综合 install_count + github stars + recent_releases) */
  heatScore: number
  /** 质量评分(综合 文档完整度 / 维护活跃度 / 兼容性) */
  qualityScore: number
  latestSyncedAt: string | null
  /** 原始上游 payload(GitHub release / npm manifest / marketplace api response) */
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** 列表查询参数 */
export interface RegistryItemListQuery {
  sourceType?: RegistrySourceType
  source?: RegistryUpstreamSource
  sort?: RegistrySortKey
  /** 模糊搜索(name / description / tags) */
  q?: string
  /** 分类过滤 */
  category?: string
  page?: number
  pageSize?: number
}

/** 列表响应 */
export interface RegistryItemListResponse {
  items: RegistryItem[]
  total: number
  page: number
  pageSize: number
  /** 当前用户已安装条目 ID 集合(供前端标记"已安装/可升级") */
  installedIds: string[]
}

/** 单条详情响应 */
export interface RegistryItemDetailResponse {
  item: RegistryItem
  /** 当前用户安装状态 */
  installStatus: RegistryInstallStatus
  /** 已安装版本(null 表示未安装) */
  installedVersion: string | null
  /** 是否有新版本可升级 */
  upgradeAvailable: boolean
}

// ================== 同步日志 ==================

/** 同步日志条目(对应 registry_sync_logs 表) */
export interface RegistrySyncLog {
  id: string
  sourceType: RegistrySourceType
  sourceName: string
  status: RegistrySyncStatus
  errorMessage: string | null
  /** 本次拉取 payload 的 SHA-256(用于变更检测) */
  payloadHash: string | null
  oldVersion: string | null
  newVersion: string | null
  durationMs: number
  startedAt: string
  finishedAt: string | null
}

/** 同步日志列表查询 */
export interface RegistrySyncLogQuery {
  sourceType?: RegistrySourceType
  status?: RegistrySyncStatus
  page?: number
  pageSize?: number
}

/** 同步日志列表响应 */
export interface RegistrySyncLogListResponse {
  logs: RegistrySyncLog[]
  total: number
  page: number
  pageSize: number
}

// ================== 同步触发 ==================

/** 手动触发同步请求(管理员) */
export interface RegistrySyncRequest {
  /** 不传 = 全部 */
  sourceType?: RegistrySourceType
  /** 不传 = 全部 */
  source?: RegistryUpstreamSource
  /** 强制全量同步(忽略 payload_hash 跳过) */
  force?: boolean
}

/** 同步触发响应 */
export interface RegistrySyncResponse {
  success: boolean
  /** 触发的同步任务 ID(BullMQ job id) */
  jobId: string | null
  message: string
  /** 同步统计 */
  stats: {
    synced: number
    failed: number
    skipped: number
    durationMs: number
  }
}

// ================== Webhook 接收 ==================

/** webhook 入口路径参数(source 标识上游源) */
export interface RegistryWebhookParams {
  source: RegistryUpstreamSource
}

/** webhook 接收响应 */
export interface RegistryWebhookResponse {
  accepted: boolean
  /** 落库的 webhook_triggers 记录 ID */
  triggerId: string
  /** 是否触发了同步任务(payload_hash 未变化则不触发) */
  syncTriggered: boolean
  message: string
}

/** 持久化的 webhook 触发记录(对应 webhook_triggers 表) */
export interface RegistryWebhookTriggerRecord {
  id: string
  name: string
  /** 事件类型(GitHub push/release / npm hook / marketplace event) */
  eventType: string
  source: RegistryUpstreamSource
  /** HMAC-SHA256 签名(请求头 X-Hub-Signature-256 等) */
  signature: string | null
  /** 原始 payload */
  payload: Record<string, unknown>
  /** 接收时间 */
  receivedAt: string
  /** 处理完成时间 */
  processedAt: string | null
  /** 处理状态 */
  status: 'pending' | 'processed' | 'failed' | 'ignored'
  /** 处理结果消息 */
  resultMessage: string | null
}

// ================== 安装/升级 ==================

/** 安装请求 */
export interface InstallRegistryItemRequest {
  sourceType: RegistrySourceType
  sourceId: string
  /** 指定版本(null = latest) */
  version?: string
}

/** 安装响应 */
export interface InstallRegistryItemResponse {
  success: boolean
  installed: boolean
  version: string | null
  message: string
}

/** 批量升级请求 */
export interface UpgradeAllRequest {
  sourceType?: RegistrySourceType
}

/** 批量升级响应 */
export interface UpgradeAllResponse {
  success: boolean
  upgraded: number
  failed: number
  skipped: number
  details: Array<{
    sourceId: string
    status: 'upgraded' | 'failed' | 'skipped'
    message: string
  }>
}

// ================== Provider 模型列表 ==================

/** 单个 provider 支持的模型信息 */
export interface ProviderModelInfo {
  /** 模型 ID(provider 内唯一,如 step-3.7-flash) */
  id: string
  /** 显示名 */
  name: string
  /** 上下文窗口大小(tokens) */
  contextWindow: number | null
  /** 是否支持流式 */
  supportsStreaming: boolean | null
  /** 是否支持函数调用 */
  supportsToolCalls: boolean | null
  /** 是否支持视觉输入 */
  supportsVision: boolean | null
  /** 输入价格(美元/1M tokens) */
  inputPrice: number | null
  /** 输出价格(美元/1M tokens) */
  outputPrice: number | null
}

/** Provider 模型列表响应 */
export interface ProviderModelListResponse {
  provider: string
  models: ProviderModelInfo[]
  /** 是否命中缓存 */
  cached: boolean
  /** 缓存过期时间(ISO) */
  cacheExpiresAt: string | null
  /** 数据来源(live / cache / fallback) */
  source: 'live' | 'cache' | 'fallback'
}

// ================== 配置漂移检测 ==================

/** 配置文件类型 */
export type ConfigFileType =
  | 'env_example'
  | 'env_production_example'
  | 'config_py'
  | 'package_json'
  | 'docker_compose'

/** 单个文件漂移报告 */
export interface ConfigDriftReport {
  fileType: ConfigFileType
  filePath: string
  /** 当前内容的 SHA-256 */
  currentHash: string
  /** 上游基线的 SHA-256 */
  upstreamHash: string
  /** 是否漂移 */
  drifted: boolean
  /** 变更行数(新增+删除) */
  changedLines: number
  /** 新增键(仅 env/config) */
  addedKeys: string[]
  /** 删除键 */
  removedKeys: string[]
  /** 值变更键 */
  changedKeys: string[]
}

/** 配置漂移检测响应 */
export interface ConfigDriftDetectResponse {
  reports: ConfigDriftReport[]
  /** 是否有漂移 */
  hasDrift: boolean
  /** 检测时间 */
  detectedAt: string
}

/** 配置迁移请求(管理员) */
export interface ConfigMigrateRequest {
  /** 仅迁移指定文件类型(不传 = 全部) */
  fileType?: ConfigFileType
  /** 高危变更需人工确认(默认 true) */
  dryRun?: boolean
  /** 自动回滚阈值(失败变更数超过此值则整体回滚) */
  rollbackThreshold?: number
}

/** 配置迁移响应 */
export interface ConfigMigrateResponse {
  success: boolean
  migrated: number
  skipped: number
  failed: number
  /** 是否触发回滚 */
  rolledBack: boolean
  /** 备份目录路径(失败可手动恢复) */
  backupDir: string | null
  details: Array<{
    fileType: ConfigFileType
    status: 'migrated' | 'skipped' | 'failed' | 'rolled_back'
    message: string
  }>
}
