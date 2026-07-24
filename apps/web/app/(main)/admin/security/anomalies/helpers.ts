import { fetchApi } from '@/lib/api'
import type { AnomalyListData, AnomalyQuery } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchAnomalies(query: AnomalyQuery): Promise<AnomalyListData> {
  const qs = new URLSearchParams()
  if (query.limit !== undefined) qs.set('limit', String(query.limit))
  if (query.offset !== undefined) qs.set('offset', String(query.offset))
  if (query.minScore !== undefined) qs.set('minScore', String(query.minScore))
  if (query.ip) qs.set('ip', query.ip)
  const queryStr = qs.toString()
  return api<AnomalyListData>(`/api/security/anomalies${queryStr ? `?${queryStr}` : ''}`)
}

export function scoreClass(score: number): string {
  if (score >= 80) return 'text-red-600'
  if (score >= 50) return 'text-orange-600'
  if (score >= 20) return 'text-yellow-600'
  return 'text-green-600'
}

export function recommendationLabel(r: string): string {
  switch (r) {
    case 'block':
      return '阻断'
    case 'monitor':
      return '监控'
    case 'allow':
      return '放行'
    default:
      return r
  }
}

export function recommendationClass(r: string): string {
  switch (r) {
    case 'block':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'monitor':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'allow':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ts))
}

export const PAGE_SIZE = 20
