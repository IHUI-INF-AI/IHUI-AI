import { t } from '@/utils/i18n'

/**
 * 智能体分类管理API
 * 对应后端路由：/agentCategory
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { AGENT_CATEGORY_PATHS } from '@/config/backend-paths'

// 智能体分类配置接口
export interface AgentCategory {
  id: string
  agent_id: string
  agent_name: string
  create_uuid: string
  create_name: string
  create_time: string
  agent_main_category: string // 智能体大类：'1'=文本, '2'=图片, '3'=视频
  agent_category: string // 智能体细分
  type: string // 类型：'1'=免费, '2'=限免, '3'=付费
  type_child?: string // 子类型：'1'=月, '2'=年, '3'=永久
  account?: number // 价格（分）
  group?: string // 分组：'1'=VIP, '2'=普通
  limit_free?: number // 限免次数
  discount_month?: string // 折扣月份：'1'=6个月后八折, '2'=9个月后7折, '3'=1年后5折
  prologue?: string // 简介
}

// 分类统计信息
export interface AgentCategoryStats {
  total: number
  total_agents: number
  total_developers: number
  free_count: number
  limit_free_count: number
  paid_count: number
  text_count: number
  image_count: number
  video_count: number
}

// 批量查询结果
export interface BatchQueryResult {
  data: AgentCategory[]
  found_count: number
  not_found_ids: string[]
}

// 创建智能体分类配置（如果已存在则更新）
export const createAgentCategory = withApiResponseHandler(
  async (data: {
    agent_id: string
    agent_name: string
    create_uuid: string
    create_name: string
    agent_main_category: string
    agent_category: string
    type: string
    type_child?: string
    account?: number
    group?: string
    limit_free?: number
    discount_month?: string
    prologue?: string
  }): Promise<ApiResponse<AgentCategory>> => {
    const response = await request.post<AgentCategory>(AGENT_CATEGORY_PATHS.create, data)
    return normalizeApiResponse(response)
  }
)

// 获取智能体分类配置列表
export const getAgentCategoryList = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      agent_id?: string
      agent_name?: string
      create_uuid?: string
      type?: string
      agent_main_category?: string
      order_no?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<PaginationResponse<AgentCategory>>> => {
    const response = await request.get(AGENT_CATEGORY_PATHS.list, {
      params: {
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        ...params,
      },
    })
    const normalizedResponse = normalizeApiResponse(response)
    // 后端返回格式：{ success, message, data: [], total, page, page_size, total_pages }
    const data = (normalizedResponse.data as unknown[]) || []
    const total =
      (normalizedResponse as { total?: number }).total || (Array.isArray(data) ? data.length : 0)
    const page = (normalizedResponse as { page?: number }).page || params?.page || 1
    const page_size =
      (normalizedResponse as { page_size?: number }).page_size || params?.pageSize || 20
    const total_pages =
      (normalizedResponse as { total_pages?: number }).total_pages || Math.ceil(total / page_size)

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AgentCategory[],
        pagination: {
          page,
          pageSize: page_size,
          total,
          totalPages: total_pages,
        },
      },
    }
  }
)

// 获取智能体分类配置详情
export const getAgentCategoryDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentCategory>> => {
    const response = await request.get<AgentCategory>(`/agentCategory/${id}`)
    return normalizeApiResponse(response)
  }
)

// 批量查询智能体分类配置
export const batchQueryAgentCategory = withApiResponseHandler(
  async (ids: string[]): Promise<ApiResponse<BatchQueryResult>> => {
    const response = await request.post<BatchQueryResult>(
      '/agentCategory/batch-query',
      { ids }
    )
    return normalizeApiResponse(response)
  }
)

// 获取分类统计信息
export const getAgentCategoryStats = withApiResponseHandler(
  async (): Promise<ApiResponse<AgentCategoryStats>> => {
    const response = await request.get<AgentCategoryStats>('/agentCategory/stats')
    return normalizeApiResponse(response)
  }
)

// 更新智能体分类配置
export const updateAgentCategory = withApiResponseHandler(
  async (data: {
    id: string
    agent_name?: string
    agent_main_category?: string
    agent_category?: string
    type?: string
    type_child?: string
    account?: number
    group?: string
    limit_free?: number
    discount_month?: string
    prologue?: string
  }): Promise<ApiResponse<AgentCategory>> => {
    const response = await request.put<AgentCategory>(`/agentCategory`, data)
    return normalizeApiResponse(response)
  }
)

// 删除智能体分类配置
export const deleteAgentCategory = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/agentCategory/${idsString}`)
    return normalizeApiResponse(response)
  }
)

// 根据智能体ID获取分类配置
export const getAgentCategoryByAgentId = withApiResponseHandler(
  async (agentId: string): Promise<ApiResponse<AgentCategory>> => {
    const result = await getAgentCategoryList({ agent_id: agentId })
    if (result.data && Array.isArray(result.data.list) && result.data.list.length > 0) {
      return {
        ...result,
        data: result.data.list[0],
      }
    }
    return {
      code: 404,
      message: t('api.agent_category.未找到分类配置'),
      data: {} as AgentCategory,
      success: false,
      timestamp: Date.now(),
    }
  }
)

// 导出智能体分类配置
export const exportAgentCategory = withApiResponseHandler(
  async (
    params?: {
      agent_id?: string
      agent_name?: string
      create_uuid?: string
      type?: string
      agent_main_category?: string
      order_no?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/agentCategory/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
