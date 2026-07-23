/**
 * 记忆系统 API client(Web 端封装)。
 *
 * 对接后端 apps/api/src/routes/memory.ts:
 *  - GET    /api/memory?scope=&sessionId=&projectKey=  → { entries, total }
 *  - POST   /api/memory  body: MemoryCreateInput       → MemoryEntry
 *  - DELETE /api/memory/:id?scope=&sessionId=&projectKey= → { id, deleted }
 *
 * 类型契约:MemoryEntry / MemoryScope / MemoryEntryType 来自 @ihui/types(agent-runtime.ts)。
 * 以下 MemoryCreateInput / MemoryListQuery / MemoryListResponse / MemoryDeleteResponse
 * 及 MEMORY_SCOPE_OPTIONS / MEMORY_TYPE_OPTIONS 为 Web 端本地定义(对标 @ihui/shared/memory 契约),
 * 后续主 agent 统一抽取到共享包后可直接替换 import 路径。
 */
import { fetchApi } from '@/lib/api'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'

// === 请求 / 响应类型 ===

export interface MemoryListQuery {
  scope?: MemoryScope
  sessionId?: string
  projectKey?: string
}

export interface MemoryListResponse {
  entries: MemoryEntry[]
  total: number
}

export interface MemoryCreateInput {
  scope: MemoryScope
  type: MemoryEntryType
  category: string
  text: string
  source?: string
  sessionId?: string
  projectKey?: string
}

export interface MemoryDeleteResponse {
  id: string
  deleted: boolean
}

// === UI 常量 ===

export const MEMORY_SCOPE_OPTIONS = [
  { value: 'global', label: '全局', desc: '所有项目共享' },
  { value: 'project', label: '项目', desc: '当前项目范围' },
  { value: 'session', label: '会话', desc: '当前会话范围' },
  { value: 'user', label: '用户', desc: '用户级别偏好' },
] as const

export const MEMORY_TYPE_OPTIONS = [
  { value: 'preference', label: '偏好', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { value: 'convention', label: '约定', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  { value: 'decision', label: '决策', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { value: 'fact', label: '事实', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { value: 'feedback', label: '反馈', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  { value: 'skill_ref', label: '技能引用', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
] as const

// === 工具函数 ===

const memoryTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatMemoryTime(iso: string): string {
  try {
    return memoryTimeFormatter.format(new Date(iso))
  } catch {
    return iso
  }
}

export function getMemoryTypeOption(type: MemoryEntryType) {
  return MEMORY_TYPE_OPTIONS.find((o) => o.value === type)
}

export function getMemoryScopeOption(scope: MemoryScope) {
  return MEMORY_SCOPE_OPTIONS.find((o) => o.value === scope)
}

// === API 调用 ===

export async function fetchMemory(query: MemoryListQuery = {}): Promise<MemoryListResponse> {
  const qs = new URLSearchParams()
  if (query.scope) qs.set('scope', query.scope)
  if (query.sessionId) qs.set('sessionId', query.sessionId)
  if (query.projectKey) qs.set('projectKey', query.projectKey)
  const r = await fetchApi<MemoryListResponse>(
    `/api/memory${qs.toString() ? `?${qs.toString()}` : ''}`,
  )
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function createMemory(input: MemoryCreateInput): Promise<MemoryEntry> {
  const r = await fetchApi<MemoryEntry>('/api/memory', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function deleteMemory(
  id: string,
  query: MemoryListQuery = {},
): Promise<MemoryDeleteResponse> {
  const qs = new URLSearchParams()
  if (query.scope) qs.set('scope', query.scope)
  if (query.sessionId) qs.set('sessionId', query.sessionId)
  if (query.projectKey) qs.set('projectKey', query.projectKey)
  const r = await fetchApi<MemoryDeleteResponse>(
    `/api/memory/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`,
    { method: 'DELETE' },
  )
  if (!r.success) throw new Error(r.error)
  return r.data
}
