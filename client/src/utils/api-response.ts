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
export type ApiResponseHandler<T = unknown> = (...args: any[]) => Promise<ApiResponse<T>>

/**
 * 网络错误类型
 */
export interface NetworkError extends Error {
  isNetworkError: boolean
  code?: string
  response?: any
}

/**
 * 判断是否为网络错误
 * @param error 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: any): error is NetworkError {
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
export function normalizeApiResponse<T = unknown>(response: any): ApiResponse<T> {
  // 处理 axios 响应格式（response.data 包含实际数据）
  if (response && typeof response === 'object' && 'data' in response) {
    const axiosResponse = response as { data: any; status?: number }
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

/**
 * 创建模拟API响应
 * @param data 响应数据
 * @param message 响应消息
 * @param code 响应代码
 * @returns 模拟API响应
 */
export function createMockApiResponse<T = unknown>(
  data: T,
  message: string = 'success',
  code: number = 200
): ApiResponse<T> {
  return {
    code,
    message,
    data,
    success: code >= 200 && code < 300,
    timestamp: Date.now(),
    isMockData: true,
    mockMessage: '使用模拟数据',
  }
}

/**
 * 创建错误API响应
 * @param message 错误消息
 * @param code 错误代码
 * @param data 错误数据
 * @returns 错误API响应
 */
export function createErrorApiResponse<T = unknown>(
  message: string,
  code: number = 500,
  data: T | null = null
): ApiResponse<T | null> {
  return {
    code,
    message,
    data,
    success: false,
    timestamp: Date.now(),
  }
}

/**
 * 从API响应中提取数据
 * @param response API响应
 * @returns 响应数据
 */
export function extractData<T = unknown>(response: ApiResponse<T>): T {
  return response.data
}

/**
 * 检查API响应是否成功
 * @param response API响应
 * @returns 是否成功
 */
export function isSuccessResponse<T = unknown>(response: ApiResponse<T>): boolean {
  return response.success && response.code >= 200 && response.code < 300
}

/**
 * 检查API响应是否为模拟数据
 * @param response API响应
 * @returns 是否为模拟数据
 */
export function isMockResponse<T = unknown>(response: ApiResponse<T>): boolean {
  return !!response.isMockData
}

// 重新导出 apiResponseHandler 中的函数
export {
  withApiResponseHandler,
  normalizePaginationResponse,
} from './apiResponseHandler'


