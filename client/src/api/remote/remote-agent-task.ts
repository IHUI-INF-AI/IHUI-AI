import request from '../../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../../utils/apiResponseHandler'
import type { ApiResponse } from '@/types/api'

/**
 * 智能体任务消息审批参数
 */
export interface AgentTaskMessageApproveParams {
  taskId: string
  messageId: string
  action: 'approve' | 'reject'
  comment?: string
  [key: string]: any
}

/**
 * 智能体任务消息审批响应
 */
export interface AgentTaskMessageApproveResponse {
  success: boolean
  messageId: string
  [key: string]: any
}

export const sendAgentTaskMessageApprove = withApiResponseHandler(
  async (data: AgentTaskMessageApproveParams): Promise<ApiResponse<AgentTaskMessageApproveResponse>> => {
    const response = await request.post<AgentTaskMessageApproveResponse>('/remote/agent/task/send/message/approve', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体任务需求参数
 */
export interface AgentTaskNeedParams {
  taskId: string
  needDescription: string
  priority?: 'low' | 'normal' | 'high'
  [key: string]: any
}

/**
 * 智能体任务需求响应
 */
export interface AgentTaskNeedResponse {
  id: string
  taskId: string
  needDescription: string
  [key: string]: any
}

export const addAgentTaskNeedTask = withApiResponseHandler(
  async (data: AgentTaskNeedParams): Promise<ApiResponse<AgentTaskNeedResponse>> => {
    const response = await request.post<AgentTaskNeedResponse>('/remote/agent/task/need/task/add', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体任务需求查询参数
 */
export interface AgentTaskNeedQueryParams {
  taskId?: string
  page?: number
  pageSize?: number
  [key: string]: any
}

export const getAgentTaskNeedTask = withApiResponseHandler(
  async (params?: AgentTaskNeedQueryParams): Promise<ApiResponse<AgentTaskNeedResponse[]>> => {
    const response = await request.get<AgentTaskNeedResponse[]>('/remote/agent/task/need/task', { params })
    return normalizeApiResponse(response)
  }
)

export const getAgentTaskNeedTaskById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentTaskNeedResponse>> => {
    const response = await request.get<AgentTaskNeedResponse>(`/remote/agent/task/need/task/${id}`)
    return normalizeApiResponse(response)
  }
)
