import type * as React from 'react'
import { Clock, CheckCircle, XCircle, Wallet } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import type { OrderStatus, OrdersData } from './types'

export const PAGE_SIZE = 20

export async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchOrders(params: {
  page: number
  status: string
  orderType: string
}): Promise<OrdersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  if (params.orderType !== 'all') qs.set('orderType', params.orderType)
  return api<OrdersData>(`/api/orders/me?${qs.toString()}`)
}

export const STATUS_CONFIG: Record<
  OrderStatus,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  pending: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  paid: { icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  cancelled: { icon: XCircle, cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  refunded: { icon: Wallet, cls: 'bg-primary/10 text-primary' },
}

export const STATUS_TABS: {
  value: string
  labelKey: 'all' | 'pending' | 'paid' | 'cancelled' | 'refunded'
}[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

export const TYPE_TABS: { value: string; labelKey: 'all' | 'course' | 'card' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'course', labelKey: 'course' },
  { value: 'card', labelKey: 'card' },
]

export const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
