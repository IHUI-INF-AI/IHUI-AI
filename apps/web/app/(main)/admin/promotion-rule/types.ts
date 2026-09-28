// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
