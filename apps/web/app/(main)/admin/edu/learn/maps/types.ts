export interface Map {
  id: string
  title: string
  description: string | null
  cover: string | null
  sort: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface MForm {
  title: string
  description: string
  cover: string
  sort: string
  isPublished: boolean
}
