/**
 * 第三方OAuth登录API
 * 对应后端路由：/cozeZhsApi/oauth
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 二维码响应
export interface QRCodeResponse {
  qrCodeUrl: string
  state: string
  expiresIn: number
  loginId?: string // 支付宝专用
}

// OAuth状态响应
export interface OAuthStatusResponse {
  status: 'pending' | 'success' | 'expired' | 'failed'
  token?: string
  refreshToken?: string
  user?: {
    uuid: string
    username: string
    nickname: string
    avatar?: string
    isVip: boolean
  }
}

// OAuth回调请求
export interface OAuthCallbackRequest {
  code: string // 微信使用
  authCode?: string // 支付宝使用
  state: string
}

// 支付订单创建请求
export interface PaymentOrderRequest {
  outTradeNo: string
  subject: string // 支付宝使用
  description?: string // 微信使用
  totalAmount: number // 支付宝使用（元）
  amount?: number // 微信使用（分）
  body?: string // 支付宝使用
  openId?: string // 微信使用
}

// 支付订单响应
export interface PaymentOrderResponse {
  payForm?: string // 支付宝支付表单HTML
  prepayId?: string // 微信预支付ID
  package?: string // 微信支付包
  timeStamp?: string // 微信时间戳
  nonceStr?: string // 微信随机字符串
  signType?: string // 微信签名类型
  paySign?: string // 微信支付签名
  outTradeNo: string
}

// ========== 支付宝OAuth ==========

// 获取支付宝登录二维码
export const getAlipayQRCode = withApiResponseHandler(
  async (): Promise<ApiResponse<QRCodeResponse>> => {
    const response = await request.get<QRCodeResponse>(COZE_PATHS.oauthAlipay.qrCode)
    return normalizeApiResponse(response)
  }
)

// 检查支付宝登录状态
export const checkAlipayStatus = withApiResponseHandler(
  async (params: {
    loginId?: string
    state?: string
  }): Promise<ApiResponse<OAuthStatusResponse>> => {
    const response = await request.get<OAuthStatusResponse>(
      COZE_PATHS.oauthAlipay.checkStatus,
      { params }
    )
    return normalizeApiResponse(response)
  }
)

// 处理支付宝回调
export const handleAlipayCallback = withApiResponseHandler(
  async (data: OAuthCallbackRequest): Promise<ApiResponse<null>> => {
    const response = await request.post<null>(COZE_PATHS.oauthAlipay.callback, {
      authCode: data.authCode || data.code,
      state: data.state,
    })
    return normalizeApiResponse(response)
  }
)

// ========== 支付相关 ==========

// 创建支付宝支付订单
export const createAlipayOrder = withApiResponseHandler(
  async (data: PaymentOrderRequest): Promise<ApiResponse<PaymentOrderResponse>> => {
    const response = await request.post<PaymentOrderResponse>(COZE_PATHS.payment.alipayCreate, {
      outTradeNo: data.outTradeNo,
      subject: data.subject,
      totalAmount: data.totalAmount,
      body: data.body,
    })
    return normalizeApiResponse(response)
  }
)

// 创建微信支付订单
export const createWeChatOrder = withApiResponseHandler(
  async (data: PaymentOrderRequest): Promise<ApiResponse<PaymentOrderResponse>> => {
    const response = await request.post<PaymentOrderResponse>(COZE_PATHS.payment.wechatCreate, {
      outTradeNo: data.outTradeNo,
      description: data.description || data.subject,
      amount: data.amount || Math.round(data.totalAmount * 100),
      openId: data.openId,
    })
    return normalizeApiResponse(response)
  }
)

// 创建银行卡支付订单
export const createCardPaymentOrder = withApiResponseHandler(
  async (data: PaymentOrderRequest & {
    cardNumber?: string
    cardHolder?: string
    expiryDate?: string
    cvv?: string
  }): Promise<ApiResponse<PaymentOrderResponse & {
    paymentUrl?: string
    redirectUrl?: string
  }>> => {
    const response = await request.post<PaymentOrderResponse & {
      paymentUrl?: string
      redirectUrl?: string
    }>(COZE_PATHS.payment.cardCreate, {
      outTradeNo: data.outTradeNo,
      subject: data.subject,
      totalAmount: data.totalAmount,
      body: data.body,
      cardNumber: data.cardNumber,
      cardHolder: data.cardHolder,
      expiryDate: data.expiryDate,
      cvv: data.cvv,
    })
    return normalizeApiResponse(response)
  }
)
