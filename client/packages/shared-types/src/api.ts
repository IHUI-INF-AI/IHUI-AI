export interface ApiResponse<T = unknown> {
  code: number | string
  msg?: string
  message?: string
  data?: T
  success?: boolean
  timestamp?: number
  traceId?: string
}

export interface PaginationParams {
  page?: number
  pageNum?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

export interface PaginationResponse<T> {
  items?: T[]
  list?: T[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}
