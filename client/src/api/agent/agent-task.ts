import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AgentTask {
  id?: string
  agentId?: string
  userId?: string
  developerId?: string
  title?: string
  description?: string
  status?: number
  priority?: number
  createdAt?: string
  updatedAt?: string
}

export interface AgentTaskListParams {
  page?: number
  pageSize?: number
  agentId?: string
  userId?: string
  developerId?: string
  status?: number
  priority?: number
}

export const createAgentTask = withApiResponseHandler(
  async (data: AgentTask): Promise<ApiResponse<AgentTask>> => {
    const response = await request.post<AgentTask>('/agentTask', data)
    return normalizeApiResponse(response)
  }
)

export const updateAgentTask = withApiResponseHandler(
  async (data: AgentTask): Promise<ApiResponse<AgentTask>> => {
    const response = await request.put<AgentTask>('/agentTask', data)
    return normalizeApiResponse(response)
  }
)

export const setAgentTaskDeveloper = withApiResponseHandler(
  async (data: { id?: string; developerId?: string }): Promise<ApiResponse<AgentTask>> => {
    const response = await request.post<AgentTask>('/agentTask/set/developer', data)
    return normalizeApiResponse(response)
  }
)

export const exportAgentTask = withApiResponseHandler(
  async (params?: AgentTaskListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/agentTask/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const circulateAgentTaskDeveloper = withApiResponseHandler(
  async (data: { id?: string; developerId?: string }): Promise<ApiResponse<AgentTask>> => {
    const response = await request.post<AgentTask>('/agentTask/circulate/developer', data)
    return normalizeApiResponse(response)
  }
)

export const getAgentTaskById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentTask>> => {
    const response = await request.get<AgentTask>(`/agentTask/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAgentTaskList = withApiResponseHandler(
  async (params?: AgentTaskListParams): Promise<ApiResponse<PageResult<AgentTask>>> => {
    const response = await request.get<PageResult<AgentTask>>('/agentTask/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAgentTask = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/agentTask/${idsString}`)
    return normalizeApiResponse(response)
  }
)
