export interface Category {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
}

export interface ListData {
  list: Category[]
}

export interface CategoryForm {
  pid: string
  name: string
  sort: string
  status: boolean
}
