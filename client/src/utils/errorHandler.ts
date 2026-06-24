import { t } from '@/utils/i18n'

 
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AxiosError } from 'axios'
import { logger } from './logger'
import { monitoringService } from './monitoring'
import i18n from '@/locales'

// 类型安全的 i18n 翻译函数
type TranslateFn = (key: string) => string
const i18nT: TranslateFn = (key: string) => (i18n.global as unknown as { t: TranslateFn }).t(key)
import type { ApiResponse } from '@/types'
import { JAVA_CHAT_HISTORY_BASE } from '@/config/backend-paths'

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK = 'network', // 网络错误
  TIMEOUT = 'timeout', // 超时错误
  UNAUTHORIZED = 'unauthorized', // 未授权
  FORBIDDEN = 'forbidden', // 权限不足
  NOT_FOUND = 'not_found', // 资源不存在
  SERVER_ERROR = 'server_error', // 服务器错误
  VALIDATION = 'validation', // 验证错误
  BUSINESS = 'business', // 业务错误
  UNKNOWN = 'unknown', // 未知错误
}

/**
 * API错误类型枚举（向后兼容）
 */
export const ApiErrorType = ErrorType

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string | number
  details?: unknown
  timestamp?: number
}

/**
 * 统一Error handled类
 */
export class ErrorHandler {
  /**
   * 处理Axios错误
   */
  static handleAxiosError(error: AxiosError): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: ErrorType.UNKNOWN,
      message: t('text.error_handler.unknownError'),
      timestamp: Date.now(),
    }

    // 网络错误
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorInfo.type = ErrorType.TIMEOUT
        errorInfo.message = t('text.error_handler.requestTimeout')
      } else {
        errorInfo.type = ErrorType.NETWORK
        errorInfo.message = t('text.error_handler.networkError')
      }
      return errorInfo
    }

    const { status, data } = error.response

    // HTTP状态码错误
    switch (status) {
      case 401:
        errorInfo.type = ErrorType.UNAUTHORIZED
        errorInfo.message = t('text.error_handler.loginRequired')
        errorInfo.code = status
        break
      case 403:
        errorInfo.type = ErrorType.FORBIDDEN
        errorInfo.message = t('text.error_handler.forbidden')
        errorInfo.code = status
        break
      case 404:
        errorInfo.type = ErrorType.NOT_FOUND
        errorInfo.message = t('text.error_handler.notFound')
        errorInfo.code = status
        break
      case 422:
        errorInfo.type = ErrorType.VALIDATION
        errorInfo.message =
          (data as { msg?: string; message?: string })?.msg ||
          (data as { msg?: string; message?: string })?.message ||
          t('text.error_handler.validationFailed')
        errorInfo.code = status
        errorInfo.details =
          (data as { errors?: unknown; data?: unknown })?.errors ||
          (data as { errors?: unknown; data?: unknown })?.data
        break
      case 500:
      case 502:
      case 503:
      case 504:
        errorInfo.type = ErrorType.SERVER_ERROR
        errorInfo.message =
          (data as { msg?: string; message?: string })?.msg ||
          (data as { msg?: string; message?: string })?.message ||
          t('text.error_handler.serverError')
        errorInfo.code = status
        break
      default:
        errorInfo.type = ErrorType.BUSINESS
        errorInfo.message =
          (data as { msg?: string; message?: string })?.msg ||
          (data as { msg?: string; message?: string })?.message ||
          t('text.error_handler.requestFailedWithStatus', { status })
        errorInfo.code = status
    }

    return errorInfo
  }

  /**
   * 处理业务错误
   */
  static handleBusinessError(error: {
    message?: string
    code?: string | number
    details?: unknown
  }): ErrorInfo {
    return {
      type: ErrorType.BUSINESS,
      message: error.message || t('text.error_handler.businessError'),
      code: typeof error.code === 'number' ? String(error.code) : error.code,
      details: error.details,
      timestamp: Date.now(),
    }
  }

  /**
   * 处理验证错误
   */
  static handleValidationError(
    errors: Record<string, unknown> | string | Array<string>
  ): ErrorInfo {
    const firstError = errors && typeof errors === 'object' ? Object.values(errors)[0] : errors
    const message = Array.isArray(firstError)
      ? firstError[0]
      : typeof firstError === 'string'
        ? firstError
        : t('text.error_handler.validationError')

    return {
      type: ErrorType.VALIDATION,
      message,
      details: errors,
      timestamp: Date.now(),
    }
  }

  /**
   * 显示错误消息
   */
  static showError(errorInfo: ErrorInfo, options?: { duration?: number; silent?: boolean }) {
    const duration = options?.duration || 5000
    const silent = options?.silent || false

    // 只有明确设置 silent: true 时才静默
    if (silent) {
      return
    }

    // 记录日志 - 所有错误都记录，方便调试
    logger.error('Error handled', new Error(errorInfo.message), {
      type: errorInfo.type,
      code: errorInfo.code,
      details: errorInfo.details,
    })

    // 发送到监控服务
    try {
      monitoringService.recordError(
        new Error(errorInfo.message),
        'javascript',
        errorInfo.type === ErrorType.SERVER_ERROR ? 'high' : 'medium',
        {
          type: errorInfo.type,
          code: errorInfo.code,
          details: errorInfo.details,
        }
      )
    } catch (_e) {
      // 监控服务记录失败，静默处理
    }

    // 显示错误消息
    ElMessage.error({
      message: errorInfo.message,
      duration,
      showClose: true,
    })
  }

  /**
   * 显示错误对话框
   */
  static async showErrorDialog(
    errorInfo: ErrorInfo,
    options?: { title?: string; confirmText?: string }
  ) {
    const title = options?.title || i18nT('common.error')
    const confirmText = options?.confirmText || i18nT('common.confirm')

    // 记录错误日志
    logger.error('[errorHandler] ' + t('common.errors.errorOccurred'), new Error(errorInfo.message), {
      type: errorInfo.type,
      code: errorInfo.code,
      details: errorInfo.details,
    })

    // 发送到监控服务
    try {
      monitoringService.recordError(
        new Error(errorInfo.message),
        'javascript',
        errorInfo.type === ErrorType.SERVER_ERROR ? 'high' : 'medium',
        {
          type: errorInfo.type,
          code: errorInfo.code,
          details: errorInfo.details,
        }
      )
    } catch (_e) {
      // 监控服务记录失败，静默处理
    }

    // 显示错误对话框
    await ElMessageBox.alert(errorInfo.message, title, {
      confirmButtonText: confirmText,
      type: 'error',
    })
  }

  /**
   * 处理并显示错误
   */
  static handleAndShow(error: unknown, options?: { showDialog?: boolean; duration?: number }) {
    let errorInfo: ErrorInfo

    // 判断错误类型
    const err = error as { response?: unknown; message?: string; code?: string }
    if (err.response) {
      // Axios错误
      errorInfo = this.handleAxiosError(error as AxiosError)
    } else if (err.message && err.code) {
      // 业务错误
      errorInfo = this.handleBusinessError(error as { message: string; code: string | number })
    } else if (typeof error === 'string') {
      // 字符串错误
      errorInfo = {
        type: ErrorType.UNKNOWN,
        message: error,
        timestamp: Date.now(),
      }
    } else {
      // 未知错误
      errorInfo = {
        type: ErrorType.UNKNOWN,
        message: (error as { message?: string })?.message || t('text.error_handler.unknownError'),
        details: error,
        timestamp: Date.now(),
      }
    }

    // 显示错误
    if (options?.showDialog) {
      void this.showErrorDialog(errorInfo)
    } else {
      this.showError(errorInfo, { duration: options?.duration })
    }

    return errorInfo
  }
}

/**
 * 便捷的Error handled函数
 */
export function handleError(
  error: unknown,
  options?: { showDialog?: boolean; duration?: number }
): ErrorInfo {
  return ErrorHandler.handleAndShow(error, options)
}

/**
 * 便捷的错误显示函数
 */
export function showError(message: string, duration?: number) {
  ErrorHandler.showError(
    {
      type: ErrorType.UNKNOWN,
      message,
      timestamp: Date.now(),
    },
    { duration }
  )
}

/**
 * API错误接口
 */
export interface ApiError {
  type: ErrorType
  code: number
  message: string
  data?: unknown
  originalError?: unknown
  retryable?: boolean
}

/**
 * Error handled配置
 */
export interface ErrorHandlerConfig {
  showMessage?: boolean
  showDialog?: boolean
  logError?: boolean
  customMessage?: string
  errorCodeMap?: Record<number, string>
  silent?: boolean // 静默处理错误（不显示消息，不记录日志）
  url?: string // API URL，用于判断是否是静默 API
}

/**
 * 默认错误码映射
 */
const DEFAULT_ERROR_CODE_MAP: Record<number, string> = {
  400: 'text.error_handler.badRequest',
  401: 'text.error_handler.loginRequired',
  403: 'text.error_handler.noPermission',
  404: 'text.error_handler.resourceNotFound',
  409: 'text.error_handler.resourceConflict',
  429: 'text.error_handler.tooManyRequests',
  500: 'text.error_handler.internalServerError',
  502: 'text.error_handler.badGateway',
  503: 'text.error_handler.serviceUnavailable',
  504: 'text.error_handler.gatewayTimeout',
}

/**
 * 判断API错误类型
 */
export function getApiErrorType(code: number, message?: string): ErrorType {
  if (code === 0 || message?.includes('Network') || message?.includes('网络')) {
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
  if (code >= 1000 && code < 2000) {
    return ErrorType.VALIDATION
  }
  if (code >= 2000 && code < 3000) {
    return ErrorType.UNAUTHORIZED
  }
  if (code >= 3000 && code < 4000) {
    return ErrorType.BUSINESS
  }
  return ErrorType.UNKNOWN
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: ApiError): boolean {
  if (error.retryable !== undefined) {
    return error.retryable
  }

  return (
    error.type === ErrorType.NETWORK ||
    error.type === ErrorType.TIMEOUT ||
    error.type === ErrorType.SERVER_ERROR
  )
}

/**
 * 格式化错误消息
 */
export function formatApiErrorMessage(error: ApiError, config?: ErrorHandlerConfig): string {
  if (config?.customMessage) {
    return config.customMessage
  }

  if (config?.errorCodeMap?.[error.code]) {
    return config.errorCodeMap[error.code]
  }

  if (DEFAULT_ERROR_CODE_MAP[error.code]) {
    return t(DEFAULT_ERROR_CODE_MAP[error.code])
  }

  if (error.message) {
    return error.message
  }

  const typeMessages: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: t('text.error_handler.networkError'),
    [ErrorType.TIMEOUT]: t('text.error_handler.requestTimeout'),
    [ErrorType.UNAUTHORIZED]: t('text.error_handler.loginRequired'),
    [ErrorType.FORBIDDEN]: t('text.error_handler.noPermission'),
    [ErrorType.VALIDATION]: t('text.error_handler.badRequest'),
    [ErrorType.BUSINESS]: t('text.error_handler.businessErrorShort'),
    [ErrorType.SERVER_ERROR]: t('text.error_handler.serverError'),
    [ErrorType.NOT_FOUND]: t('text.error_handler.resourceNotFound'),
    [ErrorType.UNKNOWN]: t('text.error_handler.unknownErrorShort'),
  }

  return typeMessages[error.type] || t('text.error_handler.requestFailed')
}

/**
 * 处理API错误
 */
export function handleApiError(error: unknown, config: ErrorHandlerConfig = {}): ApiError {
  const { showMessage = true, showDialog = false, logError = true, errorCodeMap } = config

  let apiError: ApiError

  if (error && typeof error === 'object' && 'code' in error) {
    const errorObj = error as { code: number; msg?: string; message?: string; data?: unknown; path?: string }
    apiError = {
      type: getApiErrorType(errorObj.code, errorObj.msg || errorObj.message),
      code: errorObj.code,
      message: errorObj.msg || errorObj.message || t('text.error_handler.unknownErrorShort'),
      data: errorObj.data,
      originalError: { ...(error as Record<string, unknown>), path: errorObj.path }, // 保留 path 信息
      retryable: isRetryableError({
        type: getApiErrorType(errorObj.code),
        code: errorObj.code,
        message: errorObj.msg || errorObj.message || '',
      }),
    }
  } else if (error instanceof Error) {
    apiError = {
      type: ErrorType.UNKNOWN,
      code: 500,
      message: error.message,
      originalError: error,
    }
  } else {
    apiError = {
      type: ErrorType.UNKNOWN,
      code: 500,
      message: String(error),
      originalError: error,
    }
  }

  if (logError) {
    // 检查是否是"未登录"错误（错误消息可能在 message 或 data.message 中）
    const errorMessage = apiError.message || ''
    const dataMessage = (apiError.data as { message?: string })?.message || ''
    const fullErrorMessage = errorMessage || dataMessage
    
    // 尝试从 originalError 中获取 URL 信息
    const originalError = apiError.originalError as { config?: { url?: string }; url?: string; path?: string } | undefined
    const url = originalError?.config?.url || originalError?.url || originalError?.path || ''
    
    // 需要认证的 API 路径列表（与 backend-paths 统一，用户未登录时返回 500 视为未登录）
    const AUTH_REQUIRED_APIS = [
      `${JAVA_CHAT_HISTORY_BASE}/conversations`,
      JAVA_CHAT_HISTORY_BASE,
      '/chat-history',
    ]
    
    // 检查是否是"未登录"错误
    const isUnauthorized = 
      apiError.code === 401 ||
      (apiError.code === 500 && (
        fullErrorMessage.includes('未登录') ||
        fullErrorMessage.includes('未授权') ||
        fullErrorMessage.includes('UNAUTHORIZED') ||
        fullErrorMessage.includes('unauthorized') ||
        AUTH_REQUIRED_APIS.some(apiPath => url.includes(apiPath)) // 对于需要认证的 API，500 错误视为未登录
      ))
    
    // 对于"未登录"错误，使用 warn 级别而不是 error 级别
    if (isUnauthorized) {
      logger.warn('API Error (user not logged in):', {
        type: apiError.type,
        code: apiError.code,
        message: apiError.message,
        data: apiError.data,
        originalError: apiError.originalError,
      })
    } else {
      logger.error('API Error:', {
        type: apiError.type,
        code: apiError.code,
        message: apiError.message,
        data: apiError.data,
        originalError: apiError.originalError,
      })
    }
  }

  if (showMessage) {
    const errorMessage = formatApiErrorMessage(apiError, { ...config, errorCodeMap })

    if (showDialog) {
      ElMessageBox.alert(errorMessage, t('text.error_handler.errorTitle'), {
        type: 'error',
      })
    } else {
      ElMessage.error(errorMessage)
    }
  }

  return apiError
}

/**
 * 处理API响应
 */
export function handleApiResponse<T>(
  response: ApiResponse<T>,
  config: ErrorHandlerConfig = {}
): T | null {
  const { showMessage = true, logError = true, silent = false, url: configUrl } = config

  // 兼容多种后端成功约定：
  // 1) code === 200 && success === true（Java 风格）
  // 2) code === 0 且 message/msg 为 success/ok/空（Python FastAPI 风格）
  // 3) code 为字符串 "0"/"200" (后端返回字符串 code, 需转换为数字)
  const codeNum =
    typeof response.code === 'string' ? parseInt(response.code, 10) : response.code
  const isSuccess =
    (codeNum === 200 && response.success) ||
    (codeNum === 0 &&
      /^(success|ok)?$/i.test((response.message || response.msg || '').trim()))

  if (isSuccess) {
    return response.data ?? null
  }

  // 检查是否是"未登录"错误（错误消息可能在 response.message 或 data.message 中）
  const errorMessage = response.message || ''
  const dataMessage = (response.data as { message?: string })?.message || ''
  const fullErrorMessage = errorMessage || dataMessage
  
  // 尝试从 response 或 config 中获取 URL 信息（如果存在）
  const url = configUrl || (response as { url?: string; path?: string }).url || (response as { url?: string; path?: string }).path || ''
  
  // 需要认证的 API 路径列表（与 backend-paths 统一）
  const AUTH_REQUIRED_APIS = [
    `${JAVA_CHAT_HISTORY_BASE}/conversations`,
    JAVA_CHAT_HISTORY_BASE,
    '/chat-history',
  ]

  // 不再按 API 静默，仅当调用方显式传入 silent: true 时静默
  const isSilentError = silent
  
  // 检查是否是"未登录"错误
  const isUnauthorized = 
    response.code === 401 ||
    (response.code === 500 && (
      fullErrorMessage.includes('未登录') ||
      fullErrorMessage.includes('未授权') ||
      fullErrorMessage.includes('UNAUTHORIZED') ||
      fullErrorMessage.includes('unauthorized') ||
      AUTH_REQUIRED_APIS.some(apiPath => url.includes(apiPath)) // 对于需要认证的 API，500 错误视为未登录
    ))

  const error: ApiError = {
    type: getApiErrorType(response.code, response.message),
    code: response.code,
    message: response.message || t('text.error_handler.requestFailed'),
    data: response.data,
    retryable: false,
  }

  // 仅当调用方显式传入 silent: true 时不记录、不显示
  if (isSilentError) {
    // 完全静默处理，直接返回 null
    return null
  }

  if (logError) {
    // 对于"未登录"错误，使用 warn 级别而不是 error 级别
    if (isUnauthorized) {
      logger.warn('API Response Error (user not logged in):', error)
    } else {
      logger.error('API Response Error:', error)
    }
  }

  if (showMessage) {
    const errorMessage = formatApiErrorMessage(error, config)
    ElMessage.error(errorMessage)
  }

  return null
}

/**
 * 带重试的API调用
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    retryDelay?: number
    retryCondition?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryCondition = error => {
      const apiError = handleApiError(error, { showMessage: false, logError: false })
      return isRetryableError(apiError)
    },
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !retryCondition(error)) {
        throw error
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }

  throw lastError
}

/**
 * 统一API调用包装器
 */
export function createApiWrapper<T extends (...args: unknown[]) => Promise<ApiResponse<unknown>>>(
  apiFunction: T,
  config: ErrorHandlerConfig = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const response = await apiFunction(...args)

      const data = handleApiResponse(response, config)

      if (data === null) {
        return response
      }

      return response
    } catch (error) {
      handleApiError(error, config)
      throw error
    }
  }) as T
}
