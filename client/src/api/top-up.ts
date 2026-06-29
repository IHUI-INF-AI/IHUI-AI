import { COZE_PATHS } from '@/config/backend-paths'

/**
 * 充值系统API
 * 对应后端路由：/cozeZhsApi/top-up
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 充值订单
export interface TopUpOrder {
  order_id: string
  amount: number
  payment_method: 'wechat' | 'alipay'
  qr_code?: string // 支付二维码（base64）
  payment_url?: string // 支付链接
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  created_at: string
}

// 充值状态
export interface TopUpStatus {
  order_id: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  amount: number
  paid_at?: string
}

// 创建充值订单
export const createTopUpOrder = withApiResponseHandler(
  async (params: {
    amount: number
    payment_method: 'wechat' | 'alipay'
  }): Promise<ApiResponse<TopUpOrder>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          order_id: `topup-${Date.now()}`,
          amount: params.amount,
          payment_method: params.payment_method,
          qr_code:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<TopUpOrder>(COZE_PATHS.topUp.create, params)
    return normalizeApiResponse(response)
  }
)

// 查询充值状态
export const getTopUpStatus = withApiResponseHandler(
  async (orderId: string): Promise<ApiResponse<TopUpStatus>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          order_id: orderId,
          status: 'paid',
          amount: 100,
          paid_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<TopUpStatus>(COZE_PATHS.topUp.status(orderId))
    return normalizeApiResponse(response)
  }
)
