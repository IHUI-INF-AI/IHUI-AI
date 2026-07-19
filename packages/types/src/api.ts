export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  errorCode?: string
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export type ApiResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; status?: number; errorCode?: string; retryAfter?: number }
