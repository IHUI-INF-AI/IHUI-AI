/**
 * 统一Error handled工具
 * 提供统一的Error handled、错误提示和错误日志记录功能
 */

import { logger } from './logger'
import { ElMessage } from 'element-plus'
import type { AxiosError } from 'axios'
import { getI18nGlobal } from '@/locales'

const { t } = getI18nGlobal()

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string | number
  originalError?: unknown
  context?: Record<string, unknown>
}

/**
 * 判断错误类型
 */
export function getErrorType(error: unknown): ErrorType {
  if (!error) return ErrorType.UNKNOWN

  const err = error as { code?: string | number; message?: string; response?: unknown }

  // 网络错误
  if (
    err.code === 'NETWORK_ERROR' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.message?.includes('Network Error') ||
    err.message?.includes('fetch') ||
    err.message?.includes('timeout')
  ) {
    return ErrorType.NETWORK
  }

  // API错误
  if (err.response || (err.code && typeof err.code === 'number' && err.code >= 400)) {
    return ErrorType.API
  }

  // 权限错误
  if (err.code === 401 || err.code === 403 || err.message?.includes('permission') || err.message?.includes('unauthorized')) {
    return ErrorType.PERMISSION
  }

  // 验证错误
  if (err.code === 400 || err.message?.includes('validation') || err.message?.includes('invalid')) {
    return ErrorType.VALIDATION
  }

  return ErrorType.UNKNOWN
}

/**
 * 提取错误消息
 */
export function extractErrorMessage(error: unknown, defaultMessage: string = '操作失败'): string {
  if (!error) return defaultMessage

  const err = error as { message?: string; msg?: string; error?: string; code?: number | string }

  // 优先使用 message
  if (err.message) return err.message

  // 其次使用 msg
  if (err.msg) return err.msg

  // 再次使用 error
  if (err.error) return String(err.error)

  // 如果是字符串，直接返回
  if (typeof error === 'string') return error

  // 如果是 Error 对象，返回 message
  if (error instanceof Error) return error.message

  // 默认消息
  return defaultMessage
}

/**
 * 处理错误
 */
export function handleError(
  error: unknown,
  options: {
    showMessage?: boolean
    logError?: boolean
    defaultMessage?: string
    context?: Record<string, unknown>
  } = {}
): ErrorInfo {
  const {
    showMessage = true,
    logError = true,
    defaultMessage = t('common.errors.operationFailed'),
    context = {},
  } = options

  const errorType = getErrorType(error)
  const errorMessage = extractErrorMessage(error, defaultMessage)
  const errorCode = (error as { code?: string | number })?.code

  const errorInfo: ErrorInfo = {
    type: errorType,
    message: errorMessage,
    code: errorCode,
    originalError: error,
    context,
  }

  // 记录错误日志
  if (logError) {
    logger.error('Error handled:', {
      type: errorType,
      message: errorMessage,
      code: errorCode,
      context,
      error: error instanceof Error ? error.stack : String(error),
    })
  }

  // 显示错误消息
  if (showMessage) {
    let userMessage = errorMessage

    // 根据错误类型提供更友好的提示
    switch (errorType) {
      case ErrorType.NETWORK:
        userMessage = t('common.errors.networkError')
        break
      case ErrorType.PERMISSION:
        userMessage = t('common.errors.permissionDenied') || '权限不足，请先登录或联系管理员'
        break
      case ErrorType.VALIDATION:
        userMessage = errorMessage || t('common.errors.validationError') || '输入数据有误，请检查后重试'
        break
      case ErrorType.API:
        // API错误使用原始消息
        break
      default:
        userMessage = defaultMessage
    }

    ElMessage.error(userMessage)
  }

  return errorInfo
}

/**
 * 处理API错误
 */
export function handleApiError(
  error: unknown,
  options: {
    showMessage?: boolean
    logError?: boolean
    defaultMessage?: string
    context?: Record<string, unknown>
  } = {}
): ErrorInfo {
  const axiosError = error as AxiosError<{ code?: number; message?: string; msg?: string }>

  // 提取API错误信息
  const apiError = axiosError.response?.data
  const errorMessage =
    apiError?.message || apiError?.msg || axiosError.message || options.defaultMessage || 'API调用失败'

  const errorData: Record<string, unknown> = {
    message: errorMessage,
    code: apiError?.code || axiosError.response?.status,
  }

  // 如果 error 是对象，则展开其属性
  if (error && typeof error === 'object') {
    Object.assign(errorData, error)
  }

  return handleError(errorData, options)
}
