import { COZE_PATHS } from '@/config/backend-paths'

/**
 * OAuth应用管理服务
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface OAuthApp {
  client_id: string
  client_secret: string
  app_name: string
  app_description?: string
  redirect_uris: string[]
  scopes: string[]
  app_type: string
  is_active: boolean
  created_at: string
}

export interface CreateOAuthAppRequest {
  app_name: string
  app_description?: string
  redirect_uris: string[]
  scopes?: string[]
  app_type?: string
}

// 创建OAuth应用
export const createOAuthApp = withApiResponseHandler(
  async (data: CreateOAuthAppRequest): Promise<ApiResponse<OAuthApp>> => {
    const response = await request.post<OAuthApp>(COZE_PATHS.oauth.appsCreate, data)
    return normalizeApiResponse(response)
  }
)

// 获取OAuth应用列表
export const getOAuthApps = withApiResponseHandler(async (): Promise<ApiResponse<OAuthApp[]>> => {
  const response = await request.get<OAuthApp[]>(COZE_PATHS.oauth.appsList)
  return normalizeApiResponse(response)
})

// 获取OAuth应用详情
export const getOAuthApp = withApiResponseHandler(
  async (clientId: string): Promise<ApiResponse<OAuthApp>> => {
    const response = await request.get<OAuthApp>(COZE_PATHS.oauth.appsById(clientId))
    return normalizeApiResponse(response)
  }
)

// 删除OAuth应用
export const deleteOAuthApp = withApiResponseHandler(
  async (clientId: string): Promise<ApiResponse<unknown>> => {
    const response = await request.delete(COZE_PATHS.oauth.appsById(clientId))
    return normalizeApiResponse(response)
  }
)
