export interface TagItem {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string | null
  color?: string | null
  createdAt?: string
}

export interface TagForm {
  name: string
  description: string
  color: string
}
