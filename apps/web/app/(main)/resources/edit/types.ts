export interface Category {
  id: string
  name: string
}

export interface ResourceDetail {
  id?: string
  title: string
  description: string
  categoryId: string
  url?: string
  fileName?: string
}
