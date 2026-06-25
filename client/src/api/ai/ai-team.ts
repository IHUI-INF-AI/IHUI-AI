/**
 * AI团队相关API
 * 对应后端路由：/cozeZhsApi/agent-category
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import type { Agent } from '@/api/agent/agent/agents'

// AI团队列表响应
export interface AITeamListResponse {
  list: Agent[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

// 获取AI团队列表（参考移动端：/cozeZhsApi/agent-category/agent/${id}）
export const getAITeamList = withApiResponseHandler(
  async (params?: {
    categoryId?: string
    page?: number
    page_size?: number
  }): Promise<ApiResponse<AITeamListResponse>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const page = params?.page || 1
      const pageSize = params?.page_size || 10
      const list: Agent[] = Array.from({ length: pageSize }).map((_, i) => ({
        id: `agent-${page}-${i + 1}`,
        name: `AI团队成员${i + 1}`,
        description: `这是AI团队成员${i + 1}的描述`,
        avatar: '/images/common/userIcon.svg',
        platform: 'internal' as const,
        status: 'active',
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          list,
          pagination: { page, page_size: pageSize, total: 100, total_pages: 10 },
        },
        timestamp: Date.now(),
      }
    }
    // 参考移动端：/cozeZhsApi/agent-category/agent/${id} 或 /agents/list
    const response = await request.get<AITeamListResponse>('/agents/list', {
      params: {
        category: params?.categoryId,
        page: params?.page,
        page_size: params?.page_size,
      },
    })
    return normalizeApiResponse(response)
  }
)
