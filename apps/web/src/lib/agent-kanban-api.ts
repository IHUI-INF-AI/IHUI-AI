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

export async function fetchKanbanColumns(): Promise<KanbanColumn[]> {
  const res = await fetchApi<{ columns: KanbanColumn[] }>(`${BASE}`)
  if (!res.success) throw new Error(res.error)
  return res.data.columns
}

export async function fetchKanbanTasks(status?: AgentTaskStatus): Promise<KanbanTask[]> {
  const url = status ? `${BASE}/tasks?status=${status}` : `${BASE}/tasks`
  const res = await fetchApi<{ tasks: KanbanTask[] }>(url)
  if (!res.success) throw new Error(res.error)
  return res.data.tasks
}

export async function fetchKanbanTask(id: string): Promise<KanbanTask> {
  const res = await fetchApi<{ task: KanbanTask }>(`${BASE}/tasks/${encodeURIComponent(id)}`)
  if (!res.success) throw new Error(res.error)
  return res.data.task
}

export interface CreateKanbanTaskInput {
  name: string
  description?: string
  priority?: number
  agentId: string
  payload?: Record<string, unknown>
  dependencies?: string[]
}

export async function createKanbanTask(input: CreateKanbanTaskInput): Promise<KanbanTask> {
  const res = await fetchApi<{ task: KanbanTask }>(`${BASE}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.task
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
  const res = await fetchApi<{ transition: KanbanTransitionResponse }>(
    `${BASE}/tasks/${encodeURIComponent(taskId)}/transition`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  if (!res.success) throw new Error(res.error)
  return res.data.transition
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
