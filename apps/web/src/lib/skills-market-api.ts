import { fetchApi } from '@/lib/api'
import type {
  SkillMarketListResponse,
  SkillInstallResponse,
  SkillRating,
  SkillMarketQuery,
  SkillRateRequest,
  SkillPublishRequest,
  SkillMarketEntry,
  SkillSubscriptionResponse,
  SkillNotification,
} from '@ihui/shared/skills/market'

export const SKILL_MARKET_PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchSkillsMarket(params: SkillMarketQuery): Promise<SkillMarketListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? SKILL_MARKET_PAGE_SIZE),
  })
  if (params.q) qs.set('q', params.q)
  if (params.tag) qs.set('tag', params.tag)
  return api<SkillMarketListResponse>(`/api/skills/market?${qs.toString()}`)
}

export function installSkill(name: string): Promise<SkillInstallResponse> {
  return api<SkillInstallResponse>(`/api/skills/${encodeURIComponent(name)}/install`, {
    method: 'POST',
  })
}

export function rateSkill(name: string, body: SkillRateRequest): Promise<SkillRating> {
  return api<SkillRating>(`/api/skills/${encodeURIComponent(name)}/rate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchSkillRatings(name: string): Promise<SkillRating[]> {
  return api<SkillRating[]>(`/api/skills/${encodeURIComponent(name)}/ratings`)
}

export function publishSkill(body: SkillPublishRequest): Promise<SkillMarketEntry> {
  return api<SkillMarketEntry>(`/api/skills/market`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function subscribeSkill(name: string): Promise<SkillSubscriptionResponse> {
  return api<SkillSubscriptionResponse>(`/api/skills/${encodeURIComponent(name)}/subscribe`, {
    method: 'POST',
  })
}

export function unsubscribeSkill(name: string): Promise<SkillSubscriptionResponse> {
  return api<SkillSubscriptionResponse>(`/api/skills/${encodeURIComponent(name)}/subscribe`, {
    method: 'DELETE',
  })
}

export function fetchSkillSubscription(name: string): Promise<SkillSubscriptionResponse> {
  return api<SkillSubscriptionResponse>(`/api/skills/${encodeURIComponent(name)}/subscription`)
}

export function fetchSkillNotifications(): Promise<SkillNotification[]> {
  return api<SkillNotification[]>(`/api/skills/notifications`)
}

export function markSkillNotificationsRead(): Promise<{ marked: number }> {
  return api<{ marked: number }>(`/api/skills/notifications/read`, {
    method: 'POST',
  })
}
