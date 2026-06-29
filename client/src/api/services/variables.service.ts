import { COZE_PATHS } from '@/config/backend-paths'

/**
 * 变量管理服务
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface Variable {
  name: string
  value: unknown
  type?: string
  description?: string
}

export interface VariableRetrieveRequest {
  bot_id: string
  name: string
  token?: string
  base_url?: string
}

export interface VariableListRequest {
  bot_id: string
  token?: string
  base_url?: string
}

export interface VariableUpdateRequest {
  bot_id: string
  name: string
  value: unknown
  token?: string
  base_url?: string
}

export interface VariableCreateRequest {
  bot_id: string
  name: string
  value: unknown
  token?: string
  base_url?: string
}

export interface VariableDeleteRequest {
  bot_id: string
  name: string
  token?: string
  base_url?: string
}

// 获取变量
export const retrieveVariable = withApiResponseHandler(
  async (data: VariableRetrieveRequest): Promise<ApiResponse<Variable>> => {
    const response = await request.post<Variable>(COZE_PATHS.variables.retrieve, data)
    return normalizeApiResponse(response)
  }
)

// 获取变量列表
export const listVariables = withApiResponseHandler(
  async (data: VariableListRequest): Promise<ApiResponse<Variable[]>> => {
    const response = await request.post<Variable[]>(COZE_PATHS.variables.list, data)
    return normalizeApiResponse(response)
  }
)

// 更新变量
export const updateVariable = withApiResponseHandler(
  async (data: VariableUpdateRequest): Promise<ApiResponse<Variable>> => {
    const response = await request.post<Variable>(COZE_PATHS.variables.update, data)
    return normalizeApiResponse(response)
  }
)

// 创建变量
export const createVariable = withApiResponseHandler(
  async (data: VariableCreateRequest): Promise<ApiResponse<Variable>> => {
    const response = await request.post<Variable>(COZE_PATHS.variables.base, data)
    return normalizeApiResponse(response)
  }
)

// 删除变量
export const deleteVariable = withApiResponseHandler(
  async (data: VariableDeleteRequest): Promise<ApiResponse<unknown>> => {
    const response = await request.delete(COZE_PATHS.variables.base, { data })
    return normalizeApiResponse(response)
  }
)
