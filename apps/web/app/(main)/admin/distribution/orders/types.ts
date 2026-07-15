export interface Order {
  id: string
  orderNo?: string
  orderId?: string
  userId?: string
  userNickname?: string
  productName?: string
  amount: number
  orderAmount?: number
  commissionAmount?: number
  rate?: number
  status: string
  createdAt: string
}

export interface ListData {
  items?: Order[]
  list?: Order[]
  total?: number
}

export const PAGE_SIZE = 20

export const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-muted text-muted-foreground',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-500',
  refunded: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

export const STATUS_LABEL: Record<string, string> = {
  pending: '待结算',
  paid: '已支付',
  settled: '已结算',
  approved: '已通过',
  cancelled: '已取消',
  rejected: '已拒绝',
  refunded: '已退款',
}

export const fmtYuan = (n: number) => `¥${(n / 100).toFixed(2)}`
