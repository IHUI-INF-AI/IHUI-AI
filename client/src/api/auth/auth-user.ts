import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse } from '@/types/api'

export interface AuthUser {
  id?: string
  userId?: string
  realName?: string
  idCard?: string
  idCardFront?: string
  idCardBack?: string
  status?: number
  auditStatus?: number
  auditRemark?: string
  createdAt?: string
  updatedAt?: string
}

export const createAuthUser = withApiResponseHandler(
  async (data: AuthUser): Promise<ApiResponse<AuthUser>> => {
    const response = await request.post<AuthUser>('/auth/user', data)
    return normalizeApiResponse(response)
  }
)
