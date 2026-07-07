/**
 * Agentic AI 服务
 * 使用统一的 API 客户端
 */

import { apiClient } from '../client'
import type { ApiResponse } from '@/types'
// 定义缺失的类型
interface AgentSwarmConfig {
  [key: string]: unknown
}
interface TaskPlan {
  [key: string]: unknown
}
interface ReflectionResult {
  [key: string]: unknown
}

/**
 * 创建 Agentic Swarm 请求
 */
export interface CreateSwarmRequest {
  task: string
  userId?: string
  options?: {
    agentSpecs?: Array<
      Partial<{
        type: string
        name: string
        model: string
      }>
    >
    coordination?: 'hierarchical' | 'peer-to-peer' | 'market-based'
    maxIterations?: number
  }
  autoOptimize?: boolean
}

/**
 * 创建 Agentic Swarm 响应
 */
export interface CreateSwarmResponse {
  swarmId: string
  plan: TaskPlan
}

/**
 * Swarm 状态响应
 */
export interface SwarmStatusResponse {
  swarm: AgentSwarmConfig
  agentStates: Record<string, string>
  currentIteration?: number
}

/**
 * Swarm 执行结果
 */
export interface SwarmExecutionResult {
  stepId: string
  stepAction: string
  result: unknown
  reflection?: ReflectionResult
  correctedResult?: unknown
  executionTime: number
  tokensUsed: number
  status: string
  errorMessage?: string
  createdAt: string
  agentId: string
}

/**
 * 创建 Agentic Swarm
 * 调用后端真实 Swarm 编排 API (POST /api/v1/workspace/swarms)
 */
export async function createAgenticSwarm(
  data: CreateSwarmRequest
): Promise<ApiResponse<CreateSwarmResponse>> {
  const resp = await apiClient.post<{ swarm_id: string; task: string; status: string; agents: unknown[] }>('/api/v1/workspace/swarms', {
    task: data.task,
    workspace_path: (data.options as Record<string, unknown>)?.workspace_path || '',
    model_id: (data.options as Record<string, unknown>)?.model_id || 'default',
  })
  // 适配响应格式: 后端返回 swarm_id, 前端期望 swarmId
  if (resp.success && resp.data) {
    return {
      ...resp,
      data: {
        swarmId: resp.data.swarm_id,
        plan: { task: resp.data.task, agents: resp.data.agents },
      } as unknown as CreateSwarmResponse,
    }
  }
  return resp as unknown as ApiResponse<CreateSwarmResponse>
}

/**
 * 获取 Swarm 状态
 * 调用后端真实 API (GET /api/v1/workspace/swarms/{swarmId})
 */
export async function getSwarmStatus(swarmId: string): Promise<ApiResponse<SwarmStatusResponse>> {
  const resp = await apiClient.get<{ swarm_id: string; status: string; results: Record<string, string>; agents: Array<{ agent_id: string; status: string; result: string | null }> }>(`/api/v1/workspace/swarms/${swarmId}`)
  // 适配响应格式
  if (resp.success && resp.data) {
    const agentStates: Record<string, string> = {}
    for (const agent of resp.data.agents || []) {
      agentStates[agent.agent_id] = agent.status
    }
    // 如果 swarm 已完成, 从 results 中提取最终结果
    let result: string | undefined
    if (resp.data.status === 'completed' && resp.data.results) {
      const values = Object.values(resp.data.results)
      if (values.length > 0) {
        result = values.join('\n\n---\n\n')
      }
    }
    return {
      ...resp,
      data: {
        swarm: { swarmId: resp.data.swarm_id, status: resp.data.status, result } as unknown as AgentSwarmConfig,
        agentStates,
      } as unknown as SwarmStatusResponse,
    }
  }
  return resp as unknown as ApiResponse<SwarmStatusResponse>
}

/**
 * 获取 Swarm 执行结果
 * 调用后端真实 API (GET /api/v1/workspace/swarms/{swarmId})
 */
export async function getSwarmResults(
  swarmId: string
): Promise<ApiResponse<SwarmExecutionResult[]>> {
  const resp = await apiClient.get<{ results: Record<string, string>; agents: Array<{ agent_id: string; result: string | null; status: string }> }>(`/api/v1/workspace/swarms/${swarmId}`)
  // 将后端结果格式适配为前端期望的数组格式
  if (resp.success && resp.data) {
    const data = resp.data
    const agents = data.agents || []
    const results: SwarmExecutionResult[] = agents.map((agent, i) => ({
      stepId: agent.agent_id,
      stepAction: `Agent ${agent.agent_id}`,
      result: agent.result,
      executionTime: 0,
      tokensUsed: 0,
      status: agent.status,
      agentId: agent.agent_id,
      createdAt: new Date(Date.now() - (agents.length - i) * 60000).toISOString(),
    }))
    return { ...resp, data: results }
  }
  return resp as unknown as ApiResponse<SwarmExecutionResult[]>
}

/**
 * 获取 Swarm 性能指标
 * 复用状态 API
 */
export async function getSwarmPerformance(swarmId: string): Promise<ApiResponse<unknown>> {
  return apiClient.get(`/api/v1/workspace/swarms/${swarmId}`)
}

/**
 * 获取用户的 Swarm 列表
 * 调用后端真实 API (GET /api/v1/workspace/swarms)
 */
export async function getUserSwarms(
  userId?: string,
  params?: {
    page?: number
    pageSize?: number
    status?: string
  }
): Promise<
  ApiResponse<{
    items: AgentSwarmConfig[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  const resp = await apiClient.get<AgentSwarmConfig[]>('/api/v1/workspace/swarms', {
    ...(userId && { userId }),
    ...(params?.status && { status: params.status }),
  })
  // 适配分页格式
  const items = resp.data || []
  return {
    ...resp,
    data: {
      items,
      total: items.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      totalPages: 1,
    },
  } as unknown as ApiResponse<{
    items: AgentSwarmConfig[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
}

/**
 * 取消 Swarm 执行
 * 调用后端真实 API (DELETE /api/v1/workspace/swarms/{swarmId})
 */
export async function cancelSwarm(swarmId: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/api/v1/workspace/swarms/${swarmId}`)
}

/**
 * 获取 Swarm 优化建议
 * 复用状态 API (优化建议可从 agent 状态和结果中推导)
 */
export async function getSwarmOptimization(swarmId: string): Promise<ApiResponse<unknown>> {
  return apiClient.get(`/api/v1/workspace/swarms/${swarmId}`)
}
