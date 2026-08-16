/**
 * 用户 / 工作区 / 工作流 / 统计模块。
 *
 * 端点(9 个):
 * - GET  /v1/me(当前用户 + 配额)
 * - GET  /v1/projects(项目列表)
 * - GET  /v1/projects/:id/files(项目文件)
 * - GET  /v1/workflows/:id(工作流详情)
 * - POST /v1/workflows/instances(运行工作流)
 * - POST /v1/workflows/coze/run(Coze 工作流)
 * - POST /v1/workflows/n8n/run(n8n 工作流)
 * - GET  /v1/usage(用量统计)
 * - GET  /v1/usage/:vendor(厂商用量)
 */

import type { BaseClient } from './base.js'
import type { V1FileInfo } from './files.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1UserInfo {
  id: string
  username: string
  email: string
  avatar?: string
  createdAt: string
  quota: {
    hourlyUsed: number
    hourlyLimit: number
    dailyUsed: number
    dailyLimit: number
    resetAt: string
  }
}

export interface V1ProjectsResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    description?: string
    fileCount: number
    createdAt: string
    updatedAt: string
  }>
}

export interface V1ProjectFilesResponse {
  object: 'list'
  data: V1FileInfo[]
}

export interface V1WorkflowInfo {
  id: string
  name: string
  description?: string
  steps: Array<{
    id: string
    name: string
    type: string
    config?: Record<string, unknown>
  }>
  createdAt: string
}

export interface V1RunWorkflowRequest {
  workflowId: string
  inputs?: Record<string, unknown>
}

export interface V1RunWorkflowResponse {
  instanceId: string
  status: 'running' | 'completed' | 'failed'
  outputs?: Record<string, unknown>
}

export interface V1RunCozeWorkflowRequest {
  workflowId: string
  parameters: Record<string, unknown>
}

export interface V1RunN8nWorkflowRequest {
  workflowId: string
  data?: Record<string, unknown>
}

export interface V1UsageResponse {
  apiKeyId: string
  period: string
  totalRequests: number
  byCategory: Record<string, number>
  byModel: Record<string, number>
  tokensUsed: number
}

export interface V1VendorUsageResponse {
  vendor: string
  requests: number
  tokens: number
  cost: number
}

/** Coze 工作流运行响应(透传上游)。 */
export type V1RunCozeWorkflowResponse = Record<string, unknown>

/** n8n 工作流运行响应(透传上游)。 */
export type V1RunN8nWorkflowResponse = Record<string, unknown>

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface UserModule {
  /** GET /v1/me(当前用户信息 + 配额)。 */
  me(): Promise<V1UserInfo>
  /** GET /v1/projects(项目列表)。 */
  listProjects(): Promise<V1ProjectsResponse>
  /** GET /v1/projects/:id/files(项目文件列表)。 */
  listProjectFiles(projectId: string): Promise<V1ProjectFilesResponse>
  /** GET /v1/workflows/:id(工作流详情)。 */
  getWorkflow(id: string): Promise<V1WorkflowInfo>
  /** POST /v1/workflows/instances(运行工作流)。 */
  runWorkflow(req: V1RunWorkflowRequest): Promise<V1RunWorkflowResponse>
  /** POST /v1/workflows/coze/run(Coze 工作流)。 */
  runCozeWorkflow(req: V1RunCozeWorkflowRequest): Promise<V1RunCozeWorkflowResponse>
  /** POST /v1/workflows/n8n/run(n8n 工作流)。 */
  runN8nWorkflow(req: V1RunN8nWorkflowRequest): Promise<V1RunN8nWorkflowResponse>
  /** GET /v1/usage(用量统计)。 */
  getUsage(): Promise<V1UsageResponse>
  /** GET /v1/usage/:vendor(厂商用量)。 */
  getVendorUsage(vendor: string): Promise<V1VendorUsageResponse>
}

export function createUserModule(client: BaseClient): UserModule {
  return {
    me: () => client.request<V1UserInfo>('GET', '/me'),
    listProjects: () => client.request<V1ProjectsResponse>('GET', '/projects'),
    listProjectFiles: (projectId) =>
      client.request<V1ProjectFilesResponse>(
        'GET',
        `/projects/${encodeURIComponent(projectId)}/files`,
      ),
    getWorkflow: (id) =>
      client.request<V1WorkflowInfo>('GET', `/workflows/${encodeURIComponent(id)}`),
    runWorkflow: (req) =>
      client.request<V1RunWorkflowResponse>('POST', '/workflows/instances', req),
    runCozeWorkflow: (req) =>
      client.request<V1RunCozeWorkflowResponse>('POST', '/workflows/coze/run', req),
    runN8nWorkflow: (req) =>
      client.request<V1RunN8nWorkflowResponse>('POST', '/workflows/n8n/run', req),
    getUsage: () => client.request<V1UsageResponse>('GET', '/usage'),
    getVendorUsage: (vendor) =>
      client.request<V1VendorUsageResponse>('GET', `/usage/${encodeURIComponent(vendor)}`),
  }
}
