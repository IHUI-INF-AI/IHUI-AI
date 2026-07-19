export type PointsProductStatus = 'on' | 'off' | 'soldout'

export interface PointsProduct {
  id: string
  name: string
  cover: string | null
  category: 'virtual' | 'physical' | 'coupon' | 'vip'
  pointsCost: number
  stock: number
  sold: number
  limitPerUser: number
  status: PointsProductStatus
  startTime: string | null
  endTime: string | null
  createdAt: string | null
}

export interface PointsProductListData {
  list: PointsProduct[]
  total: number
}
