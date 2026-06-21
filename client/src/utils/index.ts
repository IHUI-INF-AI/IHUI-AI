/**
 * 通用工具函数统一导出
 * 所有工具函数已从 utils/format.ts 迁移
 * 此文件保留用于向后兼容
 */

// 从 format.ts 重新导出所有功能
export * from './format'

// 从 markRaw.ts 导出 markRaw 工具函数
export { markIcon, markIcons, markRaw, type IconComponent } from './markRaw'

// 从 object-utils.ts 重新导出对象处理功能
export { deepClone, deepEqual } from './object-utils'

// 从 logger.ts 导出日志工具
export { logger, LogLevel } from './logger'

// 从 auth.ts 导出认证工具
export { clearAllAuthData } from './auth'

// 从 storage.ts 导出存储管理
export { StorageManager, STORAGE_KEYS } from './storage'

// 从 errorHandler.ts 导出错误处理
export { ErrorHandler, handleApiResponse } from './errorHandler'

// 从 api-helpers.ts 导出所有辅助工具
export * from './api-helpers'

// 从 event-emitter.ts 导出事件总线
export { EventEmitter, EventBus } from './event-emitter'

// 从 speech.ts 导出语音相关功能
export {
  SpeechRecognitionError,
  SpeechProvider,
  startSpeechRecognition,
  stopSpeechRecognition,
  isSpeechRecognitionSupported,
  getProviderStatus,
  getCurrentProvider,
  setProvider,
  getBestAvailableProvider
} from './speech'
export type { SpeechRecognitionCallbacks, SpeechServiceConfig } from './speech'

// 从 login-duration.ts 导出登录时长相关功能
export {
  LOGIN_DURATION_OPTIONS,
  DEFAULT_LOGIN_DURATION,
  getDefaultLoginDuration,
  getLoginDurationLabel,
  initLoginDuration
} from './login-duration'
export type { LoginDuration } from './login-duration'

// 从 apiResponseHandler.ts 导出API响应处理
export {
  ApiCache,
  withCache,
  normalizeApiResponse,
  withApiResponseHandler,
  isApiSuccess,
  extractApiData,
  extractApiError,
  normalizePaginationResponse,
  createErrorResponse,
  debounceApi,
  throttleApi,
  withRetry,
  ApiBatcher
} from './apiResponseHandler'

export { RememberMeService } from './rememberMeService'
export type { Credentials } from './rememberMeService'

// 占位符导出（避免编译错误）
export const TokenManager = {
  getToken: () => localStorage.getItem('token') || sessionStorage.getItem('token'),
  setToken: (token: string) => {
    localStorage.setItem('token', token)
    sessionStorage.setItem('token', token)
  },
  removeToken: () => {
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
  },
}

export const ConfigManager = {
  getConfig: (key: string) => localStorage.getItem(`config_${key}`),
  setConfig: (key: string, value: string) => localStorage.setItem(`config_${key}`, value),
}

export const retryPromise = <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  return fn().catch((error) => {
    if (retries > 0) {
      return retryPromise(fn, retries - 1)
    }
    throw error
  })
}

export const withTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout)
    })
  ])
}

// 清理相关
export const registerCleanup = (fn: () => void) => {
  window.addEventListener('beforeunload', fn)
  return () => window.removeEventListener('beforeunload', fn)
}

// 日期标签函数
export function getDateLabel(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${Math.floor(days / 30)}月前`
}

// 导出消息到文件
export function exportMessagesToFile(messages: any[], filename: string): void {
  const data = JSON.stringify(messages, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 注意：clearTimeout, setTimeout, isDemoMode, createAbortController, cancelRequest,
// getCachedData, setCachedData, isLoginExpired, InputValidator, getDefaultLoginDuration
// 都从 api-helpers.ts 重新导出
