export interface Template {
  id: string
  name: string
  description: string | null
  config: unknown
  createdAt: string
}

export interface PageData<T> {
  list: T[]
  total: number
}

export interface TForm {
  name: string
  description: string
  config: string
}
