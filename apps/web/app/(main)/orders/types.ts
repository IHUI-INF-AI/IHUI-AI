// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
