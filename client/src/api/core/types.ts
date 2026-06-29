/**
 * API 核心类型定义
 * 
 * @description 统一的 API 请求/响应类型定义
 * @packageDocumentation
 */

/**
 * 统一 API 响应格式
 * 
 * @template T - 响应数据类型
 */
export interface ApiResponse<T = unknown> {
  /** 响应状态码 */
  code: number
  /** 响应是否成功 */
  success: boolean
  /** 响应消息 */
  message: string
  /** 响应数据 */
  data: T | undefined
  /** 响应时间戳 */
  timestamp?: number
}

/**
 * API 错误响应
 */
export interface ApiError {
  /** 错误码 */
  code: number | string
  /** 错误消息 */
  message: string
  /** 错误详情 */
  details?: unknown
  /** 错误堆栈（仅开发环境） */
  stack?: string
  /** 错误类型 */
  type?: 'business' | 'network' | 'timeout' | 'system'
}

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 当前页码（从 1 开始） */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总记录数 */
  total: number
  /** 总页数 */
  totalPages: number
}

/**
 * 分页响应
 * 
 * @template T - 列表项类型
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** 分页信息 */
  pagination: PaginationInfo
}

/**
 * 分页响应别名（兼容旧代码）
 */
export type PaginationResponse<T> = PaginatedResponse<T>

/**
 * 列表查询参数
 */
export interface ListParams extends PaginationParams {
  /** 搜索关键词 */
  keyword?: string
  /** 状态筛选 */
  status?: string | number
  /** 开始时间 */
  startTime?: string
  /** 结束时间 */
  endTime?: string
  /** 额外筛选条件 */
  [key: string]: unknown
}

/**
 * 基础实体类型
 */
export interface BaseEntity {
  /** 唯一标识 */
  id: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/**
 * 创建数据传输对象类型
 * 排除 id 和时间戳字段
 */
export type CreateDTO<T> = Omit<T, keyof BaseEntity>

/**
 * 更新数据传输对象类型
 * 所有字段可选，排除 id 和时间戳
 */
export type UpdateDTO<T> = Partial<Omit<T, keyof BaseEntity>>

/**
 * 请求配置
 */
export interface RequestConfig {
  /** 请求 URL */
  url?: string
  /** 请求方法 */
  method?: HttpMethod
  /** URL 参数 */
  params?: Record<string, unknown>
  /** 请求体数据 */
  data?: unknown
  /** 基础 URL 索引 */
  base?: number
  /** 请求超时时间（毫秒） */
  timeout?: number
  /** 是否显示加载状态 */
  showLoading?: boolean
  /** 是否显示错误消息 */
  showError?: boolean
  /** 是否静默处理错误 */
  silent?: boolean
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 重试次数 */
  retryCount?: number
}

/**
 * API 请求配置（RequestConfig 别名）
 */
export type ApiRequestConfig = RequestConfig

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  /** 基础 URL */
  baseURL?: string
  /** 默认超时时间 */
  timeout?: number
  /** 是否启用重试 */
  retry?: boolean
  /** 重试次数 */
  retryCount?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
  /** 默认请求头 */
  headers?: Record<string, string>
}

/**
 * 服务选项
 */
export interface ServiceOptions {
  /** 是否静默处理错误 */
  silent?: boolean
  /** 是否显示加载状态 */
  showLoading?: boolean
  /** 是否显示错误消息 */
  showError?: boolean
}

/**
 * HTTP 方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/**
 * API 成功码
 */
export const API_SUCCESS_CODES = [200, 0, '200', '0'] as const

/**
 * 检查响应是否成功
 */
export function isApiSuccess<T>(response: ApiResponse<T>): boolean {
  return API_SUCCESS_CODES.includes(response.code as typeof API_SUCCESS_CODES[number]) || 
         response.success === true
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T, message = 'success'): ApiResponse<T> {
  return {
    code: 200,
    success: true,
    message,
    data,
    timestamp: Date.now(),
  }
}

/**
 * 创建错误响应
 */
export function createErrorResponse<T = null>(
  code: number, 
  message: string, 
  data: T = null as T
): ApiResponse<T> {
  return {
    code,
    success: false,
    message,
    data,
    timestamp: Date.now(),
  }
}
