import { fetchApi } from '@/lib/api'
import type { ExchangeRateForm } from './types'

export const th = 'px-4 py-2.5 font-medium'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY: ExchangeRateForm = {
  fromCurrency: '',
  toCurrency: '',
  rate: '',
  status: 1,
}
