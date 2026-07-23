/**
 * 记忆系统跨端共享类型(2026-07-24 立,对标 TRAE Work Memory 长期记忆)。
 *
 * 契约对齐 apps/api/src/routes/memory.ts + packages/types/src/agent-runtime.ts:
 *  - GET /memory?scope=&sessionId=&projectKey=  → MemoryListResponse
 *  - POST /memory { scope, type, category, text, source, sessionId, projectKey } → MemoryEntry
 *  - DELETE /memory/:id?scope=&sessionId=&projectKey= → { id, deleted }
 *
 * 类型内联(不依赖 @ihui/types,避免 packages/shared 引入额外依赖),
 * 与 packages/types/src/agent-runtime.ts 的 MemoryEntry / MemoryScope / MemoryEntryType 保持结构一致。
 */

/** 记忆作用域 */
export type MemoryScope = 'global' | 'project' | 'session' | 'user'

/** 记忆条目类型 */
export type MemoryEntryType =
  | 'preference'
  | 'convention'
  | 'decision'
  | 'fact'
  | 'feedback'
  | 'skill_ref'

/** 记忆条目(对齐 packages/types MemoryEntry) */
export interface MemoryEntry {
  id: string
  scope: MemoryScope
  type: MemoryEntryType
  category: string
  text: string
  source: string
  createdAt: string
  updatedAt: string
}

/** 创建记忆条目请求体(对齐 API POST /memory) */
export interface MemoryCreateInput {
  scope: MemoryScope
  type: MemoryEntryType
  category: string
  text: string
  source?: string
  sessionId?: string
  projectKey?: string
}

/** 记忆列表查询参数(对齐 API GET /memory) */
export interface MemoryListQuery {
  scope?: MemoryScope
  sessionId?: string
  projectKey?: string
}

/** 记忆列表响应(对齐 API success({ entries, total })) */
export interface MemoryListResponse {
  entries: MemoryEntry[]
  total: number
}

/** 删除记忆条目查询参数(对齐 API DELETE /memory/:id) */
export interface MemoryDeleteQuery {
  scope?: MemoryScope
  sessionId?: string
  projectKey?: string
}

/** 删除响应 */
export interface MemoryDeleteResponse {
  id: string
  deleted: boolean
}

/** scope 选项元数据(供 web 端 selector 使用) */
export const MEMORY_SCOPE_OPTIONS: Array<{ value: MemoryScope; label: string; description: string }> = [
  { value: 'global', label: '全局', description: '跨项目/会话共享的全局偏好与决策' },
  { value: 'project', label: '项目', description: '当前项目下的约定与上下文' },
  { value: 'session', label: '会话', description: '当前会话内的临时记忆' },
  { value: 'user', label: '用户', description: '当前用户跨会话的偏好' },
]

/** type 选项元数据(供 web 端 selector 使用) */
export const MEMORY_TYPE_OPTIONS: Array<{ value: MemoryEntryType; label: string; color: string }> = [
  { value: 'preference', label: '偏好', color: 'bg-blue-100 text-blue-700' },
  { value: 'convention', label: '约定', color: 'bg-purple-100 text-purple-700' },
  { value: 'decision', label: '决策', color: 'bg-amber-100 text-amber-700' },
  { value: 'fact', label: '事实', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'feedback', label: '反馈', color: 'bg-rose-100 text-rose-700' },
  { value: 'skill_ref', label: '技能引用', color: 'bg-indigo-100 text-indigo-700' },
]
