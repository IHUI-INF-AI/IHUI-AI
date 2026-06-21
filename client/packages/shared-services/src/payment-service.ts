import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export interface WechatPayInput {
  uuid: string
  openId: string
  desc: string
  amount: number
  id: string
  productType: string
  payType?: string
}

export interface WechatPayOptions {
  appEndpoint?: boolean
}

export interface TokenCountInput {
  id: string | number
  quantity: number
  remarks?: string
}

export async function initiateWechatPay(
  adapter: SharedRequestAdapter,
  input: WechatPayInput,
  options: WechatPayOptions = {},
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: options.appEndpoint
      ? API_ENDPOINTS.PAYMENT.APP_INITIATE_PAY
      : API_ENDPOINTS.PAYMENT.INITIATE_PAY,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: input,
  })

  return normalizeApiResponse(response)
}

export async function getTokenCount(
  adapter: SharedRequestAdapter,
  input: TokenCountInput,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.RESOURCE.TOKEN_COUNT,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: input,
  })

  return normalizeApiResponse(response)
}

export async function getTokenReturn(
  adapter: SharedRequestAdapter,
  userContextId: string | number,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.RESOURCE.TOKEN_RETURN,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: { userContextId },
  })

  return normalizeApiResponse(response)
}

export async function closePaymentOrderStatus(
  adapter: SharedRequestAdapter,
  openId: string,
  outTradeNo: string,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.PAYMENT.UPDATE_STATUS,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: { openId, outTradeNo },
  })

  return normalizeApiResponse(response)
}

export async function cancelPaymentOrderByTradeNo(
  adapter: SharedRequestAdapter,
  openId: string,
  outTradeNo: string,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.PAYMENT.CLOSE_ORDER,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: { openId, outTradeNo },
  })

  return normalizeApiResponse(response)
}

export async function getConsecutivePaymentProduct(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request({
    url: API_ENDPOINTS.PAYMENT.CONSECUTIVE_PRODUCT,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })

  return normalizeApiResponse(response)
}
