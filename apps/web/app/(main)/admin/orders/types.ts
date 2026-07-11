import { fetchApi } from '@/lib/api'

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'
export type RefundStatus =
  'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'
export type InvoiceAppStatus =
  'pending' | 'approved' | 'rejected' | 'invoicing' | 'invoiced' | 'canceled'

export interface EduOrder {
  id: string
  orderNo: string
  userId: string
  orderType: string
  targetId?: string | null
  targetTitle?: string | null
  quantity: number
  originalPrice: string
  discountAmount: string
  payAmount: string
  payType?: string | null
  status: OrderStatus
  payTime?: string | null
  cancelTime?: string | null
  refundTime?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
}

export interface EduRefund {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason?: string | null
  refundAmount: string
  refundType: string
  status: RefundStatus
  applyTime?: string | null
  processTime?: string | null
  completeTime?: string | null
  processMessage?: string | null
  handleMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface EduInvoiceApplication {
  id: string
  orderId?: string | null
  userId: string
  invoiceType: string
  titleId?: string | null
  amount: string
  email?: string | null
  status: InvoiceAppStatus
  remark?: string | null
  createdAt: string
  updatedAt: string
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const ORDER_STATUS_CFG: Record<OrderStatus, { cls: string; dot: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  paid: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  cancelled: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
  refunded: { cls: 'bg-primary/10 text-primary', dot: 'bg-primary' },
}

export const REFUND_STATUS_CFG: Record<RefundStatus, { cls: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  approved: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  processing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500' },
  completed: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  failed: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
}

export const INVOICE_STATUS_CFG: Record<InvoiceAppStatus, { cls: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  approved: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  invoicing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500' },
  invoiced: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  canceled: { cls: 'bg-muted text-muted-foreground' },
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
