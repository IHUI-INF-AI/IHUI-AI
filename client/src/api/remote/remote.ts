import request from '../../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../../utils/apiResponseHandler'
import type { ApiResponse } from '@/types/api'
import type { AgentInfo, AgentListOptions } from '../agent/agent-plaza'
import type {
  AgentTaskMessageApproveParams,
  AgentTaskMessageApproveResponse,
  AgentTaskNeedParams,
  AgentTaskNeedResponse,
  AgentTaskNeedQueryParams,
} from '../remote/remote-agent-task'

/**
 * 名片上传响应
 */
export interface BusinessCardUploadResponse {
  success: boolean
  cardId?: string
  url?: string
  [key: string]: unknown
}

export const uploadBusinessCard = withApiResponseHandler(
  async (data: FormData): Promise<ApiResponse<BusinessCardUploadResponse>> => {
    const response = await request.post<BusinessCardUploadResponse>('/remote/uploadBusinessCard', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 团队信息
 */
export interface TeamInfo {
  id: string
  name: string
  memberCount: number
  [key: string]: unknown
}

/**
 * 团队查询参数
 */
export interface TeamQueryParams {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

export const getMyTeam = withApiResponseHandler(
  async (uuid: string, data?: TeamQueryParams): Promise<ApiResponse<TeamInfo[]>> => {
    const response = await request.post<TeamInfo[]>(`/remote/myTeam/${uuid}`, data)
    return normalizeApiResponse(response)
  }
)

/**
 * 腾讯句子响应
 */
export interface TencentSentenceResponse {
  text: string
  confidence?: number
  [key: string]: unknown
}

/**
 * 腾讯句子请求参数
 */
export interface TencentSentenceParams {
  text: string
  [key: string]: unknown
}

export const getTencentSentence = withApiResponseHandler(
  async (data: TencentSentenceParams): Promise<ApiResponse<TencentSentenceResponse>> => {
    const response = await request.post<TencentSentenceResponse>('/remote/get/tencent/sentence', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 远程角色信息
 */
export interface RemoteRole {
  id: string
  name: string
  permissions: string[]
  [key: string]: unknown
}

export const getRemoteRole = withApiResponseHandler(
  async (): Promise<ApiResponse<RemoteRole[]>> => {
    const response = await request.get<RemoteRole[]>('/remote/role')
    return normalizeApiResponse(response)
  }
)

/**
 * 远程信息
 */
export interface RemoteInfo {
  id: string
  name: string
  status: string
  [key: string]: unknown
}

export const getRemoteInfo = withApiResponseHandler(
  async (uuid: string): Promise<ApiResponse<RemoteInfo>> => {
    const response = await request.get<RemoteInfo>(`/remote/info/${uuid}`)
    return normalizeApiResponse(response)
  }
)

export const getRemoteTrue = withApiResponseHandler(
  async (): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await request.get<{ success: boolean }>('/remote/get/true')
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体分类
 */
export interface AgentCategory {
  id: string
  name: string
  code?: string
  [key: string]: unknown
}

export const getAgentCategory = withApiResponseHandler(
  async (): Promise<ApiResponse<AgentCategory[]>> => {
    const response = await request.get<AgentCategory[]>('/remote/agent/category')
    return normalizeApiResponse(response)
  }
)

export const getAgentCategory2 = withApiResponseHandler(
  async (): Promise<ApiResponse<AgentCategory[]>> => {
    const response = await request.get<AgentCategory[]>('/remote/agent/category2')
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体类型查询参数
 */
export interface AgentByTypeParams {
  type?: string
  page?: number
  pageSize?: number
  [key: string]: unknown
}

export const getAgentByType = withApiResponseHandler(
  async (params?: AgentByTypeParams): Promise<ApiResponse<AgentInfo[]>> => {
    const response = await request.get<AgentInfo[]>('/remote/agent/by/type', { params })
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体付费查询参数
 */
export interface AgentByPayParams {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

export const getAgentByPay = withApiResponseHandler(
  async (params?: AgentByPayParams): Promise<ApiResponse<AgentInfo[]>> => {
    const response = await request.get<AgentInfo[]>('/remote/agent/by/pay', { params })
    return normalizeApiResponse(response)
  }
)

export const getAgentByCollect = withApiResponseHandler(
  async (uuid: string, params?: AgentListOptions): Promise<ApiResponse<AgentInfo[]>> => {
    const response = await request.get<AgentInfo[]>(`/remote/agent/by/collect/${uuid}`, { params })
    return normalizeApiResponse(response)
  }
)

export const approveAgentTaskMessage = withApiResponseHandler(
  async (data: AgentTaskMessageApproveParams): Promise<ApiResponse<AgentTaskMessageApproveResponse>> => {
    const response = await request.post<AgentTaskMessageApproveResponse>('/remote/agent/task/send/message/approve', data)
    return normalizeApiResponse(response)
  }
)

export const addAgentNeedTask = withApiResponseHandler(
  async (data: AgentTaskNeedParams): Promise<ApiResponse<AgentTaskNeedResponse>> => {
    const response = await request.post<AgentTaskNeedResponse>('/remote/agent/task/need/task/add', data)
    return normalizeApiResponse(response)
  }
)

export const getAgentNeedTask = withApiResponseHandler(
  async (params?: AgentTaskNeedQueryParams): Promise<ApiResponse<AgentTaskNeedResponse[]>> => {
    const response = await request.get<AgentTaskNeedResponse[]>('/remote/agent/task/need/task', { params })
    return normalizeApiResponse(response)
  }
)

export const getAgentNeedTaskById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentTaskNeedResponse>> => {
    const response = await request.get<AgentTaskNeedResponse>(`/remote/agent/task/need/task/${id}`)
    return normalizeApiResponse(response)
  }
)
