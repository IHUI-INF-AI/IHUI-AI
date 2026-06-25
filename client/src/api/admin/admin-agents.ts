/**
 * 管理后台 - Agent 列表 API
 * 后端约定：/admin/agents 分页列表
 */
import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { seedFallbackB } from '@/utils/seedData'

export interface AdminAgent {
  id: string
  name: string
  avatar: string
  model: string
  status: string
  description: string
  createdAt: string
}

export interface AdminAgentListParams extends PaginationParams {
  status?: string
  keyword?: string
}

export interface AdminAgentListResult {
  list: AdminAgent[]
  total: number
}

export async function getAdminAgents(
  params?: AdminAgentListParams
): Promise<ApiResponse<AdminAgentListResult>> {
  try {
    const response = await request.get<AdminAgentListResult>('/admin/agents', { params })
    return normalizeApiResponse(response)
  } catch (_e) {
    // P15.1 seedData fallback
    return seedFallbackB('users', params) as any
  }
}
