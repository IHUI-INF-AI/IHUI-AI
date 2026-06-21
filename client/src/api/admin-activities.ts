/**
 * 管理后台 - 活动/操作日志 API
 * 后端约定：/admin/activities 分页列表
 */
import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { seedFallbackB } from '@/utils/seedData'

export interface AdminActivity {
  id: string
  userId: string
  userName: string
  type: string
  status: string
  ip: string
  device: string
  description: string
  createdAt: string
}

export interface AdminActivityListParams extends PaginationParams {
  type?: string
  status?: string
  keyword?: string
}

export interface AdminActivityListResult {
  list: AdminActivity[]
  total: number
}

export async function getAdminActivities(
  params?: AdminActivityListParams
): Promise<ApiResponse<AdminActivityListResult>> {
  try {
    const response = await request.get<AdminActivityListResult>('/admin/activities', { params })
    return normalizeApiResponse(response)
  } catch (_e) {
    // P15.1 seedData fallback
    return seedFallbackB('activities', params) as any
  }
}
