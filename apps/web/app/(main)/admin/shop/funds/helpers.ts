import { fetchApi } from '@/lib/api'
import type { FundFlow } from './types'

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const TYPE_LABEL: Record<FundFlow['type'], string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
  withdraw: '提现',
}

export async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}
