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
