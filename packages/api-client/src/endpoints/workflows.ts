// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作流域端点(2026-10-26 Wave1 补屏立,workflows 域 web→RN 对齐):
 * 覆盖 apps/web /workflows 三页(列表/详情/实例详情)与 RN 共享屏的统一取数层,
 * 对应 apps/api /api/workflows 路由;各端不得再端内裸 fetch。
 *
 * 信封 data 口径(后端 apps/api/src/routes/workflows.ts):
 * - GET    /workflows                    → {list,total,page,pageSize}
 * - POST   /workflows                    → {workflow}
 * - GET    /workflows/:id                → {workflow}
 * - PATCH  /workflows/:id                → {workflow}
 * - DELETE /workflows/:id                → {deleted}
 * - POST   /workflows/:id/trigger        → {instance,tasks}
 * - GET    /workflows/instances          → {list,total}(query: workflowId/page/pageSize)
 * - POST   /workflows/instances/:id/cancel|retry → {instance}
 * - GET    /workflows/instances/:id      → {instance,tasks}
 * - GET    /workflows/instances/:id/tasks → {list}
 * - GET    /workflows/instances/:id/logs  → {list,total}
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 触发类型(对齐后端 triggerType 枚举)。 */
export type WorkflowTriggerType = 'manual' | 'schedule' | 'event' | 'webhook'

/** 实例/任务状态(对齐后端 instance status 枚举)。 */
export type WorkflowInstanceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 日志级别。 */
export type WorkflowLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 工作流行。 */
export interface WorkflowRow {
  id: string
  name: string
  description?: string
  triggerType: WorkflowTriggerType
  steps?: unknown[]
  isActive: boolean
  createdAt: string
}

/** 运行实例行。 */
export interface WorkflowInstanceRow {
  id: string
  status: WorkflowInstanceStatus
  workflowId?: string
  workflowName?: string
  startedAt?: string
  completedAt?: string
  input?: unknown
  output?: unknown
  error?: string
}

/** 实例任务行。 */
export interface WorkflowTaskRow {
  id: string
  step: number
  name: string
  type: string
  status: WorkflowInstanceStatus
  input?: unknown
  output?: unknown
  error?: string
}

/** 实例日志行。 */
export interface WorkflowLogRow {
  id: string
  timestamp: string
  level: WorkflowLogLevel
  message: string
}

export interface WorkflowListData {
  list: WorkflowRow[]
  total: number
  page: number
  pageSize: number
}

export interface WorkflowDetailData {
  workflow: WorkflowRow
}

export interface WorkflowDeletedData {
  deleted: boolean
}

export interface WorkflowTriggerData {
  instance: WorkflowInstanceRow
  tasks: WorkflowTaskRow[]
}

export interface WorkflowInstanceListData {
  list: WorkflowInstanceRow[]
  total: number
}

export interface WorkflowInstanceDetailData {
  instance: WorkflowInstanceRow
  tasks: WorkflowTaskRow[]
}

export interface WorkflowTaskListData {
  list: WorkflowTaskRow[]
}

export interface WorkflowLogListData {
  list: WorkflowLogRow[]
  total: number
}

/** 创建工作流入参。 */
export interface CreateWorkflowInput {
  name: string
  description?: string
  triggerType: WorkflowTriggerType
  steps?: unknown[]
}

/** 更新工作流补丁(名称/描述/触发类型/步骤/启停,均可选)。 */
export interface UpdateWorkflowInput {
  name?: string
  description?: string
  triggerType?: WorkflowTriggerType
  steps?: unknown[]
  isActive?: boolean
}

/** 工作流列表(GET /workflows)。 */
export async function listWorkflows(params?: {
  page?: number
  pageSize?: number
}): Promise<ApiResult<WorkflowListData>> {
  return fetchApi<WorkflowListData>('/workflows', { params })
}

/** 创建工作流(POST /workflows)。 */
export async function createWorkflow(
  input: CreateWorkflowInput,
): Promise<ApiResult<WorkflowDetailData>> {
  return fetchApi<WorkflowDetailData>('/workflows', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 工作流详情(GET /workflows/:id)。 */
export async function getWorkflow(id: string): Promise<ApiResult<WorkflowDetailData>> {
  return fetchApi<WorkflowDetailData>(`/workflows/${encodeURIComponent(id)}`)
}

/** 更新工作流(PATCH /workflows/:id)。 */
export async function updateWorkflow(
  id: string,
  patch: UpdateWorkflowInput,
): Promise<ApiResult<WorkflowDetailData>> {
  return fetchApi<WorkflowDetailData>(`/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** 删除工作流(DELETE /workflows/:id)。 */
export async function deleteWorkflow(id: string): Promise<ApiResult<WorkflowDeletedData>> {
  return fetchApi<WorkflowDeletedData>(`/workflows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 触发工作流(POST /workflows/:id/trigger)。 */
export async function triggerWorkflow(id: string): Promise<ApiResult<WorkflowTriggerData>> {
  return fetchApi<WorkflowTriggerData>(`/workflows/${encodeURIComponent(id)}/trigger`, {
    method: 'POST',
  })
}

/** 运行实例列表(GET /workflows/instances;workflowId 过滤)。 */
export async function listWorkflowInstances(params: {
  workflowId?: string
  page?: number
  pageSize?: number
}): Promise<ApiResult<WorkflowInstanceListData>> {
  return fetchApi<WorkflowInstanceListData>('/workflows/instances', { params })
}

/** 取消实例(POST /workflows/instances/:id/cancel)。 */
export async function cancelWorkflowInstance(
  id: string,
): Promise<ApiResult<{ instance: WorkflowInstanceRow }>> {
  return fetchApi<{ instance: WorkflowInstanceRow }>(
    `/workflows/instances/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  )
}

/** 重试实例(POST /workflows/instances/:id/retry)。 */
export async function retryWorkflowInstance(
  id: string,
): Promise<ApiResult<{ instance: WorkflowInstanceRow }>> {
  return fetchApi<{ instance: WorkflowInstanceRow }>(
    `/workflows/instances/${encodeURIComponent(id)}/retry`,
    { method: 'POST' },
  )
}

/** 实例详情(GET /workflows/instances/:id;含 tasks)。 */
export async function getWorkflowInstance(
  id: string,
): Promise<ApiResult<WorkflowInstanceDetailData>> {
  return fetchApi<WorkflowInstanceDetailData>(`/workflows/instances/${encodeURIComponent(id)}`)
}

/** 实例任务列表(GET /workflows/instances/:id/tasks)。 */
export async function getWorkflowInstanceTasks(
  id: string,
): Promise<ApiResult<WorkflowTaskListData>> {
  return fetchApi<WorkflowTaskListData>(`/workflows/instances/${encodeURIComponent(id)}/tasks`)
}

/** 实例日志列表(GET /workflows/instances/:id/logs)。 */
export async function getWorkflowInstanceLogs(id: string): Promise<ApiResult<WorkflowLogListData>> {
  return fetchApi<WorkflowLogListData>(`/workflows/instances/${encodeURIComponent(id)}/logs`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
