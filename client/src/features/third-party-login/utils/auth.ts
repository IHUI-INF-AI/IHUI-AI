import type {
  ThirdPartyPlatform,
  LoginError,
  LoginErrorType,
  PlatformDisplayNames,
  PlatformColors,
  ConfigValidationResult,
  ThirdPartyConfig,
} from '../types'
import { safeParseJson } from '@/utils/storage'

import { logger } from '../../../utils/logger'
// 平台显示名称映射
export const PLATFORM_DISPLAY_NAMES: PlatformDisplayNames = {
  alipay: '支付宝',
  google: 'Google',
}

// 平台颜色配置
export const PLATFORM_COLORS: PlatformColors = {
  alipay: {
    primary: 'var(--color-brand-blue)',
    secondary: 'var(--el-text-color-primary)',
    background: 'var(--el-fill-color-extra-light, var(--el-text-color-primary))',
  },
  google: {
    primary: 'var(--el-text-color-primary)',
    secondary: 'var(--el-text-color-primary)',
    background: 'var(--el-fill-color-extra-light, var(--color-gray-f8f9fa))',
  },
}

// 默认配置
export const DEFAULT_CONFIG: ThirdPartyConfig = {
  alipay: {
    enabled: false,
    appId: '',
    qrLoginEnabled: true,
    webAuthEnabled: false,
    sandboxMode: false,
  },
  google: {
    enabled: false,
    appId: '',
    clientId: '',
    redirectUri: '',
    scope: 'email profile',
  },
}

/**
 * 获取平台显示名称
 */
export const getPlatformDisplayName = (platform: ThirdPartyPlatform): string => {
  return PLATFORM_DISPLAY_NAMES[platform] || platform
}

/**
 * 获取平台颜色配置
 */
export const getPlatformColors = (platform: ThirdPartyPlatform) => {
  return PLATFORM_COLORS[platform] || PLATFORM_COLORS.google
}

/**
 * 创建登录错误
 */
export const createLoginError = (
  message: string,
  type: LoginErrorType,
  platform: ThirdPartyPlatform,
  code?: string,
  details?: any
): LoginError => {
  const error = new Error(message) as LoginError
  error.type = type
  error.platform = platform
  error.code = code
  error.details = details
  return error
}

/**
 * 验证配置
 */
export const validateConfig = (config: Partial<ThirdPartyConfig>): ConfigValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  // 验证Google配置
  if (config.google?.enabled) {
    if (!config.google.clientId) {
      errors.push('Google ClientId不能为空')
    }
    if (!config.google.redirectUri) {
      errors.push('Google重定向URI不能为空')
    }
    if (!config.google.scope) {
      warnings.push('Google授权范围为空，将使用默认值')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 检测是否在支付宝内置浏览器
 */
export const isAlipayBrowser = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return ua.includes('alipayclient')
}

/**
 * 检测是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
}

/**
 * 生成随机状态字符串
 */
export const generateState = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 解析URL参数
 */
export const parseUrlParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {}
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value
    })
  } catch (error) {
    logger.error('Failed to parse URL parameters:', error)
  }
  return params
}

/**
 * 构建OAuth URL
 */
export const buildOAuthUrl = (baseUrl: string, params: Record<string, string>): string => {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })
  return url.toString()
}

/**
 * 计算倒计时文本
 */
export const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * 验证邮箱格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证手机号格式（中国大陆）
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 防抖函数（已迁移到 @/utils/format，保留此导出以保持向后兼容）
 * @deprecated 请使用 @/utils/format 中的 debounce
 */
export { debounce } from '@/utils/format'

/**
 * 节流函数（已迁移到 @/utils/format，保留此导出以保持向后兼容）
 * @deprecated 请使用 @/utils/format 中的 throttle
 */
export { throttle } from '@/utils/format'

/**
 * 深拷贝对象（已迁移到 @/utils/object，保留此导出以保持向后兼容）
 * @deprecated 请使用 @/utils/object 中的 deepClone
 */
export { deepClone } from '@/utils/object'

/**
 * 存储到本地存储
 */
export const setLocalStorage = (key: string, value: any): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    logger.error('Failed to store to local storage:', error)
  }
}

/**
 * 从本地存储获取
 */
export const getLocalStorage = <T>(key: string, defaultValue?: T): T | undefined => {
  try {
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key)
      if (item) {
        return safeParseJson<T>(item, defaultValue as T, { forbidFunction: true })
      }
    }
  } catch (error) {
    logger.error('Failed to get from local storage:', error)
  }
  return defaultValue
}

/**
 * 从本地存储移除
 */
export const removeLocalStorage = (key: string): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch (error) {
    logger.error('Failed to remove from local storage:', error)
  }
}

/**
 * 生成唯一ID
 */
export const generateUniqueId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取错误消息
 */
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const err = error as { message?: string; msg?: string; error?: string }
    if (err.message) return err.message
    if (err.msg) return err.msg
    if (err.error) return err.error
  }
  return '未知错误'
}

/**
 * 检查是否支持WebAuth API
 */
export const isWebAuthSupported = (): boolean => {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window
}

/**
 * 检查是否支持Credential Management API
 */
export const isCredentialManagementSupported = (): boolean => {
  return typeof window !== 'undefined' && 'credentials' in navigator
}

/**
 * 格式化文件大小（已迁移到 @/utils/format，保留此导出以保持向后兼容）
 * @deprecated 请使用 @/utils/format 中的 formatFileSize
 */
export { formatFileSize } from '@/utils/format'

/**
 * 获取设备信息
 */
export const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {}

  const { navigator, screen } = window
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Date.now(),
  }
}
