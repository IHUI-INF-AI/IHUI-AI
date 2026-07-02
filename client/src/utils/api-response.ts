/**
 * API响应处理工具
 */

/**
 * 标准API响应接口
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  success: boolean
  timestamp: number
  isMockData?: boolean
  mockMessage?: string
}

/**
 * API响应处理函数类型
 */
export type ApiResponseHandler<T = unknown> = (...args: unknown[]) => Promise<ApiResponse<T>>

/**
 * 网络错误类型
 */
export interface NetworkError extends Error {
  isNetworkError: boolean
  code?: string
  response?: unknown
}

/**
 * 判断是否为网络错误
 * @param error 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: unknown): error is NetworkError {
  const err = error as { code?: string; message?: string }
  return !!(
    error &&
    (err.code === 'NETWORK_ERROR' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ETIMEDOUT' ||
      err.message?.includes('Network Error') ||
      err.message?.includes('fetch'))
  )
}

/**
 * 标准化API响应
 * @param response 原始响应
 * @returns 标准化的API响应
 */
export function normalizeApiResponse<T = unknown>(response: unknown): ApiResponse<T> {
  // 处理 axios 响应格式（response.data 包含实际数据）
  if (response && typeof response === 'object' && 'data' in response) {
    const axiosResponse = response as { data: unknown; status?: number }
    const responseData = axiosResponse.data

    // 如果 data 已经是标准格式
    if (
      responseData &&
      typeof responseData === 'object' &&
      'code' in responseData &&
      'data' in responseData
    ) {
      const resp = responseData as {
        code?: number | string
        msg?: string
        message?: string
        data?: T
        success?: boolean
        timestamp?: number
      }

      // 转换 code 为数字（后端可能返回字符串 "200"）
      const codeNum = typeof resp.code === 'string' ? parseInt(resp.code, 10) : (resp.code ?? 200)

      // 确保 success 字段存在，根据 code 计算
      // 兼容部分接口使用 code=10000 表示成功
      const isSuccess =
        resp.success !== undefined ? resp.success : codeNum === 200 || codeNum === 0 || codeNum === 10000

      return {
        code: codeNum,
        message: resp.msg || resp.message || 'success',
        data: resp.data as T,
        success: isSuccess,
        timestamp: resp.timestamp || Date.now(),
      }
    }

    // 如果 data 不是标准格式，包装为标准格式
    return {
      code: axiosResponse.status || 200,
      message: 'success',
      data: responseData as T,
      success: true,
      timestamp: Date.now(),
    }
  }

  // 如果已经是标准格式但可能缺少 success 字段
  if (response && typeof response === 'object' && 'code' in response && 'data' in response) {
    const resp = response as {
      code?: number | string
      msg?: string
      message?: string
      data?: T
      success?: boolean
      timestamp?: number
    }

    // 转换 code 为数字
    const codeNum = typeof resp.code === 'string' ? parseInt(resp.code, 10) : (resp.code ?? 200)

    // 确保 success 字段存在
    // 兼容部分接口使用 code=10000 表示成功
    const isSuccess =
      resp.success !== undefined ? resp.success : codeNum === 200 || codeNum === 0 || codeNum === 10000

    return {
      code: codeNum,
      message: resp.msg || resp.message || 'success',
      data: resp.data as T,
      success: isSuccess,
      timestamp: resp.timestamp || Date.now(),
    }
  }

  // 否则包装为标准格式
  return {
    code: 200,
    message: 'success',
    data: response as T,
    success: true,
    timestamp: Date.now(),
  }
}

// 重新导出 apiResponseHandler 中的函数
export {
  withApiResponseHandler,
} from './apiResponseHandler'


