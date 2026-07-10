export type Recordable = Record<string, any>

export interface ApiResponse<T = any> {
  code: number
  success: boolean
  message: string
  data: T
}

export interface PaginatedData<T = any> {
  list: T[]
  pagination: { total: number }
  items?: T[]
  total?: number
}
