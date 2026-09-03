// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { fetchApi } from '@/lib/api'

/**
 * 长期记忆管理(Long-term Memory)前端 API 客户端(2026-09-03 立)。
 *
 * 服务端契约(apps/ai-service 的 routers/agent_memory.py,prefix="/longterm-memory",
 * main.py 以 prefix="/api" 挂载 → 最终 /api/longterm-memory/*):
 *  - GET   /api/longterm-memory/entries                    → 列表 + type/importance/q 过滤 + 分页
 *  - POST  /api/longterm-memory/entries                    → 手动新增一条记忆
 *  - DELETE /api/longterm-memory/entries/{memory_id}       → 删除本用户一条记忆
 *  - POST  /api/longterm-memory/entries/{memory_id}/important → 提升重要度(+1, 封顶 5)
 *  - POST  /api/longterm-memory/extract                    → 从会话消息抽取并批量导入
 *
 * 响应统一用 Envelope {code, message, data} 包装;鉴权失败(status=401)由调用方
 * 提示"请先登录"(get_current_user_id 依赖登录态)。
 */

/** 合法记忆类型(后端 MEMORY_TYPES) */
export const MEMORY_TYPES = [
  'user_preference',
  'project_convention',
  'lesson_learned',
  'resolved_issue',
  'goal',
] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

/** 类型 → 中文标签(与后端 TYPE_LABELS 对齐) */
export const MEMORY_TYPE_LABELS: Record<string, string> = {
  user_preference: '用户偏好',
  project_convention: '项目约定',
  lesson_learned: '踩坑教训',
  resolved_issue: '已解决问题',
  goal: '用户目标',
}

/** 单条长期记忆条目(与后端 LongTermMemory 条目字段对齐) */
export interface LongTermMemoryEntry {
  memory_id: string
  type: string
  content: string
  source_session_id: string
  keywords: string[]
  tags: string[]
  user_id: string
  importance: number
  created_at: string
  updated_at: string
  last_accessed_at: string
  access_count: number
}

/** GET /api/longterm-memory/entries 响应 data */
export interface LongTermMemoryListResult {
  total: number
  page: number
  page_size: number
  items: LongTermMemoryEntry[]
}

/** POST /api/longterm-memory/entries 请求体 */
export interface CreateMemoryPayload {
  type?: string
  content: string
  keywords?: string[]
  tags?: string[]
}

/** POST /api/longterm-memory/extract 响应 data */
export interface ExtractMemoryResult {
  imported: number
  candidates: Array<Record<string, unknown>>
  stats: { added: number; merged: number; skipped: number; total: number }
}

/** 拉取当前用户记忆列表(支持 type / importance_min 过滤)。失败抛错。 */
export async function fetchMemoryEntries(
  type = '',
  importanceMin = 0,
): Promise<LongTermMemoryListResult> {
  const qs = new URLSearchParams()
  if (type) qs.set('type', type)
  if (importanceMin > 0) qs.set('importance_min', String(importanceMin))
  qs.set('page', '1')
  qs.set('page_size', '100')
  const r = await fetchApi<LongTermMemoryListResult>(
    `/api/longterm-memory/entries?${qs.toString()}`,
  )
  if (!r.success) throw new Error(r.error || '加载长期记忆失败')
  return r.data
}

/** 新增一条记忆。失败抛错。 */
export async function createMemoryEntry(
  payload: CreateMemoryPayload,
): Promise<{ memory_id: string; entry: LongTermMemoryEntry }> {
  const r = await fetchApi<{ memory_id: string; entry: LongTermMemoryEntry }>(
    '/api/longterm-memory/entries',
    { method: 'POST', body: JSON.stringify(payload) },
  )
  if (!r.success) throw new Error(r.error || '新增记忆失败')
  return r.data
}

/** 删除一条记忆。失败抛错。 */
export async function deleteMemoryEntry(memoryId: string): Promise<void> {
  const r = await fetchApi<{ deleted: string }>(
    `/api/longterm-memory/entries/${encodeURIComponent(memoryId)}`,
    { method: 'DELETE' },
  )
  if (!r.success) throw new Error(r.error || '删除记忆失败')
}

/** 提升一条记忆的重要度(+1, 封顶 5)。返回更新后的条目。 */
export async function markMemoryImportant(memoryId: string): Promise<LongTermMemoryEntry> {
  const r = await fetchApi<LongTermMemoryEntry>(
    `/api/longterm-memory/entries/${encodeURIComponent(memoryId)}/important`,
    { method: 'POST' },
  )
  if (!r.success) throw new Error(r.error || '提升重要度失败')
  return r.data
}

/** 从会话消息抽取并批量导入长期记忆。返回 imported 计数。 */
export async function extractMemoryFromMessages(
  messages: Array<{ role: string; content: string }>,
): Promise<ExtractMemoryResult> {
  const r = await fetchApi<ExtractMemoryResult>('/api/longterm-memory/extract', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
  if (!r.success) throw new Error(r.error || '归纳本会话失败')
  return r.data
}
// ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠
