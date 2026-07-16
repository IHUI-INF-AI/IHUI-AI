/**
 * 其他 API
 * 合并迁移自旧架构：mcp, openclaw, n8n, tbox, openrouter-proxy, coze
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

/** MCP 项目 */
export interface McpProject {
  id: string
  name: string
  description?: string
  icon?: string
  url?: string
  category?: string
  status?: number
  config?: Record<string, unknown>
  createdAt: string
  [key: string]: unknown
}

/** OpenClaw 资源 */
export interface OpenclawResource {
  id: string
  name: string
  description?: string
  type?: string
  url?: string
  status?: number
  [key: string]: unknown
}

/** N8n 工作�?*/
export interface N8nWorkflow {
  id: string
  name: string
  description?: string
  active?: boolean
  nodes?: Array<{ id: string; name: string; type: string; [key: string]: unknown }>
  connections?: Record<string, unknown>
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** N8n 执行记录 */
export interface N8nExecution {
  id: string
  workflowId: string
  workflowName?: string
  status: 'success' | 'error' | 'running' | 'waiting'
  mode?: string
  startedAt?: string
  stoppedAt?: string
  duration?: number
  [key: string]: unknown
}

/** Tbox 工具 */
export interface TboxTool {
  id: string
  name: string
  description?: string
  icon?: string
  category?: string
  url?: string
  config?: Record<string, unknown>
  status?: number
  [key: string]: unknown
}

/** OpenRouter 代理参数 */
export interface OpenRouterProxyParams {
  model?: string
  messages?: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  [key: string]: unknown
}

/** OpenRouter 模型 */
export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  contextLength?: number
  pricing?: { prompt: number; completion: number }
  [key: string]: unknown
}

/** Coze 智能�?*/
export interface CozeAgent {
  id: string
  name: string
  description?: string
  botId?: string
  icon?: string
  category?: string
  status?: number
  isPublic?: boolean
  createdAt: string
  [key: string]: unknown
}

/** Coze 对话参数 */
export interface CozeChatParams {
  botId: string
  message: string
  conversationId?: string
  userId?: string
  stream?: boolean
  [key: string]: unknown
}

// ===================== mcp（Model Context Protocol�?=====================

/** 获取 MCP 项目列表 */
export async function getMcpProjects(
  query: PageQuery & { category?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<McpProject>>> {
  return fetchApi<PageData<McpProject>>(`/api/mcp${buildQs(query)}`)
}

/** 获取 MCP 项目详情 */
export async function getMcpProjectDetail(id: string): Promise<ApiResult<McpProject>> {
  return fetchApi<McpProject>(`/api/mcp/${id}`)
}

/** 创建 MCP 项目 */
export async function createMcpProject(input: Partial<McpProject>): Promise<ApiResult<McpProject>> {
  return fetchApi<McpProject>('/api/mcp', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 MCP 项目 */
export async function updateMcpProject(
  id: string,
  input: Partial<McpProject>,
): Promise<ApiResult<McpProject>> {
  return fetchApi<McpProject>(`/api/mcp/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 MCP 项目 */
export async function deleteMcpProject(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/mcp/${id}`, { method: 'DELETE' })
}

/** 调用 MCP 工具 */
export async function invokeMcpTool(input: {
  projectId: string
  toolName: string
  args?: Record<string, unknown>
}): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/mcp/invoke', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ===================== openclaw =====================

/** 获取 OpenClaw 资源列表 */
export async function getOpenclawResources(
  query: PageQuery & { type?: string } = {},
): Promise<ApiResult<PageData<OpenclawResource>>> {
  return fetchApi<PageData<OpenclawResource>>(`/api/openclaw${buildQs(query)}`)
}

/** 获取 OpenClaw 资源详情 */
export async function getOpenclawResourceDetail(id: string): Promise<ApiResult<OpenclawResource>> {
  return fetchApi<OpenclawResource>(`/api/openclaw/${id}`)
}

/** 创建 OpenClaw 资源 */
export async function createOpenclawResource(
  input: Partial<OpenclawResource>,
): Promise<ApiResult<OpenclawResource>> {
  return fetchApi<OpenclawResource>('/api/openclaw', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 OpenClaw 资源 */
export async function updateOpenclawResource(
  id: string,
  input: Partial<OpenclawResource>,
): Promise<ApiResult<OpenclawResource>> {
  return fetchApi<OpenclawResource>(`/api/openclaw/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 OpenClaw 资源 */
export async function deleteOpenclawResource(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/openclaw/${id}`, { method: 'DELETE' })
}

// ===================== n8n（工作流�?=====================

/** 获取 N8n 工作流列�?*/
export async function getN8nWorkflows(
  query: PageQuery & { active?: boolean; tag?: string } = {},
): Promise<ApiResult<PageData<N8nWorkflow>>> {
  return fetchApi<PageData<N8nWorkflow>>(`/api/ai/n8n/workflows${buildQs(query)}`)
}

/** 获取 N8n 工作流详�?*/
export async function getN8nWorkflowDetail(id: string): Promise<ApiResult<N8nWorkflow>> {
  return fetchApi<N8nWorkflow>(`/api/ai/n8n/workflows/${id}`)
}

/** 创建 N8n 工作�?*/
export async function createN8nWorkflow(
  input: Partial<N8nWorkflow>,
): Promise<ApiResult<N8nWorkflow>> {
  return fetchApi<N8nWorkflow>('/api/ai/n8n/workflows', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 N8n 工作�?*/
export async function updateN8nWorkflow(
  id: string,
  input: Partial<N8nWorkflow>,
): Promise<ApiResult<N8nWorkflow>> {
  return fetchApi<N8nWorkflow>(`/api/ai/n8n/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 N8n 工作�?*/
export async function deleteN8nWorkflow(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/n8n/workflows/${id}`, { method: 'DELETE' })
}

/** 激�?停用 N8n 工作�?*/
export async function toggleN8nWorkflow(
  id: string,
  active: boolean,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/n8n/workflows/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  })
}

/** 执行 N8n 工作�?*/
export async function executeN8nWorkflow(
  id: string,
  input?: Record<string, unknown>,
): Promise<ApiResult<{ executionId: string }>> {
  return fetchApi<{ executionId: string }>(`/api/ai/n8n/workflows/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  })
}

/** 获取 N8n 执行记录列表 */
export async function getN8nExecutions(
  query: PageQuery & { workflowId?: string; status?: N8nExecution['status'] } = {},
): Promise<ApiResult<PageData<N8nExecution>>> {
  return fetchApi<PageData<N8nExecution>>(`/api/ai/n8n/executions${buildQs(query)}`)
}

/** 获取 N8n 执行记录详情 */
export async function getN8nExecutionDetail(id: string): Promise<ApiResult<N8nExecution>> {
  return fetchApi<N8nExecution>(`/api/ai/n8n/executions/${id}`)
}

// ===================== tbox =====================

/** 获取 Tbox 工具列表 */
export async function getTboxTools(
  query: PageQuery & { category?: string } = {},
): Promise<ApiResult<PageData<TboxTool>>> {
  return fetchApi<PageData<TboxTool>>(`/api/tbox${buildQs(query)}`)
}

/** 获取 Tbox 工具详情 */
export async function getTboxToolDetail(id: string): Promise<ApiResult<TboxTool>> {
  return fetchApi<TboxTool>(`/api/tbox/${id}`)
}

/** 创建 Tbox 工具 */
export async function createTboxTool(input: Partial<TboxTool>): Promise<ApiResult<TboxTool>> {
  return fetchApi<TboxTool>('/api/tbox', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 Tbox 工具 */
export async function updateTboxTool(
  id: string,
  input: Partial<TboxTool>,
): Promise<ApiResult<TboxTool>> {
  return fetchApi<TboxTool>(`/api/tbox/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 Tbox 工具 */
export async function deleteTboxTool(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/tbox/${id}`, { method: 'DELETE' })
}

// ===================== openrouter-proxy =====================

/** OpenRouter 代理 - 聊天补全 */
export async function openRouterChatCompletions(
  params: OpenRouterProxyParams,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/openrouter-proxy/chat/completions', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取 OpenRouter 模型列表 */
export async function getOpenRouterModels(): Promise<ApiResult<OpenRouterModel[]>> {
  return fetchApi<OpenRouterModel[]>('/api/openrouter-proxy/models')
}

// ===================== coze =====================

/** 获取 Coze 智能体列�?*/
export async function getCozeAgents(
  query: PageQuery & { category?: string; isPublic?: boolean } = {},
): Promise<ApiResult<PageData<CozeAgent>>> {
  return fetchApi<PageData<CozeAgent>>(`/api/coze/bot/list${buildQs(query)}`)
}

/** 获取 Coze 智能体详�?*/
export async function getCozeAgentDetail(id: string): Promise<ApiResult<CozeAgent>> {
  return fetchApi<CozeAgent>(`/api/coze/bot/get?bot_id=${encodeURIComponent(id)}`)
}

/** 创建 Coze 智能�?*/
export async function createCozeAgent(input: Partial<CozeAgent>): Promise<ApiResult<CozeAgent>> {
  return fetchApi<CozeAgent>('/api/coze/bot/create', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 Coze 智能�?*/
export async function updateCozeAgent(
  id: string,
  input: Partial<CozeAgent>,
): Promise<ApiResult<CozeAgent>> {
  return fetchApi<CozeAgent>('/api/coze/bot/update', {
    method: 'POST',
    body: JSON.stringify({ ...input, bot_id: id }),
  })
}

/** 删除 Coze 智能�?*/
export async function deleteCozeAgent(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/coze/bot/delete', {
    method: 'POST',
    body: JSON.stringify({ bot_id: id }),
  })
}

/** Coze 对话 */
export async function cozeChat(params: CozeChatParams): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/ai/coze/chat', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取 Coze 对话历史 */
export async function getCozeChatHistory(
  botId: string,
  conversationId: string,
  query: PageQuery = {},
): Promise<ApiResult<PageData<unknown>>> {
  return fetchApi<PageData<unknown>>(
    `/api/coze/chat/history/${botId}/${conversationId}${buildQs(query)}`,
  )
}
