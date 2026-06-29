/**
 * 智能体购买管理API
 * 对应后端路由：/agentBuy
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

// 智能体购买记录接口
export interface AgentBuy {
  id: string
  user_uuid: string
  agent_id: string
  agent_name: string
  agent_order_uuid: string // 开发者UUID
  buy_uuid: string // 购买人UUID
  buy_name: string // 购买人名称
  buy_time: string // 购买时间
  category_id: string
  discount: number // 折扣（百分比，如100表示无折扣）
  real_price: number // 实际价格（分）
  price: number // 标价（分）
  count: number // 购买数量（月数）
  expiration_date: string // 过期时间
  order_no: string // 订单号
  status: string // 订单状态：'0'=待支付, '1'=已支付, '2'=已取消
  settlement: string // 结算状态：'0'=未结算, '1'=已结算
  prologue?: string
  created_at: string
  updated_at: string
}

// 创建智能体购买记录
export const createAgentBuy = withApiResponseHandler(
  async (data: {
    agent_id: string
    agent_name: string
    agent_order_uuid: string
    buy_uuid: string
    buy_name: string
    category_id: string
    discount?: number
    real_price: number
    price: number
    count: number
    prologue?: string
  }): Promise<ApiResponse<AgentBuy>> => {
    const response = await request.post<AgentBuy>('/agentBuy', data)
    return normalizeApiResponse(response)
  }
)

export const buyAgent = withApiResponseHandler(
  async (data: {
    agent_id: string
    payment_method: 'coins' | 'wechat' | 'alipay'
    coupon_id?: string
    client_ip?: string
  }): Promise<
    ApiResponse<{ order_no: string; amount: number; pay_info?: unknown; expire_time?: string }>
  > => {
    try {
      const response = await request.post<{
        order_no: string
        amount: number
        pay_info?: unknown
        expire_time?: string
      }>('/agent/buy', data)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.warn('Agent purchase API fallback handling:', {
        error: error instanceof Error ? error.message : String(error),
        agentId: data.agent_id,
      })
      // 降级到备用API
      const mapped = await request.post<{
        order_no: string
        amount: number
        pay_info?: unknown
        expire_time?: string
      }>('/agentBuy', {
        agent_id: data.agent_id,
        agent_name: '',
        agent_order_uuid: '',
        buy_uuid: '',
        buy_name: '',
        category_id: '',
        real_price: 0,
        price: 0,
        count: 1,
        prologue: '',
      })
      return normalizeApiResponse(mapped)
    }
  }
)

// 获取智能体购买记录列表
export const getAgentBuyList = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      agent_id?: string
      buy_uuid?: string
      agent_order_uuid?: string
      order_no?: string
      status?: string
      settlement?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<PaginationResponse<AgentBuy>>> => {
    const response = await request.get('/agentBuy/list', {
      params: {
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        ...params,
      },
    })
    interface AgentBuyListResponse {
      list: AgentBuy[]
      total: number
      page: number
      page_size: number
    }
    const normalizedResponse = normalizeApiResponse<AgentBuyListResponse>(response)
    // 后端返回格式：{ success, message, data: [], total, page, page_size }
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const page_size = normalizedResponse.data?.page_size || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AgentBuy[],
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

// 获取智能体购买记录详情
export const getAgentBuyDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentBuy>> => {
    const response = await request.get<AgentBuy>(`/agentBuy/${id}`)
    return normalizeApiResponse(response)
  }
)

// 更新智能体购买记录
export const updateAgentBuy = withApiResponseHandler(
  async (data: {
    id: string
    agent_name?: string
    buy_name?: string
    discount?: number
    real_price?: number
    price?: number
    count?: number
    expiration_date?: string
    order_no?: string
    status?: string
    settlement?: string
  }): Promise<ApiResponse<AgentBuy>> => {
    const response = await request.put<AgentBuy>(`/agentBuy`, data)
    return normalizeApiResponse(response)
  }
)

// 删除智能体购买记录
export const deleteAgentBuy = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/agentBuy/${idsString}`)
    return normalizeApiResponse(response)
  }
)

// 导出智能体购买记录
export const exportAgentBuy = withApiResponseHandler(
  async (
    params?: {
      agent_id?: string
      buy_uuid?: string
      agent_order_uuid?: string
      order_no?: string
      status?: string
      settlement?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/agentBuy/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

// 确认支付
export const confirmAgentBuyPayment = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentBuy>> => {
    const response = await request.post<AgentBuy>(`/agentBuy/${id}/confirm`)
    return normalizeApiResponse(response)
  }
)
