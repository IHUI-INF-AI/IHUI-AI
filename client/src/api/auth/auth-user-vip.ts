import request from '../../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

/**
 * 用户VIP信息接口
 * 对应后端接口: /auth_user_vip
 */
export interface AuthUserVip {
  id?: string
  userId?: string
  /** 会员等级名称（如"普通会员"、"黄金会员"等）- 后端主要字段 */
  vipLevel?: string
  /** 会员等级名称（冗余字段） */
  vipLevelName?: string
  /** 成长值/经验值 */
  progress?: number
  /** VIP状态: 0-未激活, 1-已激活 */
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface AuthUserVipListParams {
  page?: number
  pageSize?: number
  userId?: string
  vipLevel?: string
  status?: number
}

export const updateAuthUserVip = withApiResponseHandler(
  async (data: AuthUserVip): Promise<ApiResponse<AuthUserVip>> => {
    const response = await request.put<AuthUserVip>('/auth_user_vip', data)
    return normalizeApiResponse(response)
  }
)

export const createAuthUserVip = withApiResponseHandler(
  async (data: AuthUserVip): Promise<ApiResponse<AuthUserVip>> => {
    const response = await request.post<AuthUserVip>('/auth_user_vip', data)
    return normalizeApiResponse(response)
  }
)

export const exportAuthUserVip = withApiResponseHandler(
  async (params?: AuthUserVipListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_user_vip/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAuthUserVipById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthUserVip>> => {
    const response = await request.get<AuthUserVip>(`/auth_user_vip/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAuthUserVipList = withApiResponseHandler(
  async (params?: AuthUserVipListParams): Promise<ApiResponse<PageResult<AuthUserVip>>> => {
    const response = await request.get<PageResult<AuthUserVip>>('/auth_user_vip/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAuthUserVip = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_user_vip/${idsString}`)
    return normalizeApiResponse(response)
  }
)
