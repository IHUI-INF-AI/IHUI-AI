export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired'
export type PromotionType = 'discount' | 'fullReduction' | 'flash' | 'bundle' | 'seckill'

export interface PromotionRule {
  id: string
  name: string
  type: PromotionType
  threshold: number
  discount: number
  discountType: 'amount' | 'percent'
  scope: 'all' | 'category' | 'product'
  scopeRef: string | null
  priority: number
  status: PromotionStatus
  startTime: string | null
  endTime: string | null
  createdAt: string | null
}

export interface PromotionRuleListData {
  list: PromotionRule[]
  total: number
}
