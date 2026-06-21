export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'timeout'
  | 'cancelled'
  | 'refunded'
  | number

export interface OrderItem {
  id?: string | number
  orderId?: string | number
  productId?: string | number
  productName?: string
  quantity?: number
  price?: number
  [key: string]: unknown
}

export interface Order {
  id?: string | number
  orderNo?: string
  userId?: string | number
  userUuid?: string
  amount?: number
  status?: OrderStatus
  paymentMethod?: string
  createTime?: string
  payTime?: string
  items?: OrderItem[]
  type?: string
  [key: string]: unknown
}

export interface VipPackage {
  id?: string | number
  name?: string
  level?: number | string
  price?: number
  duration?: number
  tokenQuota?: number
  features?: string[]
  description?: string
  [key: string]: unknown
}
