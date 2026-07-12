import { fetchApi } from '@/lib/api'
import type { PerfItem } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function buildPerfCards(
  perf: PerfItem | undefined,
  t: (k: string) => string,
): { label: string; value: string | number; color: string }[] {
  if (!perf) return []
  return [
    { label: t('monitor.cpu'), value: `${perf.cpu}%`, color: 'text-primary' },
    { label: t('monitor.memory'), value: `${perf.memory}%`, color: 'text-primary' },
    { label: t('monitor.qps'), value: perf.qps, color: 'text-emerald-600' },
    { label: t('monitor.avgResponse'), value: `${perf.avgResponse}ms`, color: 'text-purple-600' },
  ]
}
