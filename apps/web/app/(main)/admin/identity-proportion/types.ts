// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface IdentityProportion {
  id: string
  identityType: string
  gift: string | null
  tokenProportion: string | null
  vipGift: string | null
  routineProportion: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

export interface ListData {
  list: IdentityProportion[]
  total: number
}

export interface IdentityProportionForm {
  identityType: string
  gift: string
  tokenProportion: string
  vipGift: string
  routineProportion: string
  beginTime: string
  endTime: string
  status: boolean
}
