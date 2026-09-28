// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Product {
  id: string
  resourceId: string
  resourceName: string | null
  name: string
  price: string
  originalPrice: string | null
  description: string | null
  isPublished: boolean
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface Resource {
  id: string
  title: string
  isPublished: boolean
}

export interface ProductsData {
  list: Product[]
  total: number
  page: number
  pageSize: number
}

export interface ResourcesData {
  list: Resource[]
  total: number
}

export interface ProductForm {
  resourceId: string
  name: string
  price: string
  originalPrice: string
  description: string
  isPublished: boolean
  sort: string
}
