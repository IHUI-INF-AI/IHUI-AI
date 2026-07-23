/**
 * 上下文系统跨端共享类型(2026-07-24 立,对标 TRAE Work #Context 系统)。
 *
 * 契约对齐 apps/api/src/routes/context-mentions.ts:
 *  - GET  /context/mentions?q=&type=             → Mention[]
 *  - GET  /context/database/tables?q=            → Mention[]
 *  - GET  /context/database/schema/:table        → TableSchema
 *  - GET  /context/symbols?q=                    → Symbol[]
 *  - POST /context/enrich                        → EnrichResult
 *  - GET  /context/sources                       → ContextSource[]
 *  - POST /context/visualization/track           → { recorded: boolean }
 *  - GET  /context/visualization                 → VisualizationData
 *  - GET  /context/compression-stats             → CompressionStats
 *  - GET  /context/memory                        → SessionMemory
 *  - DELETE /context/memory                      → { cleared: boolean }
 */

/** 上下文源类型 */
export type ContextType = 'file' | 'database' | 'symbol' | 'folder' | 'web'

/** @ 提及结果 */
export interface Mention {
  id: string
  type: ContextType
  label: string
  detail?: string
  insertText: string
  meta?: Record<string, unknown>
}

/** 表 schema 列定义 */
export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  defaultValue?: string
}

/** 表 schema 完整定义 */
export interface TableSchema {
  table: string
  columns: TableColumn[]
  indexes?: Array<{ name: string; columns: string[]; unique: boolean }>
}

/** 符号搜索结果 */
export interface SymbolResult {
  id: string
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant'
  filePath: string
  line: number
  detail?: string
}

/** enrich 请求体 */
export interface EnrichInput {
  userMessage: string
  conversationId: string
  mentions: Mention[]
  messages?: Array<{ role: string; content: string }>
  totalBudget: number
  userId?: string
}

/** enrich 响应 */
export interface EnrichResult {
  context: string
  tokensUsed: number
  budget: number
  sources: Array<{ type: ContextType; label: string; tokens: number }>
  truncated: boolean
}

/** 上下文源预算分配 */
export interface ContextSource {
  type: ContextType
  label: string
  description: string
  budgetPercent: number
  enabled: boolean
}

/** Token 可视化分布 */
export interface TokenDistribution {
  totalTokens: number
  historyTokens: number
  codebaseTokens: number
  mentionTokens: number
  webTokens: number
  databaseTokens: number
}

/** 可视化数据 */
export interface VisualizationData {
  current: TokenDistribution
  history: Array<{
    timestamp: string
    distribution: TokenDistribution
  }>
  compressionEvents: Array<{
    timestamp: string
    beforeTokens: number
    afterTokens: number
    compressionRatio: number
  }>
}

/** 压缩统计 */
export interface CompressionStats {
  avgCompressionRatio: number
  avgQualityScore: number
  totalCompressions: number
  recent: Array<{
    conversationId: string
    timestamp: string
    beforeTokens: number
    afterTokens: number
    compressionRatio: number
    qualityScore: number
  }>
}

/** 会话记忆 */
export interface SessionMemory {
  summary: string
  userPreferences: string[]
  recentFiles: string[]
  recentSymbols: string[]
}

/** track 请求体 */
export interface TrackVisualizationInput {
  conversationId: string
  totalTokens: number
  historyTokens: number
  codebaseTokens: number
  mentionTokens: number
  webTokens: number
  databaseTokens: number
}

/** 上下文源类型元数据(供 UI 选择器使用) */
export const CONTEXT_TYPE_OPTIONS: Array<{ value: ContextType; label: string; color: string; icon: string }> = [
  { value: 'file', label: '文件', color: 'bg-slate-100 text-slate-700', icon: 'File' },
  { value: 'folder', label: '目录', color: 'bg-slate-100 text-slate-700', icon: 'Folder' },
  { value: 'symbol', label: '符号', color: 'bg-indigo-100 text-indigo-700', icon: 'Code' },
  { value: 'database', label: '数据库', color: 'bg-emerald-100 text-emerald-700', icon: 'Database' },
  { value: 'web', label: '网页', color: 'bg-blue-100 text-blue-700', icon: 'Globe' },
]
