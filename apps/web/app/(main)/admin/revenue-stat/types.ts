export interface RevenuePoint {
  date: string
  gross: number
  net: number
  refund: number
}

export interface RevenueOverview {
  totalRevenue: number
  monthRevenue: number
  todayRevenue: number
  totalOrders: number
  paidOrders: number
  refundAmount: number
  refundCount: number
  netRevenue: number
  arpu: number
}

export interface ChannelRevenue {
  channel: string
  amount: number
  orders: number
}

export interface RevenueStatResponse {
  overview: RevenueOverview
  trend: RevenuePoint[]
  byChannel: ChannelRevenue[]
  byProduct: { productId: string; name: string; amount: number; count: number }[]
}
