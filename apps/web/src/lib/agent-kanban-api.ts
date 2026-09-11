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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
