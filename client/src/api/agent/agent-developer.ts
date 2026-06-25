import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 开发者续费记录接口
export interface AgentDeveloper {
  id: string
  uuid?: string
  user_name?: string
  creator_id?: string
  creator_name?: string
  bug_time?: string
  type?: string // "0"=月，"1"=年
  count?: number // 购买数量
  expiration_date?: string
  order_no?: string
}

// 获取开发者续费记录列表
export const getDeveloperList = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      uuid?: string
      user_name?: string
      creator_id?: string
      type?: string
      order_no?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<PaginationResponse<AgentDeveloper>>> => {
    const response = await request.get(COZE_PATHS.agentDeveloper.list, {
      params: {
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        ...params,
      },
    })
    const normalizedResponse = normalizeApiResponse(response)
    // 后端返回格式：{ success, message, data: [], total, page, page_size }
    const data = (normalizedResponse.data as unknown[]) || []
    const total =
      (normalizedResponse as { total?: number }).total || (Array.isArray(data) ? data.length : 0)
    const page = (normalizedResponse as { page?: number }).page || params?.page || 1
    const page_size =
      (normalizedResponse as { page_size?: number }).page_size || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AgentDeveloper[],
        pagination: {
          page,
          pageSize: page_size,
          total,
          totalPages: Math.ceil(total / page_size),
        },
      },
    }
  }
)

// 创建开发者续费记录
export const createDeveloper = withApiResponseHandler(
  async (data: {
    uuid: string
    user_name?: string
    creator_id?: string
    creator_name?: string
    type: string // "0"=月，"1"=年
    count: number
  }): Promise<ApiResponse<AgentDeveloper>> => {
    const response = await request.post(COZE_PATHS.agentDeveloper.create, data)
    return normalizeApiResponse(response)
  }
)

// 获取开发者续费记录详情
export const getDeveloperDetail = withApiResponseHandler(
  async (record_id: string): Promise<ApiResponse<AgentDeveloper>> => {
    const response = await request.get(COZE_PATHS.agentDeveloper.byId(record_id))
    return normalizeApiResponse(response)
  }
)
