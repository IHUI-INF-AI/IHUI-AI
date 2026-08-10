/**
 * Agent 模块 — 列表 / 调用 / 高级执行 / Pipeline / 并行 / 分解。
 *
 * 端点(12 个):
 * - GET  /v1/agents
 * - GET  /v1/agents/:id
 * - POST /v1/agents/:id/call
 * - POST /v1/agents/execute(高级执行)
 * - POST /v1/agents/execute/stream(SSE 流式执行)
 * - GET  /v1/agents/tasks/:id/status
 * - POST /v1/agents/tasks/:id/cancel
 * - GET  /v1/agents/sessions
 * - DELETE /v1/agents/sessions/:id
 * - POST /v1/agents/pipeline
 * - POST /v1/agents/parallel
 * - POST /v1/agents/decompose
 */

import type { BaseClient } from './base.js'
import { parseAgentStream, type AgentStreamEvent } from './streaming.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1AgentsListResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    description: string
    model: string
    capabilities: string[]
    createdAt: string
  }>
}

export interface V1AgentInfo {
  id: string
  name: string
  description: string
  model: string
  capabilities: string[]
  systemPrompt: string
  createdAt: string
  updatedAt: string
}

export interface V1AgentCallRequest {
  input: string
  sessionId?: string
}

export interface V1AgentCallResponse {
  taskId: string
  output: string
  status: 'completed' | 'failed'
}

export interface V1AgentExecuteRequest {
  agentId: string
  input: string
  sessionId?: string
  permissionMode?: string
  maxIterations?: number
}

export interface V1AgentExecuteResponse {
  taskId: string
  sessionId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  output: string
  iterations: number
  usage: { totalTokens: number }
}

export interface V1AgentTaskStatusResponse {
  taskId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  result?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface V1AgentSessionsResponse {
  object: 'list'
  data: Array<{
    id: string
    agentId: string
    title: string
    messageCount: number
    lastMessageAt: string
    createdAt: string
  }>
}

export interface V1AgentPipelineRequest {
  steps: Array<{
    agentId: string
    input: string
    dependsOn?: number[]
  }>
}

export interface V1AgentPipelineResponse {
  pipelineId: string
  results: Array<{
    stepIndex: number
    status: 'completed' | 'failed'
    output: string
  }>
}

export interface V1AgentParallelRequest {
  tasks: Array<{
    agentId: string
    input: string
  }>
}

export interface V1AgentParallelResponse {
  batchId: string
  results: Array<{
    index: number
    status: 'completed' | 'failed'
    output: string
  }>
}

/** Agent 任务分解响应(POST /v1/agents/decompose)。 */
export interface V1AgentDecomposeResponse {
  taskId: string
  subtasks: Array<{ id: string; description: string; dependsOn?: string[] }>
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface AgentsModule {
  /** GET /v1/agents(Agent 列表)。 */
  list(): Promise<V1AgentsListResponse>
  /** GET /v1/agents/:id(Agent 详情)。 */
  get(id: string): Promise<V1AgentInfo>
  /** POST /v1/agents/:id/call(调用 Agent)。 */
  call(id: string, req: V1AgentCallRequest): Promise<V1AgentCallResponse>
  /** POST /v1/agents/execute(高级执行,支持 PermissionGuard)。 */
  execute(req: V1AgentExecuteRequest): Promise<V1AgentExecuteResponse>
  /** POST /v1/agents/execute/stream(SSE 流式执行)→ 异步生成器。 */
  executeStream(req: V1AgentExecuteRequest): AsyncGenerator<AgentStreamEvent>
  /** GET /v1/agents/tasks/:id/status(任务状态)。 */
  getTaskStatus(taskId: string): Promise<V1AgentTaskStatusResponse>
  /** POST /v1/agents/tasks/:id/cancel(取消任务)。 */
  cancelTask(taskId: string): Promise<void>
  /** GET /v1/agents/sessions(会话列表)。 */
  listSessions(): Promise<V1AgentSessionsResponse>
  /** DELETE /v1/agents/sessions/:id(删除会话)。 */
  deleteSession(id: string): Promise<void>
  /** POST /v1/agents/pipeline(Pipeline 编排)。 */
  pipeline(req: V1AgentPipelineRequest): Promise<V1AgentPipelineResponse>
  /** POST /v1/agents/parallel(并行执行)。 */
  parallel(req: V1AgentParallelRequest): Promise<V1AgentParallelResponse>
  /** POST /v1/agents/decompose(任务分解)。 */
  decompose(req: V1AgentExecuteRequest): Promise<V1AgentDecomposeResponse>
}

export function createAgentsModule(client: BaseClient): AgentsModule {
  return {
    list: () => client.request<V1AgentsListResponse>('GET', '/agents'),
    get: (id) => client.request<V1AgentInfo>('GET', `/agents/${encodeURIComponent(id)}`),
    call: (id, req) =>
      client.request<V1AgentCallResponse>('POST', `/agents/${encodeURIComponent(id)}/call`, req),
    execute: (req) => client.request<V1AgentExecuteResponse>('POST', '/agents/execute', req),

    async *executeStream(req) {
      const stream = await client.requestStream('POST', '/agents/execute/stream', req)
      yield* parseAgentStream(stream)
    },

    getTaskStatus: (taskId) =>
      client.request<V1AgentTaskStatusResponse>('GET', `/agents/tasks/${encodeURIComponent(taskId)}/status`),
    cancelTask: (taskId) =>
      client.request<void>('POST', `/agents/tasks/${encodeURIComponent(taskId)}/cancel`),
    listSessions: () => client.request<V1AgentSessionsResponse>('GET', '/agents/sessions'),
    deleteSession: (id) =>
      client.request<void>('DELETE', `/agents/sessions/${encodeURIComponent(id)}`),
    pipeline: (req) => client.request<V1AgentPipelineResponse>('POST', '/agents/pipeline', req),
    parallel: (req) => client.request<V1AgentParallelResponse>('POST', '/agents/parallel', req),
    decompose: (req) => client.request<V1AgentDecomposeResponse>('POST', '/agents/decompose', req),
  }
}