export interface Category {
  id: string
  name: string
  sort: number
  status: number
  createdAt: string
}

export interface ListData {
  list: Category[]
}

export interface CategoryForm {
  name: string
  sort: string
  status: boolean
}
