/**
 * CLI 配置导入共享类型
 *
 * 用于 cc-switch / codex++ / 各 CLI 工具(Claude Code / Codex / Gemini CLI / Hermes 等)
 * 配置文件的统一导入。前后端、CLI、Desktop 共用。
 *
 * 关键约束:
 * - ImportedProvider.apiKey 仅在后端内存中存在,序列化到前端前必须经 maskApiKey 脱敏
 * - CliAppType 严格对齐 cc-switch Rust AppType 枚举(8 值)
 * - CliApiFormat 是 ApiFormat 的超集(扩展 gemini_native)
 */

/** 导入来源工具 */
export type CliConfigSource =
  'cc-switch' | 'codex++' | 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'hermes'

/** cc-switch 的 app_type(严格对齐 cc-switch Rust AppType 枚举) */
export type CliAppType =
  | 'claude'
  | 'claude-desktop'
  | 'codex'
  | 'gemini'
  | 'grokbuild'
  | 'opencode'
  | 'openclaw'
  | 'hermes'

/** API 协议格式(扩展自 ApiFormat,加 gemini_native) */
export type CliApiFormat =
  'openai_chat' | 'anthropic_messages' | 'openai_responses' | 'gemini_native'

/** 重复导入处理策略 */
export type ImportConflictStrategy = 'overwrite' | 'skip' | 'clone'

/** 已解析的 MCP 服务器 */
export interface ImportedMcpServer {
  sourceId: string
  name: string
  serverConfig: Record<string, unknown>
  enabledApps: CliAppType[]
}

/** 已解析的供应商(统一中间模型) */
export interface ImportedProvider {
  /** 源工具中的 provider id */
  sourceId: string
  /** cc-switch 的 app_type(其他来源为 undefined) */
  sourceAppType?: CliAppType
  /** 显示名(可能已被去重处理) */
  name: string
  /** 映射到 ihui 的 providerCode(openai/anthropic/google/.../custom) */
  providerCode: string
  /** API Base URL */
  baseUrl: string
  /** API Key 明文(仅在后端内存中;序列化到前端前必须脱敏) */
  apiKey?: string
  /** API 协议格式 */
  apiFormat: CliApiFormat
  /** 默认测试模型 ID */
  modelIdForTest?: string
  /** 额外配置(MCP / Skills / 完整 settingsConfig / codex++ relayMode 等) */
  extraConfig?: Record<string, unknown>
  /** 元信息 */
  meta?: {
    category?: string
    websiteUrl?: string
    icon?: string
    iconColor?: string
    notes?: string
    /** codex++ 专属 */
    relayMode?: 'official' | 'mixedApi' | 'pureApi' | 'aggregate'
    protocol?: 'responses' | 'chatCompletions'
    contextWindow?: string
    models?: string[]
  }
  /** 是否当前激活(用于设置用户默认) */
  isCurrent: boolean
  /** 解析过程中的警告 */
  warnings: string[]
}

/** 导入预览(未落库) */
export interface ImportPreview {
  /** 预览 ID(用于 commit 时关联,Redis 缓存 key) */
  previewId: string
  source: CliConfigSource
  sourcePath: string
  sourceVersion?: string
  detectedAt: string
  providers: ImportedProvider[]
  mcpServers?: ImportedMcpServer[]
  /** 全局警告(非 provider 级别) */
  globalWarnings: string[]
}

/** commit 请求 */
export interface ImportCommitRequest {
  previewId: string
  /** 选中的 provider sourceId 列表(空数组 = 全选) */
  selectedProviderIds: string[]
  /** 重复冲突策略 */
  conflictStrategy: ImportConflictStrategy
}

/** commit 失败详情 */
export interface ImportFailedDetail {
  sourceId: string
  reason: string
}

/** commit 响应 */
export interface ImportCommitResponse {
  importId: string
  imported: number
  skipped: number
  failed: number
  failedDetails: ImportFailedDetail[]
  /** 落库后的 ai_model_config id 列表 */
  configIds: number[]
}

/** 历史记录条目 */
export interface ImportHistoryItem {
  id: string
  source: CliConfigSource
  sourcePath: string
  sourceVersion?: string
  importedCount: number
  skippedCount: number
  failedCount: number
  status: 'success' | 'partial' | 'failed'
  errorMessage?: string
  importedAt: string
}

/** 探测到的本地来源 */
export interface DetectedSource {
  source: CliConfigSource
  path: string
  exists: boolean
  sizeBytes?: number
  version?: string
}

/**
 * API Key 脱敏工具(前后端共用)
 * sk-abcdefghij1234 → sk-a***1234
 */
export function maskApiKey(key?: string): string {
  if (!key) return '(空)'
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}***${key.slice(-4)}`
}
