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
 */
export async function createAgenticSwarm(
  data: CreateSwarmRequest
): Promise<ApiResponse<CreateSwarmResponse>> {
  return apiClient.post<CreateSwarmResponse>('/api/ai/agentic/swarm/create', data)
}

/**
 * 获取 Swarm 状态
 */
export async function getSwarmStatus(swarmId: string): Promise<ApiResponse<SwarmStatusResponse>> {
  return apiClient.get<SwarmStatusResponse>(`/api/ai/agentic/swarm/${swarmId}/status`)
}

/**
 * 获取 Swarm 执行结果
 */
export async function getSwarmResults(
  swarmId: string
): Promise<ApiResponse<SwarmExecutionResult[]>> {
  return apiClient.get<SwarmExecutionResult[]>(`/api/ai/agentic/swarm/${swarmId}/results`)
}

/**
 * 获取 Swarm 性能指标
 */
export async function getSwarmPerformance(swarmId: string): Promise<ApiResponse<unknown>> {
  return apiClient.get(`/api/ai/agentic/swarm/${swarmId}/performance`)
}

/**
 * 获取用户的 Swarm 列表
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
  return apiClient.getPaginated<AgentSwarmConfig>('/api/ai/agentic/swarms', {
    page: params?.page || 1,
    pageSize: params?.pageSize || 20,
    ...(userId && { userId }),
    ...(params?.status && { status: params.status }),
  })
}

/**
 * 取消 Swarm 执行
 */
export async function cancelSwarm(swarmId: string): Promise<ApiResponse<void>> {
  return apiClient.post(`/api/ai/agentic/swarm/${swarmId}/cancel`)
}

/**
 * 获取 Swarm 优化建议
 */
export async function getSwarmOptimization(swarmId: string): Promise<ApiResponse<unknown>> {
  return apiClient.get(`/api/ai/agentic/swarm/${swarmId}/optimization`)
}
