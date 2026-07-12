import { fetchApi } from '@/lib/api'
import type { SettlementData } from './types'

export const PAGE_SIZE = 20
export const STATUS_OPTIONS = ['unsettled', 'settled']

export const STATUS_CLASS: Record<string, string> = {
  unsettled: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
}

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchSettlements(params: {
  page: number
  status: string
  agentId: string
  orderNo: string
}): Promise<SettlementData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  if (params.agentId) qs.set('agentId', params.agentId)
  if (params.orderNo) qs.set('orderNo', params.orderNo)
  return api<SettlementData>(`/api/settlement/list?${qs.toString()}`)
}

export function createMoneyFmt(locale: string): (n: number) => string {
  const f = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  return (n: number) => f.format(n / 100)
}
