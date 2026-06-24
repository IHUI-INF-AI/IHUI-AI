/**
 * 核心工具函数导出
 * 为API客户端提供核心功能
 */

import { EventEmitter } from './event-emitter'
import { logger } from './logger'
import { StorageManager, STORAGE_KEYS } from './storage'

// 从logger导出
export { logger } from './logger'

// 从storage导出
export { StorageManager, STORAGE_KEYS }

// 创建全局EventBus实例
export const EventBus = new EventEmitter()

// 重新导出EventEmitter类
export { EventEmitter }

// Token管理 (统一使用 STORAGE_KEYS, 避免历史键分散)
export const TokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.USER_TOKEN) || sessionStorage.getItem(STORAGE_KEYS.USER_TOKEN)
  },
  setToken: (token: string, refreshToken?: string): void => {
    localStorage.setItem(STORAGE_KEYS.USER_TOKEN, token)
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    }
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
  },
  clearTokens: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    sessionStorage.removeItem(STORAGE_KEYS.USER_TOKEN)
  },
  getUuid: (): string => {
    return localStorage.getItem('uuid') || ''
  },
  isTokenValid: (): boolean => {
    const expiry = localStorage.getItem('tokenExpiry')
    if (!expiry) return true
    return Date.now() < parseInt(expiry, 10)
  },
  setTokenExpiry: (timestamp: number): void => {
    localStorage.setItem('tokenExpiry', timestamp.toString())
  },
}

// 配置管理
const configStore: Record<string, unknown> = {}

export const ConfigManager = {
  getApiConfig: () => ({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api-kou',
    retryCount: 3,
    timeout: 30000,
  }),
  setLogger: (_logger: any): void => {
    // 设置日志记录器
  },
  getAll: (): Record<string, unknown> => {
    return { ...configStore }
  },
  set: (key: string, value: any): void => {
    configStore[key] = value
  },
  get: (key: string): any => {
    return configStore[key]
  },
}

// 错误处理
export const ErrorHandler = {
  handleAndShow: (error: any): void => {
    logger.error('Error:', error)
  },
}

// 演示模式检查
export const isDemoMode = (): boolean => {
  return import.meta.env.VITE_DEMO_MODE === 'true' || window.location.search.includes('demo=true')
}

// API响应规范化
export function normalizeApiResponse<T>(response: any): { data: T | null; error: string | null } {
  if (!response || typeof response !== 'object') {
    return { data: null, error: 'Invalid response format' }
  }

  const res = response as { code?: number | string; data?: T; message?: string; success?: boolean }

  // 转换 code 为数字 (后端可能返回字符串 "0"/"200")
  const codeNum = typeof res.code === 'string' ? parseInt(res.code, 10) : res.code
  if (res.success === true || codeNum === 200 || codeNum === 0) {
    return { data: res.data as T, error: null }
  }

  return { data: null, error: res.message || 'Unknown error' }
}

// 清除所有认证数据
export function clearAllAuthData(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
}
