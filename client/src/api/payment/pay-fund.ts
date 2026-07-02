/**
 * 支付资金 API (创建订单 / 微信支付 / 转账 / 提现)
 * 对接后端: payments 模块
 * 路由前缀: /api/v1/payments
 *
 * 注意: 后端接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface FundOrder {
  orderId: string
  amount: number
  productId: string
  orderType: string
  status: string
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
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
// 支付资金操作
// ===========================================================================

/** 创建订单 (后端使用 Query 参数) */
export async function payFundCreateOrder(params: {
  amount: number
  productId: string
  orderType: string
  userUuid?: string
}): Promise<ApiResponse<FundOrder>> {
  const res = await http.post('/api/v1/payments/createOrder', null, {
    params: {
      amount: params.amount,
      productId: params.productId,
      orderType: params.orderType,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<FundOrder>
}

/** 微信支付 (后端使用 Query 参数) */
export async function payFundWechatPay(params: {
  outTradeNo: string
  totalFee: number
  userUuid?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/payments/wechatPay', null, {
    params: {
      outTradeNo: params.outTradeNo,
      totalFee: params.totalFee,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 转账 (后端使用 Query 参数) */
export async function payFundTransfer(params: {
  amount: number
  bankAccount: string
  bankName: string
  userUuid?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/payments/transfer', null, {
    params: {
      amount: params.amount,
      bankAccount: params.bankAccount,
      bankName: params.bankName,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 提现 (后端使用 Query 参数) */
export async function payFundWithdrawal(params: {
  amount: number
  userUuid?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/payments/withdrawal', null, {
    params: {
      amount: params.amount,
      userUuid: params.userUuid || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const payFundApi = {
  payFundCreateOrder,
  payFundWechatPay,
  payFundTransfer,
  payFundWithdrawal,
}

export default payFundApi