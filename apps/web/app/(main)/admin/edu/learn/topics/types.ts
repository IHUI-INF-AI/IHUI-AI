// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Topic {
  id: string
  title: string
  slug: string | null
  sort: number | null
  image: string
  cidList: string[] | null
  lidList: string[] | null
  status: string
  description: string
  price: string | null
  originalPrice: string | null
  isShowIndex: boolean
  createdAt: string
  updatedAt: string
}

export interface TForm {
  title: string
  slug: string
  sort: number
  image: string
  cidList: string[]
  lidList: string[]
  description: string
  price: string
  originalPrice: string
  status: string
  isShowIndex: boolean
}
