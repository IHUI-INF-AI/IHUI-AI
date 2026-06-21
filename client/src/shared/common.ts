export type CommonStatus = 'active' | 'inactive' | 'deleted' | 'pending' | 'blocked'

export interface IdField {
  id: string
}

export interface NameField {
  name: string
}

export interface TimestampFields {
  createTime?: string
  updateTime?: string
}

export interface BaseEntity extends IdField, NameField, TimestampFields {
  status?: CommonStatus
}

export interface ResponseWrapper<T> {
  code: number
  message: string
  data: T
  success: boolean
  timestamp: number
}

export interface ErrorResponse {
  code: number
  message: string
  errors?: Array<{
    field?: string
    message: string
  }>
  timestamp: number
}

export interface OperationResult {
  success: boolean
  message?: string
  data?: any
}

export interface CreateParams<T = unknown> {
  data: T
}

export interface UpdateParams<T = unknown> {
  id: string
  data: Partial<T>
}

export interface DeleteParams {
  id: string
}

export interface GetParams {
  id: string
}

export interface ListParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  filters?: Record<string, unknown>
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FileUploadParams {
  file: File
  path?: string
  onProgress?: (progress: number) => void
}

export interface FileInfo {
  name: string
  size: number
  type: string
  url: string
  path?: string
}

export interface SortOption {
  field: string
  label: string
}

export interface PaginationMeta {
  total: number
  page: number
  pageSize: number
  totalPages: number
}
