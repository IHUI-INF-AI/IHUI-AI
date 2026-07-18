import { fetchApi, getToken, normalizeUrlPublic } from '../client.js'

/** 智能体角色配置 */
export interface CrewAgentRole {
  role: string
  goal: string
  backstory: string
  llmModelId: string
  tools: string[]
  allowDelegation: boolean
  verbose: boolean
}

/** 会话配置 */
export interface CrewSessionConfig {
  modelId?: string
  collectionName?: string
  maxRetries?: number
}

/** 会话详情 */
export interface CrewSessionDetail {
  id: string
  userId: string
  title: string
  status: string
  inputMessage: string
  outputMessage: string | null
  createdAt: string | null
  completedAt: string | null
}

/** 会话任务 */
export interface CrewTaskItem {
  id: string
  taskIndex: number
  agentRole: string
  description: string
  status: string
  outputData: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}

/** 会话消息 */
export interface CrewMessageItem {
  id: string
  fromRole: string
  toRole: string
  content: string
  messageType: string
  createdAt: string | null
}

/** 运行产物 */
export interface CrewArtifactItem {
  id: string
  name: string
  type: string
  content: string
  createdAt: string | null
}

/** 流式事件 */
export interface CrewStreamEvent {
  type:
    | 'start'
    | 'planning'
    | 'plan'
    | 'task_start'
    | 'task_complete'
    | 'task_error'
    | 'complete'
    | 'error'
  content?: string
  sessionId?: string
  role?: string
  taskIndex?: number
  tasks?: Array<{ role: string; description: string }>
}

/** 健康检查 */
export async function checkCrewHealth(): Promise<{ status: string; service: string }> {
  const res = await fetchApi<{ status: string; service: string }>('/api/crew/health')
  if (!res.success) throw new Error(res.error || 'Crew 健康检查失败')
  return res.data
}

/** 角色列表 */
export async function listCrewAgents(): Promise<CrewAgentRole[]> {
  const res = await fetchApi<CrewAgentRole[]>('/api/crew/agents')
  if (!res.success) throw new Error(res.error || '查询角色失败')
  return res.data
}

/** 创建会话 */
export async function createCrewSession(opts: {
  userId: string
  inputMessage: string
  title?: string
  config?: CrewSessionConfig
}): Promise<{ sessionId: string }> {
  const res = await fetchApi<{ sessionId: string }>('/api/crew/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.success) throw new Error(res.error || '创建会话失败')
  return res.data
}

/** 会话列表 */
export async function listCrewSessions(
  userId?: string,
  limit?: number,
): Promise<CrewSessionDetail[]> {
  const q = new URLSearchParams()
  if (userId) q.append('userId', userId)
  if (limit !== undefined) q.append('limit', String(limit))
  const qs = q.toString()
  const url = qs ? `/api/crew/sessions?${qs}` : '/api/crew/sessions'
  const res = await fetchApi<CrewSessionDetail[]>(url)
  if (!res.success) throw new Error(res.error || '查询会话列表失败')
  return res.data
}

/** 会话详情 */
export async function getCrewSession(id: string): Promise<CrewSessionDetail> {
  const res = await fetchApi<CrewSessionDetail>(`/api/crew/sessions/${id}`)
  if (!res.success) throw new Error(res.error || '查询会话失败')
  return res.data
}

/** 会话任务列表 */
export async function listCrewSessionTasks(id: string): Promise<CrewTaskItem[]> {
  const res = await fetchApi<CrewTaskItem[]>(`/api/crew/sessions/${id}/tasks`)
  if (!res.success) throw new Error(res.error || '查询任务失败')
  return res.data
}

/** 会话消息日志 */
export async function listCrewSessionMessages(id: string): Promise<CrewMessageItem[]> {
  const res = await fetchApi<CrewMessageItem[]>(`/api/crew/sessions/${id}/messages`)
  if (!res.success) throw new Error(res.error || '查询消息失败')
  return res.data
}

/** 触发同步执行 */
export async function runCrewSession(id: string): Promise<{ runId: string; result: string }> {
  const res = await fetchApi<{ runId: string; result: string }>(`/api/crew/sessions/${id}/runs`, {
    method: 'POST',
  })
  if (!res.success) throw new Error(res.error || '执行失败')
  return res.data
}

/** 获取运行状态 */
export async function getCrewRun(
  id: string,
): Promise<{ runId: string; status: string; session: CrewSessionDetail }> {
  const res = await fetchApi<{ runId: string; status: string; session: CrewSessionDetail }>(
    `/api/crew/runs/${id}`,
  )
  if (!res.success) throw new Error(res.error || '查询运行失败')
  return res.data
}

/**
 * 流式执行 (SSE)
 * 返回 ReadableStream,调用方需自行解析 SSE 事件。
 * 浏览器端可直接用 EventSource,但本端点需鉴权,建议用 fetch + ReadableStream。
 */
export async function streamCrewRun(id: string): Promise<ReadableStream<Uint8Array> | null> {
  // fetchApi 包装器对非 JSON 响应不友好,这里直接用原生 fetch + 共享 token
  const token = getToken()
  const url = normalizeUrlPublic(`/crew/runs/${id}/stream`)
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error(`SSE 启动失败: ${resp.status}`)
  return resp.body
}

/** 运行产物列表 */
export async function listCrewRunArtifacts(id: string): Promise<CrewArtifactItem[]> {
  const res = await fetchApi<CrewArtifactItem[]>(`/api/crew/runs/${id}/artifacts`)
  if (!res.success) throw new Error(res.error || '查询产物失败')
  return res.data
}

/** 手动添加产物 */
export async function addCrewRunArtifact(opts: {
  runId: string
  name: string
  type?: string
  content: string
  metadata?: Record<string, unknown>
}): Promise<{ saved: boolean }> {
  const { runId, ...body } = opts
  const res = await fetchApi<{ saved: boolean }>(`/api/crew/runs/${runId}/artifacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.success) throw new Error(res.error || '保存产物失败')
  return res.data
}
