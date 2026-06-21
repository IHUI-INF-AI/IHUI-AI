import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse } from '@/types/api'

export interface AliPayCreateParams {
  orderNo?: string
  amount?: number
  subject?: string
  body?: string
  returnUrl?: string
  notifyUrl?: string
}

export const createAliPay = withApiResponseHandler(
  async (data: AliPayCreateParams): Promise<ApiResponse<string>> => {
    const response = await request.post<string>('/fund/ali/pay/create', data)
    return normalizeApiResponse(response)
  }
)

export const createAliPay2 = withApiResponseHandler(
  async (data: AliPayCreateParams): Promise<ApiResponse<string>> => {
    const response = await request.post<string>('/fund/ali/pay/create2', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 支付宝通知参数
 */
export interface AlipayNotifyParams {
  out_trade_no: string
  trade_no: string
  trade_status: string
  total_amount: number
  [key: string]: any
}

export const aliPayNotify = withApiResponseHandler(
  async (data: AlipayNotifyParams): Promise<ApiResponse<void>> => {
    const response = await request.post<void>('/fund/ali/pay/alipay/notify', data)
    return normalizeApiResponse(response)
  }
)

// 定义支付宝支付响应类型
export interface AlipayPayResponse {
  orderNo?: string
  status?: string
  message?: string
  code?: number
  success?: boolean
}

export const getAliPaySuccess = withApiResponseHandler(
  async (params?: { orderNo?: string }): Promise<ApiResponse<AlipayPayResponse>> => {
    const response = await request.get<AlipayPayResponse>('/fund/ali/pay/success', { params })
    return normalizeApiResponse(response)
  }
)

export const getAliPayFail = withApiResponseHandler(
  async (params?: { orderNo?: string }): Promise<ApiResponse<AlipayPayResponse>> => {
    const response = await request.get<AlipayPayResponse>('/fund/ali/pay/fail', { params })
    return normalizeApiResponse(response)
  }
)

export const aliPayReturn = withApiResponseHandler(
  async (params?: { orderNo?: string }): Promise<ApiResponse<AlipayPayResponse>> => {
    const response = await request.get<AlipayPayResponse>('/fund/ali/pay/alipay/return', { params })
    return normalizeApiResponse(response)
  }
)
