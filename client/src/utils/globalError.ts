/**
 * 全局错误处理工具
 * 提供统一的错误捕获、分类和处理机制
 */

import { logger } from './logger'

export interface AppError {
  type: ErrorType
  message: string
  code?: string | number
  stack?: string
  timestamp: number
  context?: Record<string, unknown>
}

export type ErrorType =
  | 'network'
  | 'api'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'server'
  | 'timeout'
  | 'unknown'

export interface ErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  reportError?: boolean
  onRetry?: () => void
}

const errorMessages: Record<ErrorType, string> = {
  network: '网络连接失败，请检查网络设置',
  api: 'API请求失败，请稍后重试',
  validation: '数据验证失败，请检查输入',
  authentication: '登录已过期，请重新登录',
  authorization: '没有权限执行此操作',
  not_found: '请求的资源不存在',
  server: '服务器错误，请稍后重试',
  timeout: '请求超时，请稍后重试',
  unknown: '发生未知错误',
}

class GlobalErrorHandler {
  private errorQueue: AppError[] = []
  private maxQueueSize = 50
  private listeners: Set<(error: AppError) => void> = new Set()

  classifyError(error: any): ErrorType {
    if (!error) return 'unknown'

    const err = error as Error & { response?: { status?: number }; code?: string | number }

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'timeout'
    }

    if (err.message?.includes('Network Error') || err.message?.includes('network')) {
      return 'network'
    }

    if (err.response?.status) {
      const status = err.response.status
      if (status === 401) return 'authentication'
      if (status === 403) return 'authorization'
      if (status === 404) return 'not_found'
      if (status >= 500) return 'server'
      if (status >= 400) return 'validation'
    }

    if (err.message?.includes('validation') || err.message?.includes('invalid')) {
      return 'validation'
    }

    return 'unknown'
  }

  createAppError(error: any, context?: Record<string, unknown>): AppError {
    const err = error as Error
    const type = this.classifyError(error)

    return {
      type,
      message: err.message || errorMessages[type],
      code: (err as Error & { response?: { status?: number } }).response?.status || (err as Error & { code?: string | number }).code,
      stack: err.stack,
      timestamp: Date.now(),
      context,
    }
  }

  handle(error: any, options: ErrorHandlerOptions = {}): AppError {
    const { showToast = true, logError = true, reportError = false } = options

    const appError = this.createAppError(error)

    this.addToQueue(appError)

    if (logError) {
      this.logError(appError)
    }

    if (showToast) {
      this.showToast(appError)
    }

    if (reportError) {
      this.reportError(appError)
    }

    this.notifyListeners(appError)

    return appError
  }

  private addToQueue(error: AppError): void {
    this.errorQueue.push(error)
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }
  }

  private logError(error: AppError): void {
    logger.error(`[${error.type.toUpperCase()}] ${error.message}`, {
      code: error.code,
      stack: error.stack,
      context: error.context,
    })
  }

  private showToast(error: AppError): void {
    if (typeof window !== 'undefined') {
      const win = window as unknown as Window & { ElMessage?: { error: (msg: string) => void } }
      if (win.ElMessage) {
        win.ElMessage.error(error.message)
      }
    }
  }

  private reportError(_error: AppError): void {
    // 可以在这里集成错误上报服务
    // 例如：Sentry, Bugsnag 等
  }

  private notifyListeners(error: AppError): void {
    for (const listener of this.listeners) {
      try {
        listener(error)
      } catch {
        // 忽略监听器错误
      }
    }
  }

  subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getErrorQueue(): AppError[] {
    return [...this.errorQueue]
  }

  clearQueue(): void {
    this.errorQueue = []
  }

  getErrorMessage(type: ErrorType): string {
    return errorMessages[type]
  }

  isRetryable(error: AppError): boolean {
    return ['network', 'timeout', 'server'].includes(error.type)
  }

  shouldRedirectToLogin(error: AppError): boolean {
    return error.type === 'authentication'
  }
}

export const globalErrorHandler = new GlobalErrorHandler()

export function useGlobalError() {
  return {
    handle: (error: any, options?: ErrorHandlerOptions) => globalErrorHandler.handle(error, options),
    subscribe: (listener: (error: AppError) => void) => globalErrorHandler.subscribe(listener),
    getErrorQueue: () => globalErrorHandler.getErrorQueue(),
    clearQueue: () => globalErrorHandler.clearQueue(),
    classifyError: (error: any) => globalErrorHandler.classifyError(error),
    isRetryable: (error: AppError) => globalErrorHandler.isRetryable(error),
    shouldRedirectToLogin: (error: AppError) => globalErrorHandler.shouldRedirectToLogin(error),
  }
}

export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    globalErrorHandler.handle(event.error, { showToast: false })
  })

  window.addEventListener('unhandledrejection', (event) => {
    globalErrorHandler.handle(event.reason, { showToast: false })
  })
}

export default globalErrorHandler
