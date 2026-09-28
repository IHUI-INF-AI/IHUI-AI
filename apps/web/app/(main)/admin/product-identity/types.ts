// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface ProductIdentity {
  id: string
  productName: string | null
  amount: string | null
  beginTime: string | null
  endTime: string | null
  defAmount: string | null
  status: number
  remark: string | null
}

export interface ListData {
  list: ProductIdentity[]
  total: number
}

export interface ProductIdentityForm {
  productName: string
  amount: string
  beginTime: string
  endTime: string
  defAmount: string
  status: boolean
  remark: string
}
