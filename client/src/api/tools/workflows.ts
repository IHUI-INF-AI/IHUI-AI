import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// 工作流类型定义
export interface WorkflowNode {
  id: string
  type: 'agent' | 'condition' | 'loop' | 'parallel' | 'action' | 'input' | 'output'
  name: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
  label?: string
}

export interface WorkflowVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  defaultValue?: unknown
  description?: string
}

export interface WorkflowTrigger {
  type: 'api' | 'webhook' | 'schedule' | 'event'
  config: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: WorkflowVariable[]
  triggers?: WorkflowTrigger[]
  status: 'draft' | 'published' | 'archived'
  version: string
  createTime?: string
  updateTime?: string
}

// 工作流执行状态
export interface WorkflowExecution {
  id: string
  workflowId: string
  workflowName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  logs?: string[]
}

// 获取工作流列表
export async function getWorkflows(
  params?: PaginationParams & {
    status?: string
    search?: string
  }
): Promise<ApiResponse<PaginationResponse<Workflow>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.workflows.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.workflows.获取成功'),
      data: response.data || {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工作流列表失败',
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取工作流详情
export async function getWorkflowDetail(id: string): Promise<ApiResponse<Workflow>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.workflows.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.workflows.获取成功1'),
      data: response.data || ({} as Workflow),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工作流详情失败',
      data: {} as Workflow,
      timestamp: Date.now(),
    }
  }
}

// 创建工作流
export async function createWorkflow(workflow: Partial<Workflow>): Promise<ApiResponse<Workflow>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.workflows.list, workflow)
    return {
      code: 200,
      success: true,
      message: t('api.workflows.创建成功2'),
      data: response.data || ({} as Workflow),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建工作流失败',
      data: {} as Workflow,
      timestamp: Date.now(),
    }
  }
}

// 更新工作流
export async function updateWorkflow(
  id: string,
  workflow: Partial<Workflow>
): Promise<ApiResponse<Workflow>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.workflows.byId(id), workflow)
    return {
      code: 200,
      success: true,
      message: t('api.workflows.更新成功3'),
      data: response.data || ({} as Workflow),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新工作流失败',
      data: {} as Workflow,
      timestamp: Date.now(),
    }
  }
}

// 删除工作流
export async function deleteWorkflow(id: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.delete(DEVELOPER_PATHS.workflows.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.workflows.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除工作流失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 发布工作流
export async function publishWorkflow(id: string): Promise<ApiResponse<Workflow>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.workflows.publish(id))
    return {
      code: 200,
      success: true,
      message: t('api.workflows.发布成功5'),
      data: response.data || ({} as Workflow),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '发布工作流失败',
      data: {} as Workflow,
      timestamp: Date.now(),
    }
  }
}

// 执行工作流
export async function executeWorkflow(
  id: string,
  input?: Record<string, unknown>
): Promise<ApiResponse<WorkflowExecution>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.workflows.execute(id), { input })
    return {
      code: 200,
      success: true,
      message: t('api.workflows.执行成功6'),
      data: response.data || ({} as WorkflowExecution),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '执行工作流失败',
      data: {} as WorkflowExecution,
      timestamp: Date.now(),
    }
  }
}

// 获取工作流执行历史
export async function getWorkflowExecutions(
  workflowId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<WorkflowExecution>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.workflows.executions(workflowId), {
      params,
    })
    return {
      code: 200,
      success: true,
      message: t('api.workflows.获取成功7'),
      data: response.data || {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取执行历史失败',
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取工作流执行详情
export async function getWorkflowExecutionDetail(
  workflowId: string,
  executionId: string
): Promise<ApiResponse<WorkflowExecution>> {
  try {
    const response = await request.get(
      DEVELOPER_PATHS.workflows.executionById(workflowId, executionId)
    )
    return {
      code: 200,
      success: true,
      message: t('api.workflows.获取成功8'),
      data: response.data || ({} as WorkflowExecution),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取执行详情失败',
      data: {} as WorkflowExecution,
      timestamp: Date.now(),
    }
  }
}

// 取消工作流执行
export async function cancelWorkflowExecution(
  workflowId: string,
  executionId: string
): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.post(
      DEVELOPER_PATHS.workflows.executionCancel(workflowId, executionId)
    )
    return {
      code: 200,
      success: true,
      message: t('api.workflows.取消成功9'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消执行失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}
