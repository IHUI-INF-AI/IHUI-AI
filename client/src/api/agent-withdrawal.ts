// 2026-06-24 修复: 路径前缀对齐后端 /api/v1/*
import request from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'
import {
  withApiResponseHandler,
  normalizeApiResponse,
} from '@/utils/api-response'

// 提现记录接口
export interface AgentWithdrawal {
  id: string
  user_id: string
  out_bill_no?: string
  amount: number // 金额（分）
  type: number // 1=银行卡，2=支付宝，3=微信
  open_id?: string
  order_ids?: string
  initiate_at: number // 时间戳（毫秒）
  status: number // 0=待审核，1=审核中，2=审核通过，3=已提现，4=审核拒绝
  review_at?: number
  process_at?: number
  review_user?: string
  process_user?: string
  remark?: string
}

// 获取提现记录列表
export const getWithdrawalList = withApiResponseHandler(
  async (params: {
    user_id: string
    type: string // "1"=7日内，"2"=1个月内，"3"=1年内，"4"=所有数据
    page?: number
    page_size?: number
    withdrawal_no?: string
    withdrawal_type?: string
    status?: string
    min_amount?: number
    max_amount?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }): Promise<ApiResponse<PaginationResponse<AgentWithdrawal>>> => {
    const response = await request.get('/agentWithdrawalDetail/list', {
      params: {
        page: params.page || 1,
        page_size: params.page_size || 20,
        ...params,
      },
    })
    const normalizedResponse = normalizeApiResponse(response)
    // 后端返回格式：{ code, msg, data: [], total, page, page_size, total_pages }
    const data = (normalizedResponse.data as unknown[]) || []
    const total =
      (normalizedResponse as { total?: number }).total || (Array.isArray(data) ? data.length : 0)
    const page = (normalizedResponse as { page?: number }).page || params.page || 1
    const page_size =
      (normalizedResponse as { page_size?: number }).page_size || params.page_size || 20
    const total_pages =
      (normalizedResponse as { total_pages?: number }).total_pages || Math.ceil(total / page_size)

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AgentWithdrawal[],
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

// 创建提现申请
export const createWithdrawal = withApiResponseHandler(
  async (data: {
    user_id: string
    amount: number // 金额（元）
    type: number // 1=银行卡，2=支付宝，3=微信
    open_id?: string
    order_ids: string // 结算记录ID列表，逗号分隔
  }): Promise<ApiResponse<{ id: string; amount: number; settlement_updated: number }>> => {
    const response = await request.post('/api/v1/agents/apply', {
      ...data,
      amount: data.amount, // 前端传元，后端会转换为分
    })
    return normalizeApiResponse(response)
  }
)
