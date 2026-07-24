import { fetchApi } from '@/lib/api'
import type { ThreatDashboardData } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchThreatDashboard(): Promise<ThreatDashboardData> {
  return api<ThreatDashboardData>('/api/security/threat-dashboard')
}

export function scoreClass(score: number): string {
  if (score >= 80) return 'text-red-600'
  if (score >= 50) return 'text-orange-600'
  if (score >= 20) return 'text-yellow-600'
  return 'text-green-600'
}

export function scoreBgClass(score: number): string {
  if (score >= 80) return 'bg-red-500'
  if (score >= 50) return 'bg-orange-500'
  if (score >= 20) return 'bg-yellow-500'
  return 'bg-green-500'
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
