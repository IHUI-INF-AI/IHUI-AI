// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult, VipCompareRow } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'
import type { VipOrderResult, VipPayInfo } from './member.js'

export interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits?: Record<string, unknown> | null
  status: number
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface VipBenefit {
  id: string
  title: string
  description: string
  icon: string | null
  level: number
  category: string
}

export interface MembershipInfo {
  userId: string
  level: number
  levelName: string
  startTime: string
  expireTime: string | null
  isPermanent: boolean
  isActive: boolean
  daysRemaining: number
}

export interface PointsInfo {
  balance: number
  totalEarned: number
  totalSpent: number
  todaySignedIn: boolean
  continuousDays: number
}

export interface Coupon {
  id: string
  name: string
  type: 'discount' | 'deduction'
  value: number
  minAmount: number
  category: string | null
  startTime: string
  expireTime: string
  status: 'unused' | 'used' | 'expired'
  usedAt: string | null
}

/**
 * 后端真身:apps/api/src/routes/vip.ts 的 GET /vip/levels 返回 success({ items: levels }),
 * data 是 `{ items }` 包一层的对象而非裸数组(2026-11-06 逐字核对修正;此前泛型写成 VipLevel[]
 * 导致调用方 `.data.map` 结构上永远取不到档位)。
 */
export async function getVipLevels(): Promise<ApiResult<{ items: VipLevel[] }>> {
  return fetchApi<{ items: VipLevel[] }>('/api/vip/levels')
}

/**
 * GET /api/vip-compare —— 三档 VIP 权益对比行。
 * 后端真身 apps/api/src/routes/vip.ts:250-256:`success(rows)`,rows 为裸数组
 * (feature + basic/premium/enterprise 三列取值 ✓/—),行类型复用 @ihui/types 的
 * VipCompareRow(app-growth.ts:89)⇒ data = VipCompareRow[],与 RN 共享屏同一份契约。
 */
export async function getVipCompare(): Promise<ApiResult<VipCompareRow[]>> {
  return fetchApi<VipCompareRow[]>('/api/vip-compare')
}

export async function getVipBenefits(
  query: { level?: number } = {},
): Promise<ApiResult<VipBenefit[]>> {
  // 后端缺失
  return fetchApi<VipBenefit[]>(`/vip/benefits${buildQs(query)}`)
}

export async function getMembershipInfo(): Promise<ApiResult<MembershipInfo>> {
  return fetchApi<MembershipInfo>('/api/vip/my')
}

export async function getPoints(): Promise<ApiResult<PointsInfo>> {
  return fetchApi<PointsInfo>('/points')
}

export async function signIn(): Promise<
  ApiResult<{
    points: number
    continuousDays: number
  }>
> {
  return fetchApi<{ points: number; continuousDays: number }>('/api/sign-in', {
    method: 'POST',
  })
}

export async function getCoupons(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<Coupon>>> {
  return fetchApi<PageData<Coupon>>(`/api/coupons/verify${buildQs(query)}`)
}

/**
 * POST /api/vip/order —— 创建 VIP 订单 + 预下单。
 * 后端真身 apps/api/src/routes/vip.ts:345:
 * success({ orderId, orderNo, amount, vipLevelId, quantity, payInfo }),与 member.ts 的
 * VipOrderResult 逐字对账(2026-11-06)。quantity 缺省 1,与端内旧封装 upgradeVip 行为一致。
 */
export async function upgradeVip(
  vipLevelId: string,
  input: { paymentMethod?: string; quantity?: number; openId?: string } = {},
): Promise<ApiResult<VipOrderResult>> {
  return fetchApi<VipOrderResult>('/api/vip/order', {
    method: 'POST',
    body: JSON.stringify({ vipLevelId, quantity: 1, ...input }),
  })
}

/**
 * GET /api/vip/order/:orderNo/payinfo —— 获取支付参数(prepay_id 过期时重新预下单)。
 * 后端真身 apps/api/src/routes/vip.ts:374-435:三个出口分别为
 * success({ status: 'paid' }) / success({ status: <order.status> }) /
 * success({ status: 'pending', payInfo }),⇒ data = { status: string; payInfo?: VipPayInfo }。
 */
export async function getVipOrderPayInfo(
  orderNo: string,
): Promise<ApiResult<{ status: string; payInfo?: VipPayInfo }>> {
  return fetchApi<{ status: string; payInfo?: VipPayInfo }>(`/api/vip/order/${orderNo}/payinfo`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
