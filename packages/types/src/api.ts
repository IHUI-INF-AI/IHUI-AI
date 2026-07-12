export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export type ApiResult<T> =
  { success: true; data: T } | { success: false; error: string; status?: number }
