/**
 * API响应格式化工具
 * 提供API响应格式化和处理功能
 */

import type { ApiResponse } from '@/types/api'

/**
 * 规范化API响应
 */
export function normalizeApiResponse<T>(response: any): ApiResponse<T> {
  if (!response || typeof response !== 'object') {
    return { code: 500, msg: 'Invalid response format', data: undefined as T }
  }

  const res = response as { code?: number; data?: T; message?: string; msg?: string; success?: boolean }

  if (res.success === true || res.code === 200 || res.code === 0) {
    return {
      code: res.code || 200,
      data: res.data as T,
      msg: res.msg || res.message,
      success: true
    }
  }

  return {
    code: res.code || 500,
    msg: res.msg || res.message || 'Unknown error',
    data: undefined as T,
    success: false
  }
}

/**
 * 格式化API错误
 */
export function formatApiError(error: any): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

/**
 * 检查API响应是否成功
 */
export function isApiSuccess<T>(response: ApiResponse<T>): boolean {
  return response.code === 200 || response.code === 0 || response.success === true
}
