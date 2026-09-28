// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  sales?: number
  desc?: string
  images?: string | string[]
  status: 'online' | 'offline'
  type?: string
  denomination?: string
  denominationVip?: string
  denominationOperate?: string
  createdAt: string
}

export interface ListData {
  list: Product[]
  total: number
}

export interface ProductForm {
  name: string
  category: string
  price: string
  stock: string
  sales: string
  desc: string
  images: string[]
  status: boolean
  type: string
  denomination: string
  denominationVip: string
  denominationOperate: string
}

export interface ProductSearch {
  name: string
  category: string
  status: string
  type: string
}
