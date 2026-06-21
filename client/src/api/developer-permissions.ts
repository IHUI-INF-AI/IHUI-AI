import { COZE_PATHS } from '@/config/backend-paths'

/**
 * 开发者权限管理API
 * 对应后端路由：/cozeZhsApi/developer
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 开发者信息接口
export interface DeveloperInfo {
  id: string
  user_uuid: string
  coze_id?: string
  coze_name?: string
  type: number // 类型：0=普通开发者, 1=高级开发者
  status: number // 状态：0=禁用, 1=启用
  username?: string
  nickname?: string
  email?: string
  phone?: string
  agent_count?: number // 创建的智能体数量
  settlement_stats?: {
    settled_count: number
    settled_amount: number
  }
  created_at: string
  updated_at: string
}

// 开发者列表分页信息
export interface DeveloperListResponse {
  list: DeveloperInfo[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

// 申请成为开发者
export const applyDeveloper = withApiResponseHandler(
  async (data?: {
    coze_id?: string
    coze_name?: string
  }): Promise<ApiResponse<{ developer_id: string }>> => {
    const response = await request.post<{ developer_id: string }>(
      COZE_PATHS.developer.apply,
      data || {}
    )
    return normalizeApiResponse(response)
  }
)

// 获取开发者信息
export const getDeveloperInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<DeveloperInfo>> => {
    const response = await request.get<DeveloperInfo>(COZE_PATHS.developer.info)
    return normalizeApiResponse(response)
  }
)

// 获取开发者列表（管理员）
export const getDeveloperList = withApiResponseHandler(
  async (params?: {
    page?: number
    page_size?: number
    status?: number
  }): Promise<ApiResponse<DeveloperListResponse>> => {
    const response = await request.get<DeveloperListResponse>(COZE_PATHS.developer.list, {
      params,
    })
    return normalizeApiResponse(response)
  }
)

// 设置用户身份（管理员）
export const setUserIdentity = withApiResponseHandler(
  async (data: {
    user_uuid: string
    type: number // 0=平民, 1=贵族, 2=王族, 3=工部（开发者）
    token_quantity?: string
  }): Promise<ApiResponse<null>> => {
    const response = await request.post<null>(COZE_PATHS.developer.setIdentity, data)
    return normalizeApiResponse(response)
  }
)

// 更新开发者状态（管理员）
export const updateDeveloperStatus = withApiResponseHandler(
  async (id: string, status: number): Promise<ApiResponse<null>> => {
    const response = await request.put<null>(COZE_PATHS.developer.statusById(id), { status })
    return normalizeApiResponse(response)
  }
)

// 获取权限列表（预留接口）
export const getPermissions = withApiResponseHandler(async (): Promise<ApiResponse<unknown[]>> => {
  // 注意：后端可能没有此接口，这里先预留
  const response = await request.get<unknown[]>(COZE_PATHS.developer.permissions)
  return normalizeApiResponse(response)
})

// 设置权限（预留接口）
export const setPermissions = withApiResponseHandler(
  async (data: any): Promise<ApiResponse<null>> => {
    // 注意：后端可能没有此接口，这里先预留
    const response = await request.post<null>(COZE_PATHS.developer.permissions, data)
    return normalizeApiResponse(response)
  }
)
