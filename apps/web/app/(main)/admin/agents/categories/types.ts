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
