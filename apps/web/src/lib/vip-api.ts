import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export interface VipLevel {
  id: string
  name: string
  level: number
  price: number
  originalPrice: number | null
  duration: number
  durationUnit: string
  benefits: string[]
  icon: string | null
  isPopular: boolean
  sort: number
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

export async function getVipLevels(): Promise<ApiResult<VipLevel[]>> {
  return fetchApi<VipLevel[]>('/auth-vip-level/list')
}

export async function getVipBenefits(
  query: { level?: number } = {},
): Promise<ApiResult<VipBenefit[]>> {
  return fetchApi<VipBenefit[]>(`/vip/benefits${buildQs(query)}`)
}

export async function getMembershipInfo(): Promise<ApiResult<MembershipInfo>> {
  return fetchApi<MembershipInfo>('/membership/info')
}

export async function getPoints(): Promise<ApiResult<PointsInfo>> {
  return fetchApi<PointsInfo>('/points')
}

export async function signIn(): Promise<ApiResult<{
  points: number
  continuousDays: number
}>> {
  return fetchApi<{ points: number; continuousDays: number }>('/points/sign-in', {
    method: 'POST',
  })
}

export async function getCoupons(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<Coupon>>> {
  return fetchApi<PageData<Coupon>>(`/coupons${buildQs(query)}`)
}
