/**
 * API错误处理Composable
 * 提供统一的错误处理功能
 */

import { ref } from 'vue'
import {
  withRetry,
  ErrorType,
  type ApiError,
  type ErrorHandlerConfig,
  handleApiError,
  handleApiResponse,
} from '@/utils/errorHandler'
import type { ApiResponse } from '@/types'

/**
 * API错误处理Composable
 */
export function useApiError(config: ErrorHandlerConfig = {}) {
  const error = ref<ApiError | null>(null)
  const loading = ref(false)

  /**
   * 处理API错误
   */
  const handleError = (err: any, customConfig?: ErrorHandlerConfig) => {
    const apiError = handleApiError(err, { ...config, ...customConfig })
    error.value = apiError
    return apiError
  }

  /**
   * 处理API响应
   */
  const handleResponse = <T>(response: ApiResponse<T>, customConfig?: ErrorHandlerConfig) => {
    const data = handleApiResponse(response, { ...config, ...customConfig })
    if (data === null) {
      error.value = {
        type: getErrorType(response.code),
        code: response.code,
        message: response.message || '请求失败',
        data: response.data,
      }
    } else {
      error.value = null
    }
    return data
  }

  /**
   * 执行带错误处理的API调用
   */
  const execute = async <T>(
    apiCall: () => Promise<ApiResponse<T>>,
    customConfig?: ErrorHandlerConfig
  ): Promise<T | null> => {
    loading.value = true
    error.value = null

    try {
      const response = await apiCall()
      // 尝试从响应中提取 URL 信息（如果存在）
      let url = customConfig?.url
      if (!url && response && typeof response === 'object' && 'url' in response) {
        url = (response as { url?: string }).url
      }
      // 将 URL 信息传递到配置中
      const configWithUrl = url ? { ...customConfig, url } : customConfig
      return handleResponse(response, configWithUrl)
    } catch (err) {
      // 尝试从错误对象中提取 URL 信息（如果存在）
      let url = customConfig?.url
      if (!url && err && typeof err === 'object' && 'config' in err) {
        const axiosError = err as { config?: { url?: string } }
        url = axiosError.config?.url
      }
      // 将 URL 信息传递到配置中
      const configWithUrl = url ? { ...customConfig, url } : customConfig
      handleError(err, configWithUrl)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 执行带重试的API调用
   */
  const executeWithRetry = async <T>(
    apiCall: () => Promise<ApiResponse<T>>,
    retryOptions?: {
      maxRetries?: number
      retryDelay?: number
    },
    customConfig?: ErrorHandlerConfig
  ): Promise<T | null> => {
    loading.value = true
    error.value = null

    try {
      const response = await withRetry(apiCall, retryOptions)
      return handleResponse(response, customConfig)
    } catch (err) {
      handleError(err, customConfig)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 清除错误
   */
  const clearError = () => {
    error.value = null
  }

  return {
    error,
    loading,
    handleError,
    handleResponse,
    execute,
    executeWithRetry,
    clearError,
  }
}

/**
 * 获取错误类型（简化版）
 */
function getErrorType(code: number): ErrorType {
  if (code === 0) {
    return ErrorType.NETWORK
  }
  if (code === 401) {
    return ErrorType.UNAUTHORIZED
  }
  if (code === 403) {
    return ErrorType.FORBIDDEN
  }
  if (code >= 400 && code < 500) {
    return ErrorType.VALIDATION
  }
  if (code >= 500) {
    return ErrorType.SERVER_ERROR
  }
  return ErrorType.UNKNOWN
}
