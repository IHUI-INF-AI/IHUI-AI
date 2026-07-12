export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export interface OrderRow {
  id: string
  orderNo: string
  orderType: string
  targetTitle: string | null
  payAmount: string
  status: OrderStatus
  createdAt: string
  [key: string]: unknown
}

export interface OrdersData {
  list: OrderRow[]
  total: number
  page: number
  pageSize: number
}
