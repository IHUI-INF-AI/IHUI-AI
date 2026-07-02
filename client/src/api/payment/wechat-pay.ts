/**
 * 微信支付 API (下单 / 查询 / 关单 / 退款 / 状态)
 * 对接后端: payments/wechat 模块
 * 路由前缀: /api/v1/payments/wechat
 *
 * 注意: 不包含回调端点 (notify/notify/refund/notify/transfer)。
 * 后端 create/query/close/refund 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface WxPayOrder {
  outTradeNo: string
  amount: number
  productId: string
  orderType: string
  status: string
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 微信支付下单
// ===========================================================================

/** 创建支付订单 (后端使用 Query 参数) */
export async function wechatPayCreate(params: {
  amount: number
  productId: string
  orderType: string
  openId?: string
  description?: string
  userUuid?: string
}): Promise<ApiResponse<WxPayOrder>> {
  const res = await http.post('/api/v1/payments/wechat/create', null, {
    params: {
      amount: params.amount,
      productId: params.productId,
      orderType: params.orderType,
      openId: params.openId || undefined,
      description: params.description || undefined,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WxPayOrder>
}

/** 创建支付订单 (Android, 后端使用 Query 参数) */
export async function wechatPayCreateAndroid(params: {
  amount: number
  productId: string
  orderType: string
  description?: string
  userUuid?: string
}): Promise<ApiResponse<WxPayOrder>> {
  const res = await http.post('/api/v1/payments/wechat/android/create', null, {
    params: {
      amount: params.amount,
      productId: params.productId,
      orderType: params.orderType,
      description: params.description || undefined,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WxPayOrder>
}

/** 创建课程支付订单 (后端使用 Query 参数) */
export async function wechatPayCreateCourse(params: {
  amount: number
  courseId: string
  userUuid?: string
}): Promise<ApiResponse<WxPayOrder>> {
  const res = await http.post('/api/v1/payments/wechat/course/create', null, {
    params: {
      amount: params.amount,
      courseId: params.courseId,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WxPayOrder>
}
// ===========================================================================
// 微信支付查询 / 关单 / 退款 / 状态
// ===========================================================================

/** 查询订单 (后端使用 Query 参数) */
export async function wechatPayQuery(outTradeNo: string): Promise<ApiResponse<WxPayOrder | null>> {
  const res = await http.post('/api/v1/payments/wechat/query', null, {
    params: { outTradeNo },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WxPayOrder | null>
}

/** 按交易号查询订单 (后端使用 Query 参数) */
export async function wechatPayQueryByTradeNo(outTradeNo: string): Promise<ApiResponse<WxPayOrder | null>> {
  const res = await http.post('/api/v1/payments/wechat/query/by-trade-no', null, {
    params: { outTradeNo },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WxPayOrder | null>
}

/** 关闭订单 (后端使用 Query 参数) */
export async function wechatPayClose(outTradeNo: string): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/payments/wechat/close', null, {
    params: { outTradeNo },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 退款 (后端使用 Query 参数) */
export async function wechatPayRefund(params: {
  outTradeNo: string
  refundAmount: number
  reason?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/payments/wechat/refund', null, {
    params: {
      outTradeNo: params.outTradeNo,
      refundAmount: params.refundAmount,
      reason: params.reason || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 查询支付状态 */
export async function wechatPayCheckStatus(outTradeNo: string): Promise<ApiResponse<unknown>> {
  const res = await http.get(`/api/v1/payments/wechat/status/${outTradeNo}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 连续订阅产品 */
export async function wechatPayConsecutiveProduct(userUuid?: string): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/payments/wechat/consecutive/product', {
    params: { userUuid: userUuid || undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const wechatPayApi = {
  wechatPayCreate,
  wechatPayCreateAndroid,
  wechatPayCreateCourse,
  wechatPayQuery,
  wechatPayQueryByTradeNo,
  wechatPayClose,
  wechatPayRefund,
  wechatPayCheckStatus,
  wechatPayConsecutiveProduct,
}

export default wechatPayApi