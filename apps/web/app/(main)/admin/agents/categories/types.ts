// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}

export interface CategoryForm {
  name: string
  description: string
  icon: string
  sort: string
  status: boolean
  isPaid: boolean
}
