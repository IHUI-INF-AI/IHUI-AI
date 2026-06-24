/**
 * api/payment.ts - 支付订单查询/关闭/同步接口
 *
 * 统一支付入口，转发到 ali-pay / unified-wechat 等后端支付服务。
 * 智能体广场相关接口已迁移到 api/agent-plaza.ts。
 */
import request from '@/utils/request'

/** 后端统一响应体 {code, msg, data, timestamp} */
interface ApiEnvelope<T = unknown> {
  code?: number
  msg?: string
  data?: T
  timestamp?: number
}

/** 查询支付订单状态 */
export async function checkPaymentStatus(orderNo: string): Promise<{ data?: { status?: string; paid?: boolean } }> {
  const response = await request({
    url: `/payment/order/${orderNo}/status`,
    method: 'GET',
    base: 0,
  })
  const body = (response as { data?: ApiEnvelope<any> })?.data
  return { data: body?.data }
}

/** 关闭/取消支付订单 */
export async function cancelPaymentOrder(orderNo: string): Promise<{ message?: string }> {
  const response = await request({
    url: `/payment/order/${orderNo}/close`,
    method: 'POST',
    base: 0,
  })
  const body = (response as { data?: ApiEnvelope })?.data
  return { message: body?.msg }
}

/** 同步支付状态（主动校验回调结果） */
export async function syncPaymentStatus(orderNo: string): Promise<{ data?: { verified?: boolean } }> {
  const response = await request({
    url: `/payment/order/${orderNo}/sync`,
    method: 'POST',
    base: 0,
  })
  const body = (response as { data?: ApiEnvelope<any> })?.data
  return { data: body?.data }
}

/** 验证支付回调签名（用于后端回调校验） */
export async function verifyPaymentCallback(params: Record<string, unknown>): Promise<{ data?: { valid?: boolean } }> {
  const response = await request({
    url: '/payment/callback/verify',
    method: 'POST',
    data: params,
    base: 0,
  })
  const body = (response as { data?: ApiEnvelope<any> })?.data
  return { data: body?.data }
}
