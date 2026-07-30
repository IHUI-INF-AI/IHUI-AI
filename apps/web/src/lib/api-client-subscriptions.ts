/**
 * API 订阅 web 端 api-client(P0-6 中转站产品化,2026-07-31 立)。
 *
 * 3 个函数:
 * - fetchApiSubscriptionPlans: 拉取 3 档订阅方案
 * - fetchUserSubscriptionStatus: 查询当前用户订阅状态
 * - subscribeApiPlan: 创建订阅订单,返回 orderNo + checkoutUrl
 *
 * 复用 @/lib/api 的 fetchApi 包装(401 自动弹登录弹窗)。
 */
import { fetchApi } from './api'
import type { ApiResult } from '@ihui/types'

/** 订阅方案信息(与 api-subscription-service.PlanInfo 一致)。 */
export interface PlanInfo {
  id: string
  name: string
  description: string | null
  price: number
  interval: string
  features: string[]
  billingPeriod: string
}

/** 订阅历史记录。 */
export interface SubscriptionRecord {
  orderId: string
  orderNo: string
  planId: string
  planName: string
  amount: number
  paidAt: string | null
  status: string
}

/** 用户订阅状态。 */
export interface UserSubscriptionStatus {
  activePlan: PlanInfo | null
  remainingTokens: number
  history: SubscriptionRecord[]
}

/** 订阅页面 GET 返回结构。 */
export interface SubscriptionsData {
  status: UserSubscriptionStatus
  plans: PlanInfo[]
}

/** 创建订阅订单返回结构。 */
export interface SubscribeResult {
  orderNo: string
  amount: number
  planId: string
  planName: string
  payMethod: string
  checkoutUrl: string
}

/** 拉取订阅方案 + 当前用户订阅状态。 */
export async function fetchApiSubscriptionPlans(): Promise<ApiResult<SubscriptionsData>> {
  return fetchApi<SubscriptionsData>('/api/developer/relay/subscriptions')
}

/** 查询当前用户订阅状态(仅 status,不含 plans 列表)。 */
export async function fetchUserSubscriptionStatus(): Promise<ApiResult<UserSubscriptionStatus>> {
  const r = await fetchApi<SubscriptionsData>('/api/developer/relay/subscriptions')
  if (!r.success) return r
  return { success: true, data: r.data.status }
}

/** 创建订阅订单。 */
export async function subscribeApiPlan(
  planId: string,
  payMethod: string,
): Promise<ApiResult<SubscribeResult>> {
  return fetchApi<SubscribeResult>('/api/developer/relay/subscriptions/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, payMethod }),
  })
}
