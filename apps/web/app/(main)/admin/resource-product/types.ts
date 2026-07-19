export interface ResourceProduct {
  id: string
  resourceId: string
  name: string
  price: string
  originalPrice: string | null
  description: string | null
  isPublished: boolean
  sort: number
  createdAt: string
  updatedAt: string
}

export interface ResourceProductListData {
  list: ResourceProduct[]
  total: number
  page: number
  pageSize: number
}

export interface ResourceProductForm {
  resourceId: string
  name: string
  price: string
  originalPrice: string
  description: string
  isPublished: boolean
  sort: string
}
