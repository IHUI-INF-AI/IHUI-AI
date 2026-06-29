/**
 * 核心工具函数导出
 * 为API客户端提供核心功能
 */

import { EventEmitter } from './event-emitter'
import { logger } from './logger'
import { StorageManager, STORAGE_KEYS, TokenStorage } from './storage'

// 从logger导出
export { logger } from './logger'

// 从storage导出
export { StorageManager, STORAGE_KEYS }

// 创建全局EventBus实例
export const EventBus = new EventEmitter()

// 重新导出EventEmitter类
export { EventEmitter }

// Token管理 (委托给统一 TokenStorage)
export const TokenManager = {
  getToken: (): string | null => {
    return TokenStorage.getToken()
  },
  setToken: (token: string, refreshToken?: string): void => {
    TokenStorage.setToken(token)
    if (refreshToken) {
      TokenStorage.setRefreshToken(refreshToken)
    }
  },
  getRefreshToken: (): string | null => {
    return TokenStorage.getRefreshToken()
  },
  clearTokens: (): void => {
    TokenStorage.clearAuth()
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
  setLogger: (_logger: unknown): void => {
    // 设置日志记录器
  },
  getAll: (): Record<string, unknown> => {
    return { ...configStore }
  },
  set: (key: string, value: unknown): void => {
    configStore[key] = value
  },
  get: (key: string): unknown => {
    return configStore[key]
  },
}

// 错误处理
export const ErrorHandler = {
  handleAndShow: (error: unknown): void => {
    logger.error('Error:', error)
  },
}

// 演示模式检查
export const isDemoMode = (): boolean => {
  return import.meta.env.VITE_DEMO_MODE === 'true' || window.location.search.includes('demo=true')
}

// API响应规范化
export function normalizeApiResponse<T>(response: unknown): { data: T | null; error: string | null } {
  if (!response || typeof response !== 'object') {
    return { data: null, error: 'Invalid response format' }
  }

  const res = response as { code?: number; data?: T; message?: string; success?: boolean }

  if (res.success === true || res.code === 200) {
    return { data: res.data as T, error: null }
  }

  return { data: null, error: res.message || 'Unknown error' }
}

// 清除所有认证数据（委托给统一 TokenStorage）
export function clearAllAuthData(): void {
  TokenStorage.clearAuth()
  localStorage.removeItem('user')
  sessionStorage.removeItem('user')
}
