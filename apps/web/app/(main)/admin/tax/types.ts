// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type TaxStatus = 'active' | 'disabled'

export interface TaxRule {
  id: string
  name: string
  category: string
  rate: number
  threshold: number
  description: string | null
  status: TaxStatus
  effectiveAt: string | null
  createdAt: string | null
}

export interface TaxListData {
  list: TaxRule[]
  total: number
}
