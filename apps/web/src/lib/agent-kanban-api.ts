// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type {
  KanbanColumn,
  KanbanTask,
  KanbanTransitionRequest,
  KanbanTransitionResponse,
  AgentTaskStatus,
} from '@ihui/types'

const BASE = '/api/agents/kanban'

/** 携带 HTTP 状态码的错误(供 409 锁冲突等场景区分错误类型) */
export type KanbanApiError = Error & { status?: number }

function toKanbanError(message: string, status?: number): KanbanApiError {
  return Object.assign(new Error(message), { status })
}

export async function fetchKanbanColumns(): Promise<KanbanColumn[]> {
  // 2026-09-10 根因修复:GET /agents/kanban 的 data 即 KanbanColumn[] 数组
  // (api 侧 reply.send(success(columns))),此前读 res.data.columns 恒为 undefined,
  // 导致看板默认视图 React Query "Query data cannot be undefined" 挂死
  const res = await fetchApi<KanbanColumn[]>(`${BASE}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function fetchKanbanTasks(
  status?: AgentTaskStatus,
  teamId?: string,
): Promise<KanbanTask[]> {
  // teamId 过滤(2-2 团队任务板):后端 GET /tasks?teamId= 已支持
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (teamId) params.set('teamId', teamId)
  const qs = params.toString()
  const url = qs ? `${BASE}/tasks?${qs}` : `${BASE}/tasks`
  // 2026-09-11 根因修复:GET /tasks 的 data 即 KanbanTask[] 数组(api 侧 success(rows.map(toKanbanTask))),
  // 此前读 res.data.tasks 恒为 undefined,team 过滤视图 tasks.filter 直接抛 TypeError
  const res = await fetchApi<KanbanTask[]>(url)
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}

export interface CreateKanbanTaskInput {
  name: string
  description?: string
  priority?: number
  agentId: string
  payload?: Record<string, unknown>
  dependencies?: string[]
  /** 工作区路径(2-2):进入 in_progress 时据此抢工作区锁 */
  workspacePath?: string
  /** 归属团队(2-2 团队任务板) */
  teamId?: string
}

export async function createKanbanTask(input: CreateKanbanTaskInput): Promise<KanbanTask> {
  // data 即 task 对象(api 侧 reply.status(201).send(success(task))),无 {task} 包装
  const res = await fetchApi<KanbanTask>(`${BASE}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function transitionKanbanTask(
  taskId: string,
  toStatus: AgentTaskStatus,
  reason?: string,
): Promise<KanbanTransitionResponse> {
  const body: KanbanTransitionRequest = {
    taskId,
    toStatus,
    reason,
  }
  // 2026-09-11 根因修复:transition 端点 data 即 KanbanTransitionResponse(api 侧 success(response)),
  // 无 {transition} 包装。此前读 res.data.transition 恒为 undefined → result.allowed 抛 TypeError →
  // 弹错误 toast 且 onTaskChanged 不执行 → "DB 已流转但前端不刷新"
  const res = await fetchApi<KanbanTransitionResponse>(
    `${BASE}/tasks/${encodeURIComponent(taskId)}/transition`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  // 409 = 工作区锁冲突/非法流转,携带状态码供 UI 区分提示
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}

export async function deleteKanbanTask(taskId: string): Promise<void> {
  const res = await fetchApi<unknown>(`${BASE}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  })
  if (!res.success) throw new Error(res.error)
}

/** SSE 流地址(带 token query 参数,因 EventSource 不支持自定义 header) */
export function getKanbanStreamUrl(): string {
  const token = useAuthStore.getState().token
  const params = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${BASE}/tasks/stream${params}`
}

// ---------------------------------------------------------------------------
// 2-2 工作区锁 / 团队任务板 前端 API
// ---------------------------------------------------------------------------

/** 工作区锁信息(GET /agents/kanban/workspace-lock) */
export interface WorkspaceLockInfo {
  workspace: string
  held: boolean
  holder?: string
  acquiredAt?: string
  heartbeatAt?: string
  /** 锁 TTL(秒) */
  ttl: number
}

/** 查询指定工作区的锁持有者(锁徽标数据源) */
export async function fetchWorkspaceLock(workspace: string): Promise<WorkspaceLockInfo> {
  const res = await fetchApi<WorkspaceLockInfo>(
    `${BASE}/workspace-lock?workspace=${encodeURIComponent(workspace)}`,
  )
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}

/** 团队下拉选项(GET /teams 返回的用户团队) */
export interface KanbanTeamOption {
  id: string
  name: string
  slug: string
}

/** 当前用户的团队列表(团队任务板过滤下拉数据源) */
export async function fetchMyTeams(): Promise<KanbanTeamOption[]> {
  const res = await fetchApi<{ teams: KanbanTeamOption[] }>('/api/teams')
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data.teams
}

// ---------------------------------------------------------------------------
// D25 统一任务运行时看板:任务改名 / 跨任务消息(@ 任务引用)
// ---------------------------------------------------------------------------

/** 任务改名/改描述输入(PATCH /agents/kanban/tasks/:id,requireAdmin,至少一项) */
export interface RenameKanbanTaskInput {
  name?: string
  description?: string
}

/**
 * 改名/改描述任务(PATCH /agents/kanban/tasks/:id)。
 * 注意:后端 PATCH 不广播 SSE(无 task_updated 事件),调用方成功后须手动
 * invalidate ['agents-kanban'] 查询缓存。
 */
export async function renameKanbanTask(
  taskId: string,
  input: RenameKanbanTaskInput,
): Promise<KanbanTask> {
  // data 即更新后的 KanbanTask(api 侧 reply.send(success(toKanbanTask(updated))))
  const res = await fetchApi<KanbanTask>(`${BASE}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}

/** 任务消息中的 @ 任务引用(与 api 侧 mentionSchema / db TaskMention 对齐) */
export interface TaskMessageMention {
  type: 'task'
  taskId: string
  name?: string
}

/** 任务消息行(GET/POST /task-messages 行形状,与 task_messages 表一致) */
export interface TaskMessageRow {
  id: string
  taskId: string
  /** user(用户手输) | agent(编排侧注入) | system(状态迁移留痕) */
  fromType: string
  fromId: string | null
  content: string
  mentions: TaskMessageMention[]
  createdBy: string | null
  /** ISO 时间戳(Fastify JSON 序列化后为字符串) */
  createdAt: string
}

/** 任务消息时间线分页结果(messages 已按旧→新排序) */
export interface TaskMessagePage {
  taskId: string
  messages: TaskMessageRow[]
  hasMore: boolean
}

/** 拉取任务消息时间线(旧→新,limit 1-200 默认 50) */
export async function listTaskMessages(
  taskId: string,
  limit = 50,
  offset = 0,
): Promise<TaskMessagePage> {
  const params = new URLSearchParams({ taskId, limit: String(limit), offset: String(offset) })
  const res = await fetchApi<TaskMessagePage>(`/api/task-messages?${params.toString()}`)
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}

/** 发送任务消息(fromType=user;@ 引用 ≤20,引用不存在 → 400) */
export async function sendTaskMessage(input: {
  taskId: string
  content: string
  mentions?: TaskMessageMention[]
}): Promise<TaskMessageRow> {
  const res = await fetchApi<TaskMessageRow>('/api/task-messages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw toKanbanError(res.error, res.status)
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
