// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入端点 (D28, 2026-09-20)
 *
 * 对应 api 侧 /api/user/conversation-import/* 三端点:
 *   1. POST /parse    multipart 上传会话导出文件,api 转发 ai-service 解析后原样透传
 *   2. POST /commit   逐会话落库(一个会话一次调用),201 返回 {importId, conversationId, importedMessages}
 *   3. GET  /history  当前用户导入历史(服务端固定 limit 50,按导入时间倒序)
 *
 * 注意: /parse 的响应是 ai-service 裸 JSON(无 {code:0} 包装),
 * fetchApi 对 code === undefined 的响应整体作为 data 返回,与本地类型直接对应。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// =============================================================================
// Types
// =============================================================================

/** 外部工具来源枚举(与 api z.enum 一致) */
export type ConversationImportSource = 'claude_code' | 'codex' | 'cursor' | 'aider'

/** 单条待导入消息(commit 请求体;与 api importedMessageSchema 一致) */
export interface ConversationImportMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  createdAt?: string
  tokens?: number
}

/** POST /commit 请求体(与 api commitSchema 一致) */
export interface ConversationImportCommitPayload {
  source: ConversationImportSource
  fileName?: string
  title?: string
  model?: string
  createdAt?: string
  messages: ConversationImportMessage[]
}

/** POST /commit 201 响应 data */
export interface ConversationImportCommitResult {
  importId: string
  conversationId: string
  importedMessages: number
}

/** /parse 解析出的单条会话(ai-service 裸 JSON;字段可能缺省,UI 侧需兜底) */
export interface ParsedImportConversation {
  title?: string
  source?: ConversationImportSource
  /** 原会话使用的模型(ai-service 从导出元数据提取,缺省则落库用默认模型) */
  model?: string
  sourceCreatedAt?: string
  sourceUpdatedAt?: string
  messages: Array<{
    // system 由 ai-service 产出(Codex rollout 的 compacted 压缩摘要按 system 落地)
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt?: string
  }>
}

/** POST /parse 响应 data(ai-service 原样透传的裸 JSON) */
export interface ConversationImportParseResult {
  conversations: ParsedImportConversation[]
  truncated: boolean
  warnings: string[]
}

/** GET /history 单条批次记录 */
export interface ConversationImportHistoryItem {
  id: string
  source: ConversationImportSource
  conversationId: string
  fileName: string | null
  parsedCount: number
  importedCount: number
  failedCount: number
  status: string
  errorMessage: string | null
  importedAt: string
}

/** GET /history 响应 data */
export interface ConversationImportHistoryResult {
  list: ConversationImportHistoryItem[]
  total: number
}

// =============================================================================
// Endpoints
// =============================================================================

/** 上传会话导出文件,转发 ai-service 解析(multipart: source 字段 + file 文件) */
export async function parseConversationImport(
  file: File,
  source: ConversationImportSource,
): Promise<ApiResult<ConversationImportParseResult>> {
  const formData = new FormData()
  formData.append('source', source)
  formData.append('file', file)
  return fetchApi<ConversationImportParseResult>('/api/user/conversation-import/parse', {
    method: 'POST',
    body: formData,
  })
}

/** 提交单个解析后的会话落库(JSON body,fetchApi 自动带 application/json) */
export async function commitConversationImport(
  payload: ConversationImportCommitPayload,
): Promise<ApiResult<ConversationImportCommitResult>> {
  return fetchApi<ConversationImportCommitResult>('/api/user/conversation-import/commit', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 获取当前用户导入历史(服务端固定 limit 50,按导入时间倒序) */
export async function getConversationImportHistory(): Promise<
  ApiResult<ConversationImportHistoryResult>
> {
  return fetchApi<ConversationImportHistoryResult>('/api/user/conversation-import/history', {
    method: 'GET',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
