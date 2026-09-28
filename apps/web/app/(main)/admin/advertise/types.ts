// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Advertise {
  id: string
  title: string
  position: string
  imageUrl: string | null
  linkUrl: string | null
  sort: number
  status: number
  createdAt: string
}

export interface ListData {
  list: Advertise[]
  total: number
}

export interface AdvertiseForm {
  title: string
  position: string
  imageUrl: string
  linkUrl: string
  sort: string
  status: boolean
}
