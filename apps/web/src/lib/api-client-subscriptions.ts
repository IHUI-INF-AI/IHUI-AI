// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  /** 划线原价(分);0 = 不展示原价(2026-09-16 立) */
  originalPrice: number
  /** 有效期(天);0 = 不过期 */
  validityDays: number
  /** 日窗口限额(token):-1 不限 / 0 未配置 / >0 上限 */
  dailyTokenLimit: number
  /** 周窗口限额(token) */
  weeklyTokenLimit: number
  /** 月窗口限额(token) */
  monthlyTokenLimit: number
  /** 套餐可用模型白名单(空数组 = 全部模型) */
  modelWhitelist: string[]
}

/** 订阅窗口额度状态(2026-09-16 立)。 */
export interface SubscriptionWindowStatus {
  windowType: 'daily' | 'weekly' | 'monthly'
  /** 限额 token:-1 不限 / 0 未配置 / >0 上限 */
  limit: number
  used: number
  /** 剩余 token;limit<=0 时为 -1 */
  remaining: number
  windowStart: string
  windowEnd: string
  /** 距离窗口重置的秒数 */
  resetsInSeconds: number
}

/** 当前订阅实例(含有效期)。 */
export interface ActiveSubscription {
  id: string
  planId: string | null
  planName: string
  startAt: string
  endAt: string
  autoRenew: boolean
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
  /** 当前订阅实例(含有效期);无活跃订阅为 null(2026-09-16 立) */
  subscription: ActiveSubscription | null
  /** 日/周/月窗口额度与重置倒计时;无活跃订阅为空数组(2026-09-16 立) */
  windows: SubscriptionWindowStatus[]
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
