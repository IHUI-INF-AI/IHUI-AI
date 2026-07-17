import { fetchApi } from '../client.js'
import type {
  PermissionMode,
  PermissionDecision,
  DangerLevel,
  SessionStatus,
  SessionState,
} from '@ihui/types'

// ============================================================================
// 本地类型定义(后续可由主线程统一抽取到 packages/types 共享层)
// ============================================================================

// ---- Agent 执行 ----

export interface AgentExecuteRequest {
  goal: string
  session_id?: string
  model?: string
  max_iterations?: number
  tools?: string[]
}

export interface AgentExecuteStep {
  iteration?: number
  type: string
  content: string
  stub?: boolean
  step?: number
  plan?: string
  result?: string
}

export interface AgentExecuteResult {
  task_id: string
  session_id: string
  status: string
  iterations: number
  steps: AgentExecuteStep[]
  result: string
  error?: string | null
}

export interface AgentTaskStatus {
  task_id: string
  session_id?: string
  goal?: string
  status: string
  iterations?: number
  steps?: AgentExecuteStep[]
  error?: string
  created_at?: string
  updated_at?: string
  started_at?: string
  message?: string
}

export interface AgentCancelResult {
  task_id: string
  canceled: boolean
  status: string
}

export interface AgentSessionMessage {
  role: string
  content: string
  [key: string]: unknown
}

export interface AgentSession {
  session_id: string
  messages: AgentSessionMessage[]
  count: number
}

export interface AgentSessionList {
  sessions: string[]
  count: number
}

export interface AgentResumeResult {
  session_id: string
  resumed: boolean
}

// ---- SSE 流式事件 ----

export interface AgentStreamEvent {
  type: string
  task_id?: string
  session_id?: string
  role?: string
  content?: string
  message?: string
  status?: string
  steps?: string[]
  step?: number
  total?: number
  plan?: string
  result?: string
  usage?: Record<string, unknown>
  trace?: unknown[]
  total_nodes?: number
  total_duration_ms?: number
  node?: string
  duration_ms?: number
  resume_from?: string | null
  stub?: boolean
  [key: string]: unknown
}

export interface PermissionRequest {
  tool_name: string
  args: Record<string, unknown>
  request_id: string
}

export interface PlanProposal {
  steps: string[]
  rationale?: string
}

export interface ToolCallInfo {
  name: string
  args: Record<string, unknown>
}

export interface AgentStreamCallbacks {
  onDelta?: (delta: string) => void
  onToolCall?: (toolCall: ToolCallInfo) => void
  onPermissionRequest?: (req: PermissionRequest) => void
  onPlanProposed?: (plan: PlanProposal) => void
  onDone?: (event: AgentStreamEvent) => void
  onError?: (error: string) => void
  onEvent?: (event: AgentStreamEvent) => void
}

export interface AgentStreamOptions {
  signal?: AbortSignal
  lastEventId?: string
  baseUrl?: string
  headers?: Record<string, string>
}

// ---- A2A ----

export interface A2AAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  endpoint: string
  [key: string]: unknown
}

export interface A2AAgentList {
  agents: A2AAgent[]
  count: number
}

export interface A2ARegisterAgentRequest {
  id: string
  name: string
  description?: string
  capabilities?: string[]
  endpoint?: string
}

export interface A2ASendTaskRequest {
  name: string
  description?: string
  input?: Record<string, unknown>
  assigned_agent_id?: string
}

export interface A2ATask {
  id: string
  name: string
  description?: string
  input?: Record<string, unknown>
  output?: unknown
  assigned_agent_id?: string
  status: string
  [key: string]: unknown
}

export interface A2ATaskStatus {
  task_id: string
  status: string
  [key: string]: unknown
}

export interface A2ATaskResult {
  task_id: string
  result: unknown
  status: string
  [key: string]: unknown
}

// ---- MCP ----

export interface McpTool {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  [key: string]: unknown
}

export interface McpToolList {
  tools: McpTool[]
  count: number
}

export interface McpToolCallResult {
  [key: string]: unknown
}

export interface McpSkill {
  name: string
  description: string
  prompt_template: string
}

export interface McpSkillList {
  skills: McpSkill[]
  count: number
}

export interface SlashCommandInfo {
  name: string
  description: string
}

export interface SlashCommandList {
  commands: SlashCommandInfo[]
  count: number
}

export interface SlashCommandResult {
  command: string
  output: string
}

export interface SkillExecuteResult {
  name: string
  result: unknown
}

// ============================================================================
// Agent 执行端点(对应 AI-Service /agents/*)
// ============================================================================

export async function executeAgent(params: AgentExecuteRequest) {
  return fetchApi<AgentExecuteResult>('/agents/execute', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getAgentStatus(taskId: string) {
  return fetchApi<AgentTaskStatus>(`/agents/${encodeURIComponent(taskId)}/status`)
}

export async function cancelAgent(taskId: string) {
  return fetchApi<AgentCancelResult>(
    `/agents/${encodeURIComponent(taskId)}/cancel`,
    { method: 'POST' },
  )
}

export async function listAgentSessions() {
  return fetchApi<AgentSessionList>('/agents/sessions')
}

export async function getAgentSession(sessionId: string) {
  return fetchApi<AgentSession>(
    `/agents/sessions/${encodeURIComponent(sessionId)}/messages`,
  )
}

export async function resumeAgentSession(sessionId: string) {
  return fetchApi<AgentResumeResult>(
    `/agents/sessions/${encodeURIComponent(sessionId)}/resume`,
    { method: 'POST' },
  )
}

// ============================================================================
// A2A 端点(对应 AI-Service /a2a/*)
// ============================================================================

export async function sendA2ATask(params: A2ASendTaskRequest) {
  return fetchApi<A2ATask>('/a2a/tasks', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getA2ATaskStatus(taskId: string) {
  return fetchApi<A2ATaskStatus>(
    `/a2a/tasks/${encodeURIComponent(taskId)}/status`,
  )
}

export async function getA2ATaskResult(taskId: string) {
  return fetchApi<A2ATaskResult>(
    `/a2a/tasks/${encodeURIComponent(taskId)}/result`,
  )
}

export async function listA2AAgents() {
  return fetchApi<A2AAgentList>('/a2a/agents')
}

export async function registerA2AAgent(params: A2ARegisterAgentRequest) {
  return fetchApi<A2AAgent>('/a2a/agents/register', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ============================================================================
// MCP 端点(对应 AI-Service /mcp/*)
// ============================================================================

export async function listMCPTools() {
  return fetchApi<McpToolList>('/mcp/tools')
}

export async function callMCPTool(name: string, args: Record<string, unknown> = {}) {
  return fetchApi<McpToolCallResult>('/mcp/tools/call', {
    method: 'POST',
    body: JSON.stringify({ name, arguments: args }),
  })
}

export async function listMCPSkills() {
  return fetchApi<McpSkillList>('/mcp/skills')
}

export async function listSlashCommands() {
  return fetchApi<SlashCommandList>('/mcp/slash-commands')
}

export async function executeSlashCommand(command: string, args: string[] = []) {
  return fetchApi<SlashCommandResult>('/mcp/slash-commands', {
    method: 'POST',
    body: JSON.stringify({ command, args, ctx: {} }),
  })
}

// ============================================================================
// Skills 端点(对应 AI-Service /mcp/skills)
// ============================================================================

export async function listSkills() {
  return fetchApi<McpSkillList>('/mcp/skills')
}

export async function getSkill(name: string) {
  return fetchApi<McpSkill>(`/mcp/skills/${encodeURIComponent(name)}`)
}

export async function executeSkill(name: string, params: Record<string, unknown> = {}) {
  return fetchApi<SkillExecuteResult>(
    `/mcp/skills/${encodeURIComponent(name)}/execute`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

// ============================================================================
// SSE 流式执行(对应 AI-Service /agents/execute/stream)
// 因 client.ts 未导出 SSE 通用封装,此处使用 fetch 直连 + 显式 options。
// 多端调用方需通过 options.headers 传入 Authorization、options.baseUrl 传入网关地址。
// ============================================================================

function buildStreamUrl(path: string, baseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/api/')
    ? path
    : path.startsWith('/')
      ? `/api${path}`
      : `/api/${path}`
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${normalized}` : normalized
}

function dispatchSSEEvent(event: AgentStreamEvent, callbacks: AgentStreamCallbacks): void {
  callbacks.onEvent?.(event)
  const type = event.type
  switch (type) {
    case 'message':
      if (event.role === 'assistant' && typeof event.content === 'string') {
        callbacks.onDelta?.(event.content)
      }
      break
    case 'summary':
      if (typeof event.content === 'string') {
        callbacks.onDelta?.(event.content)
      }
      break
    case 'plan':
      callbacks.onPlanProposed?.({
        steps: Array.isArray(event.steps) ? event.steps.map(String) : [],
      })
      break
    case 'tool_call':
      callbacks.onToolCall?.({
        name: typeof event.name === 'string' ? event.name : String(event.name ?? ''),
        args: (event.args as Record<string, unknown>) ?? {},
      })
      break
    case 'permission_request':
      callbacks.onPermissionRequest?.({
        tool_name: typeof event.tool_name === 'string' ? event.tool_name : '',
        args: (event.args as Record<string, unknown>) ?? {},
        request_id: typeof event.request_id === 'string' ? event.request_id : '',
      })
      break
    case 'done':
      callbacks.onDone?.(event)
      break
    case 'error':
      callbacks.onError?.(event.message || '未知错误')
      break
    default:
      // thinking / status / step_start / step_done / usage / trace / trace_summary / start
      // 由 onEvent 兜底处理
      break
  }
}

function parseSSEBlock(block: string, callbacks: AgentStreamCallbacks): void {
  let dataStr = ''
  let eventType: string | undefined
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataStr += line.slice(5).replace(/^\s/, '')
    }
  }
  if (!dataStr) return
  let event: AgentStreamEvent
  try {
    event = JSON.parse(dataStr) as AgentStreamEvent
  } catch {
    return
  }
  if (!event.type) event.type = eventType || 'message'
  dispatchSSEEvent(event, callbacks)
}

export async function executeAgentStream(
  params: AgentExecuteRequest,
  callbacks: AgentStreamCallbacks,
  options: AgentStreamOptions = {},
): Promise<void> {
  const url = buildStreamUrl('/agents/execute/stream', options.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(options.headers ?? {}),
  }
  if (options.lastEventId) headers['Last-Event-ID'] = options.lastEventId

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: options.signal,
    })

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      callbacks.onError?.(text || `请求失败(${resp.status})`)
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (block.trim()) parseSSEBlock(block, callbacks)
      }
    }
    if (buffer.trim()) parseSSEBlock(buffer, callbacks)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone?.({ type: 'done' })
      return
    }
    const message = err instanceof Error ? err.message : '网络异常'
    callbacks.onError?.(message)
  }
}

// ============================================================================
// /agent-runtime/* 新路径(第十五轮 API + AI-Service 同步暴露)
// 与上方 /agents/* 旧路径并存,前端各端逐步切换至本组函数。
// ============================================================================

export interface ExecuteAgentRuntimeParams {
  message: string
  mode?: PermissionMode | string
  sessionId?: string
  botId?: string
}

export interface ExecuteAgentRuntimeResult {
  sessionId: string
  mode: string
  received: string
}

export async function executeAgentRuntime(
  params: ExecuteAgentRuntimeParams,
): Promise<ExecuteAgentRuntimeResult> {
  const res = await fetchApi<ExecuteAgentRuntimeResult>('/agent-runtime/execute', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

export interface AgentRuntimeStreamCallbacks {
  onSession?: (data: { sessionId: string }) => void
  onPermission?: (data: {
    mode: string
    toolName?: string
    dangerLevel?: DangerLevel | string
    decision: PermissionDecision | string
  }) => void
  onPlan?: (data: { plan: string }) => void
  onDelta?: (data: { content: string }) => void
  onDone?: (data: { sessionId: string; status: string; summary?: string }) => void
  onError?: (data: { message: string }) => void
  onEvent?: (event: string, data: unknown) => void
}

export interface AgentRuntimeStreamOptions {
  lastEventId?: string
  signal?: AbortSignal
  baseUrl?: string
  headers?: Record<string, string>
}

function parseAgentRuntimeSSEBlock(
  block: string,
  callbacks: AgentRuntimeStreamCallbacks,
): void {
  let eventName: string | undefined
  let dataStr = ''
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataStr += line.slice(5).replace(/^\s/, '')
    }
  }
  if (!eventName || !dataStr) return
  let data: unknown
  try {
    data = JSON.parse(dataStr)
  } catch {
    data = dataStr
  }
  callbacks.onEvent?.(eventName, data)
  switch (eventName) {
    case 'session':
      callbacks.onSession?.(data as { sessionId: string })
      break
    case 'permission':
      callbacks.onPermission?.(
        data as {
          mode: string
          toolName?: string
          dangerLevel?: string
          decision: string
        },
      )
      break
    case 'plan':
      callbacks.onPlan?.(data as { plan: string })
      break
    case 'delta':
      callbacks.onDelta?.(data as { content: string })
      break
    case 'done':
      callbacks.onDone?.(data as { sessionId: string; status: string; summary?: string })
      break
    case 'error':
      callbacks.onError?.(data as { message: string })
      break
  }
}

export async function executeAgentRuntimeStream(
  params: ExecuteAgentRuntimeParams,
  callbacks: AgentRuntimeStreamCallbacks,
  options: AgentRuntimeStreamOptions = {},
): Promise<void> {
  const url = buildStreamUrl('/agent-runtime/execute/stream', options.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(options.headers ?? {}),
  }
  if (options.lastEventId) headers['Last-Event-ID'] = options.lastEventId

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: options.signal,
    })

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      callbacks.onError?.({ message: text || `请求失败(${resp.status})` })
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (block.trim()) parseAgentRuntimeSSEBlock(block, callbacks)
      }
    }
    if (buffer.trim()) parseAgentRuntimeSSEBlock(buffer, callbacks)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone?.({ sessionId: '', status: 'aborted' })
      return
    }
    const message = err instanceof Error ? err.message : '网络异常'
    callbacks.onError?.({ message })
  }
}

export async function listAgentRuntimeSessions(
  params?: { limit?: number; offset?: number },
): Promise<{ sessions: SessionState[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString()
  const url = query ? `/agent-runtime/sessions?${query}` : '/agent-runtime/sessions'
  const res = await fetchApi<{ sessions: SessionState[]; total: number }>(url)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function getAgentRuntimeSession(sessionId: string): Promise<SessionState> {
  const res = await fetchApi<SessionState>(
    `/agent-runtime/sessions/${encodeURIComponent(sessionId)}`,
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function resumeAgentRuntimeSession(
  sessionId: string,
): Promise<{ sessionId: string; status: string }> {
  const res = await fetchApi<{ sessionId: string; status: string }>(
    `/agent-runtime/sessions/${encodeURIComponent(sessionId)}/resume`,
    { method: 'POST' },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function getAgentRuntimeStatus(
  sessionId: string,
): Promise<{
  sessionId: string
  status: SessionStatus | string
  messageCount: number
}> {
  const res = await fetchApi<{
    sessionId: string
    status: SessionStatus | string
    messageCount: number
  }>(`/agent-runtime/${encodeURIComponent(sessionId)}/status`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function cancelAgentRuntime(
  sessionId: string,
): Promise<{ sessionId: string; status: string }> {
  const res = await fetchApi<{ sessionId: string; status: string }>(
    `/agent-runtime/${encodeURIComponent(sessionId)}/cancel`,
    { method: 'POST' },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export interface CheckAgentRuntimePermissionParams {
  toolName: string
  mode?: PermissionMode | string
  dangerLevel?: DangerLevel | string
}

export async function checkAgentRuntimePermission(
  params: CheckAgentRuntimePermissionParams,
): Promise<{
  toolName: string
  mode: string
  dangerLevel: string
  decision: PermissionDecision | string
}> {
  const qs = new URLSearchParams()
  qs.set('toolName', params.toolName)
  if (params.mode !== undefined) qs.set('mode', String(params.mode))
  if (params.dangerLevel !== undefined) qs.set('dangerLevel', String(params.dangerLevel))
  const res = await fetchApi<{
    toolName: string
    mode: string
    dangerLevel: string
    decision: PermissionDecision | string
  }>(`/agent-runtime/permission/check?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}
