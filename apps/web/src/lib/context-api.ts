// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { apiOrThrow } from '@/lib/api'
import type {
  Mention,
  TableSchema,
  SymbolResult,
  EnrichInput,
  EnrichResult,
  ContextSource,
  VisualizationData,
  CompressionStats,
  SessionMemory,
  TrackVisualizationInput,
  ContextType,
  ContextEditorState,
} from '@ihui/shared/context/index'

export function fetchMentions(
  q: string,
  type: ContextType = 'file',
  limit = 20,
): Promise<{ mentions: Mention[]; total: number }> {
  const qs = new URLSearchParams({ q, type, limit: String(limit) })
  return apiOrThrow(`/api/context/mentions?${qs.toString()}`)
}

export function fetchDatabaseTables(
  q = '',
  limit = 50,
): Promise<{ mentions: Mention[]; total: number }> {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (q) qs.set('q', q)
  return apiOrThrow(`/api/context/database/tables?${qs.toString()}`)
}

export function fetchTableSchema(table: string): Promise<TableSchema> {
  return apiOrThrow(`/api/context/database/schema/${encodeURIComponent(table)}`)
}

export function fetchSymbols(
  q: string,
  limit = 20,
): Promise<{ symbols: SymbolResult[]; total: number }> {
  const qs = new URLSearchParams({ q, limit: String(limit) })
  return apiOrThrow(`/api/context/symbols?${qs.toString()}`)
}

/**
 * POST /api/context/enrich — 上下文增强(enrich)。
 *
 * input.editorState(2026-11-01 立,web→api→ai-service 上报腿)随整个入参
 * 一并序列化透传;apps/api 路由(zod 白名单)与服务层(camelCase→snake_case
 * 映射)逐字段接住后转发 ai-service editorState {active_file, cursor_line?,
 * selection?},与 normalize_editor_state 对齐,全链路不丢字段。
 */
export function enrichContext(input: EnrichInput): Promise<EnrichResult> {
  return apiOrThrow('/api/context/enrich', { method: 'POST', body: JSON.stringify(input) })
}

/**
 * 组装编辑器状态入参(2026-11-01 立,入参就绪腿)。
 *
 * 供调用 enrichContext 的会话发送链路用「当前活动文件 + 光标行 + 选中文本」
 * 构造 input.editorState。失效方向 = 丢弃:not-a-activeFile(缺失/空白)⇒
 * 返回 undefined ⇒ 整个 editorState 不发 —— 与 ai-service
 * normalize_editor_state 的丢弃语义同构;cursorLine 仅接受 ≥1 整数,
 * selection 仅接受非空白文本。
 */
export function buildEditorState(parts: {
  activeFile: string
  cursorLine?: number
  selection?: string
}): ContextEditorState | undefined {
  const activeFile = parts.activeFile?.trim() ?? ''
  if (!activeFile) return undefined
  const state: ContextEditorState = { activeFile }
  if (
    typeof parts.cursorLine === 'number' &&
    Number.isInteger(parts.cursorLine) &&
    parts.cursorLine >= 1
  ) {
    state.cursorLine = parts.cursorLine
  }
  if (parts.selection && parts.selection.trim()) {
    state.selection = parts.selection
  }
  return state
}

/** GET /sources 响应(含用户偏好合并后的源列表 + 默认预算) */
export interface ContextSourcesResult {
  sources: ContextSource[]
  defaultBudget: number
}

export function fetchSources(): Promise<ContextSourcesResult> {
  return apiOrThrow('/api/context/sources')
}

/** 持久化用户上下文源偏好(开关/预算,PUT /api/context/sources) */
export function updateSources(
  updates: Array<{ type: ContextType; enabled?: boolean; budgetPercent?: number }>,
): Promise<{ saved: number }> {
  return apiOrThrow('/api/context/sources', {
    method: 'PUT',
    body: JSON.stringify({ updates }),
  })
}

export function trackVisualization(input: TrackVisualizationInput): Promise<{ recorded: boolean }> {
  return apiOrThrow('/api/context/visualization/track', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchVisualization(conversationId = '', userId = ''): Promise<VisualizationData> {
  const qs = new URLSearchParams()
  if (conversationId) qs.set('conversationId', conversationId)
  if (userId) qs.set('userId', userId)
  return apiOrThrow(`/api/context/visualization${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function fetchCompressionStats(userId = ''): Promise<CompressionStats> {
  const qs = new URLSearchParams()
  if (userId) qs.set('userId', userId)
  return apiOrThrow(`/api/context/compression-stats${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function fetchSessionMemory(conversationId = '', userId = ''): Promise<SessionMemory> {
  const qs = new URLSearchParams()
  if (conversationId) qs.set('conversationId', conversationId)
  if (userId) qs.set('userId', userId)
  return apiOrThrow(`/api/context/memory${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function clearSessionMemory(conversationId: string): Promise<{ cleared: boolean }> {
  const qs = new URLSearchParams({ conversationId })
  return apiOrThrow(`/api/context/memory?${qs.toString()}`, { method: 'DELETE' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
