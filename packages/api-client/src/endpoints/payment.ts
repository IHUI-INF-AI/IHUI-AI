/**
 * 支付相关 API
 * 合并迁移自旧架构：ali-pay, payment, refund, top-up, withdrawal, invoice
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

/** 支付订单状*/
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'

/** 支付方式 */
export type PaymentMethod = 'wechat' | 'alipay'

/** 支付订单 */
export interface PaymentOrder {
  orderNo: string
  amount: number
  subject?: string
  body?: string
  status: PaymentStatus
  paymentMethod?: PaymentMethod
  qrCode?: string
  paymentUrl?: string
  paidAt?: string
  createdAt: string
  [key: string]: unknown
}

/** 支付宝创建参*/
export interface AliPayCreateParams {
  orderNo?: string
  amount?: number
  subject?: string
  body?: string
  returnUrl?: string
  notifyUrl?: string
}

/** 支付宝支付响*/
export interface AlipayPayResponse {
  orderNo?: string
  status?: string
  message?: string
  code?: number
  success?: boolean
}

/** 支付宝通知参数 */
export interface AlipayNotifyParams {
  outTradeNo: string
  tradeNo: string
  tradeStatus: string
  totalAmount: number
  [key: string]: unknown
}

/** 退款申请请*/
export interface RefundRequest {
  orderNo: string
  reason: string
  amount?: number
  description?: string
}

/** 退款状*/
export type RefundStatus =
  'pending' | 'processing' | 'approved' | 'rejected' | 'completed' | 'failed'

/** 退款记*/
export interface RefundRecord {
  id: string
  orderNo: string
  refundNo: string
  amount: number
  reason: string
  description?: string
  status: RefundStatus
  statusText?: string
  rejectReason?: string
  approvedAt?: string
  completedAt?: string
  createTime: string
  updatedAt: string
  orderInfo?: {
    productName?: string
    totalAmount?: number
    paymentMethod?: string
  }
}

/** 退款申请响*/
export interface RefundResponse {
  refundNo: string
  orderNo: string
  amount: number
  status: RefundStatus
  message?: string
}

/** 退款审核请*/
export interface RefundAuditRequest {
  refundNo: string
  action: 'approve' | 'reject'
  comment?: string
}

/** 充值订*/
export interface TopUpOrder {
  orderId: string
  amount: number
  paymentMethod: PaymentMethod
  qrCode?: string
  paymentUrl?: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  createdAt: string
}

/** 充值状*/
export interface TopUpStatus {
  orderId: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  amount: number
  paidAt?: string
}

/** 提现记录 */
export interface WithdrawalRecord {
  id: string
  amount: number
  status: string
  createTime?: string
  updateTime?: string
  nickname?: string
  openId?: string
  reason?: string
  [key: string]: unknown
}

/** 发票信息 */
export interface InvoiceInfo {
  invoiceId: string
  downloadUrl: string
}

/** 发票请求参数 */
export interface InvoiceParams {
  type: 'personal' | 'company'
  title?: string
  taxNumber?: string
  address?: string
  phone?: string
  email?: string
}

// ===================== payment（支付订单统一入口=====================

/** 查询支付订单状*/
export async function checkPaymentStatus(
  orderNo: string,
): Promise<ApiResult<{ status?: string; paid?: boolean }>> {
  return fetchApi<{ status?: string; paid?: boolean }>(`/api/payments/wechat/status/${orderNo}`)
}

/** 关闭/取消支付订单 */
export async function cancelPaymentOrder(
  orderNo: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/payment/order/${orderNo}/close`, { method: 'POST' })
}

/** 同步支付状态（主动校验回调结果*/
export async function syncPaymentStatus(
  orderNo: string,
): Promise<ApiResult<{ verified?: boolean }>> {
  return fetchApi<{ verified?: boolean }>(`/api/payment/order/${orderNo}/sync`, { method: 'POST' })
}

/** 验证支付回调签名 */
export async function verifyPaymentCallback(
  params: Record<string, unknown>,
): Promise<ApiResult<{ valid?: boolean }>> {
  return fetchApi<{ valid?: boolean }>('/api/payment/callback/verify', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 获取支付订单列表 */
export async function getPaymentOrders(
  query: PageQuery = {},
): Promise<ApiResult<PageData<PaymentOrder>>> {
  return fetchApi<PageData<PaymentOrder>>(`/api/payments/me${buildQs(query)}`)
}

/** 获取支付订单详情 */
export async function getPaymentOrderDetail(orderNo: string): Promise<ApiResult<PaymentOrder>> {
  return fetchApi<PaymentOrder>(`/api/payment/orders/${orderNo}`)
}

// ===================== wechat-app（移动端 RN APP 支付） =====================

/** 微信 APP 支付签名参数（后端 appPrepay 返回，直接传给 react-native-wechat-lib） */
export interface WechatAppPaySignData {
  appid: string
  partnerid: string
  prepayid: string
  package: string
  noncestr: string
  timestamp: string
  sign: string
}

/** 微信 APP 支付下单响应 */
export interface WechatAppPayResponse {
  outTradeNo: string
  amount?: number
  /** 未配置微信支付时为 true（DEV 环境 mock） */
  mock?: boolean
  /** 签名参数（mock 模式下为空） */
  prepayData?: WechatAppPaySignData
}

/**
 * 创建微信 APP 支付订单（mobile-rn 端调用）。
 * amount 单位：分（整数）。返回 prepayData 直接传给 react-native-wechat-lib 调起支付。
 */
export async function createWechatAppPayment(params: {
  amount: number
  orderType?: number
  description?: string
}): Promise<ApiResult<WechatAppPayResponse>> {
  return fetchApi<WechatAppPayResponse>(
    `/api/payments/wechat/android/create${buildQs({
      amount: params.amount,
      orderType: params.orderType,
      description: params.description,
    })}`,
    { method: 'POST' },
  )
}

// ===================== ali-pay（支付宝=====================

/** 创建支付宝支*/
export async function createAliPay(data: AliPayCreateParams): Promise<ApiResult<string>> {
  return fetchApi<string>('/api/fund/ali/pay/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 创建支付宝支付（v2*/
export async function createAliPay2(data: AliPayCreateParams): Promise<ApiResult<string>> {
  return fetchApi<string>('/api/fund/ali/pay/create2', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 支付宝异步通知 */
export async function aliPayNotify(data: AlipayNotifyParams): Promise<ApiResult<void>> {
  return fetchApi<void>('/api/payments/alipay/notify', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 查询支付宝支付成功状*/
export async function getAliPaySuccess(orderNo?: string): Promise<ApiResult<AlipayPayResponse>> {
  return fetchApi<AlipayPayResponse>(`/api/payments/success${buildQs(orderNo ? { orderNo } : {})}`)
}

/** 查询支付宝支付失败状*/
export async function getAliPayFail(orderNo?: string): Promise<ApiResult<AlipayPayResponse>> {
  return fetchApi<AlipayPayResponse>(`/api/payments/fail${buildQs(orderNo ? { orderNo } : {})}`)
}

/** 支付宝同步返*/
export async function aliPayReturn(orderNo?: string): Promise<ApiResult<AlipayPayResponse>> {
  return fetchApi<AlipayPayResponse>(
    `/api/fund/ali/pay/alipay/return${buildQs(orderNo ? { orderNo } : {})}`,
  )
}

// ===================== refund（退款） =====================

/** 申请退*/
export async function applyRefund(data: RefundRequest): Promise<ApiResult<RefundResponse>> {
  return fetchApi<RefundResponse>('/api/refunds/apply', {
    method: 'POST',
    body: JSON.stringify({
      order_no: data.orderNo,
      reason: data.reason,
      amount: data.amount,
      description: data.description,
    }),
  })
}

/** 获取退款记录列*/
export async function getRefundList(
  query: PageQuery & {
    orderNo?: string
    refundNo?: string
    status?: RefundStatus
    startDate?: string
    endDate?: string
  } = {},
): Promise<ApiResult<PageData<RefundRecord>>> {
  return fetchApi<PageData<RefundRecord>>(`/api/refunds/me${buildQs(query)}`)
}

/** 获取退款记录详*/
export async function getRefundDetail(refundNo: string): Promise<ApiResult<RefundRecord>> {
  return fetchApi<RefundRecord>(`/api/payment/refund/${refundNo}`)
}

/** 取消退款申*/
export async function cancelRefund(
  refundNo: string,
): Promise<ApiResult<{ refundNo: string; status: string }>> {
  return fetchApi<{ refundNo: string; status: string }>(`/api/payment/refund/${refundNo}/cancel`, {
    method: 'POST',
  })
}

/** 查询退款状*/
export async function checkRefundStatus(refundNo: string): Promise<ApiResult<RefundRecord>> {
  return fetchApi<RefundRecord>(`/api/payment/refund/${refundNo}/status`)
}

/** 审核退款申请（管理员） */
export async function auditRefund(data: RefundAuditRequest): Promise<ApiResult<RefundRecord>> {
  return fetchApi<RefundRecord>(`/api/payment/refund/${data.refundNo}/audit`, {
    method: 'POST',
    body: JSON.stringify({
      action: data.action,
      comment: data.comment,
    }),
  })
}

/** 处理退款（管理员） */
export async function processRefund(refundNo: string): Promise<ApiResult<RefundRecord>> {
  return fetchApi<RefundRecord>(`/api/payment/refund/${refundNo}/process`, { method: 'POST' })
}

// ===================== top-up（充值） =====================

/** 创建充值订*/
export async function createTopUpOrder(input: {
  amount: number
  paymentMethod: PaymentMethod
}): Promise<ApiResult<TopUpOrder>> {
  return fetchApi<TopUpOrder>('/api/wallet/recharge', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      payment_method: input.paymentMethod,
    }),
  })
}

/** 查询充值状*/
export async function getTopUpStatus(orderId: string): Promise<ApiResult<TopUpStatus>> {
  return fetchApi<TopUpStatus>(`/api/top-up/status/${orderId}`)
}

/** 获取充值记录列*/
export async function getTopUpRecords(
  query: PageQuery = {},
): Promise<ApiResult<PageData<TopUpOrder>>> {
  return fetchApi<PageData<TopUpOrder>>(`/api/wallet/recharge/records${buildQs(query)}`)
}

// ===================== withdrawal（提现） =====================

/** 申请提现 */
export async function requestWithdrawal(input: {
  amount: number
  method?: string
  wechatAccount?: string
  alipayAccount?: string
  realName?: string
  bankName?: string
  bankAccount?: string
  remark?: string
}): Promise<ApiResult<WithdrawalRecord>> {
  return fetchApi<WithdrawalRecord>('/api/finance/withdrawal/withdrawal', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取提现审批状*/
export async function getWithdrawalStatus(
  nickname: string,
  openId: string,
): Promise<ApiResult<WithdrawalRecord>> {
  return fetchApi<WithdrawalRecord>('/api/finance/withdrawal/getWithdrawal', {
    method: 'POST',
    body: JSON.stringify({ nickname, openId }),
  })
}

/** 获取当前用户自己的提现记*/
export async function getMyWithdrawalRecords(
  query: PageQuery = {},
): Promise<ApiResult<PageData<WithdrawalRecord>>> {
  return fetchApi<PageData<WithdrawalRecord>>(`/api/finance/withdrawal/my-records${buildQs(query)}`)
}

/** 获取提现列表（管理员*/
export async function getWithdrawals(
  query: PageQuery & { status?: string } = {},
): Promise<ApiResult<PageData<WithdrawalRecord>>> {
  return fetchApi<PageData<WithdrawalRecord>>(`/api/finance/withdrawal/flows/list${buildQs(query)}`)
}

/** 获取提现详情（管理员*/
export async function getWithdrawalDetail(id: string): Promise<ApiResult<WithdrawalRecord>> {
  return fetchApi<WithdrawalRecord>(`/api/finance/withdrawal/flows/${id}`)
}

/** 审批提现（管理员*/
export async function approveWithdrawal(
  id: string,
  params?: Record<string, unknown>,
): Promise<ApiResult<WithdrawalRecord>> {
  return fetchApi<WithdrawalRecord>(`/api/finance/withdrawal/flows/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(params || {}),
  })
}

/** 拒绝提现（管理员*/
export async function rejectWithdrawal(
  id: string,
  reason?: string,
): Promise<ApiResult<WithdrawalRecord>> {
  return fetchApi<WithdrawalRecord>(`/api/finance/withdrawal/flows/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '审核未通过' }),
  })
}

// ===================== invoice（发票） =====================

/** 生成订单发票 */
export async function generateInvoice(
  orderId: string,
  invoiceData: InvoiceParams,
): Promise<ApiResult<InvoiceInfo>> {
  return fetchApi<InvoiceInfo>(`/api/invoices/applications`, {
    method: 'POST',
    body: JSON.stringify({ ...invoiceData, orderId }),
  })
}

/** 获取发票信息 */
export async function getInvoice(orderId: string): Promise<ApiResult<InvoiceInfo>> {
  return fetchApi<InvoiceInfo>(`/api/invoices/applications${buildQs({ orderId })}`)
}
