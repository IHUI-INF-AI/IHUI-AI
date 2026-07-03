import { logger } from '@/utils/logger'

/**
 * 统一的本地存储工具
 * 提供类型安全、错误处理和统一的接口
 */

// 存储键名常量
export const STORAGE_KEYS = {
  TOKEN: 'token',
  ACCESS_TOKEN: 'accessToken',
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  USER_INFO: 'userInfo',
  USER_UUID: 'userUuid',
  REFRESH_TOKEN: 'refresh_token',
  LANGUAGE: 'language',
  DARK_MODE: 'darkMode',
  FONT: 'font',
  REDIRECT_AFTER_LOGIN: 'redirect_after_login',
  WECHAT_STATE: 'wechatState',
  THIRD_PARTY_LOGIN_STATE: 'third_party_login_state',
  LOGIN_DURATION: 'login_duration',
  LOGIN_EXPIRY_TIME: 'login_expiry_time',
  USER_DATA_COLLECTION: 'user_data_collection',
  USER_MEMORY: 'user_memory',
  USER_PROFILE: 'user_profile',
  TEMP_AUTH_KEY: 'temp_auth_key',
  AI_CHAT: 'ai_chat_state',
  AUTH_RETURN_PATH: 'auth-return-path',
  APPLE_OAUTH_STATE: 'apple_oauth_state',
  ADMIN_ACCESS_TOKEN: 'admin-access-token',
  MESSAGE_NOTIFICATION: 'messageNotification',
  DATA: 'data',
  PASSWORD_EXPIRED: 'password_expired',
  UPLOADED_DOCS: 'uploadedDocs',
  DOC_LIST_HEIGHT: 'doc_list_height',
} as const

// 同步存储接口，用于向后兼容
export class StorageManager {
  /**
   * 安全地获取存储项（同步）
   */
  static getItem<T = string>(key: string): T | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = localStorage.getItem(key)
        if (value === null) {
          return null
        }

        try {
          return JSON.parse(value) as T
        } catch {
          return value as T
        }
      }

      return null
    } catch (error) {
      logger.error(`Failed to get storage item:`, error)
      return null
    }
  }

  /**
   * 安全地设置存储项（同步）
   */
  static setItem<T>(key: string, value: T): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
        localStorage.setItem(key, stringValue)
        return true
      }

      return false
    } catch (error) {
      logger.error(`Failed to set storage item:`, error)
      return false
    }
  }

  /**
   * 安全地删除存储项（同步）
   */
  static removeItem(key: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key)
        return true
      }

      return false
    } catch (error) {
      logger.error(`Failed to delete storage item:`, error)
      return false
    }
  }

  /**
   * 安全地清空所有存储（同步）
   */
  static clear(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear()
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to clear storage:', error)
      return false
    }
  }

  /**
   * 检查存储项是否存在（同步）
   */
  static hasItem(key: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key) !== null
      }

      return false
    } catch (error) {
      logger.error(`Failed to check storage item:`, error)
      return false
    }
  }

  /**
   * 获取所有存储键（同步）
   */
  static getAllKeys(): string[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) keys.push(key)
        }
        return keys
      }

      return []
    } catch (error) {
      logger.error('Failed to get all storage keys:', error)
      return []
    }
  }

  /**
   * 批量获取存储项
   */
  static getItems<T = unknown>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {}
    keys.forEach(key => {
      result[key] = this.getItem<T>(key)
    })
    return result
  }

  /**
   * 批量设置存储项
   */
  static setItems(items: Record<string, unknown>): boolean {
    let allSuccess = true
    Object.entries(items).forEach(([key, value]) => {
      if (!this.setItem(key, value)) {
        allSuccess = false
      }
    })
    return allSuccess
  }
}

// 便捷函数导出
export const getStorageItem = StorageManager.getItem
export const setStorageItem = StorageManager.setItem
export const removeStorageItem = StorageManager.removeItem
export const clearStorage = StorageManager.clear
export const hasStorageItem = StorageManager.hasItem

export function safeParseJson<T>(
  text: string | null | undefined,
  fallback: T,
  options?: { forbidFunction?: boolean }
): T {
  try {
    if (!text) return fallback
    const s = String(text)
    if (options?.forbidFunction && /\bfunction\b/i.test(s)) return fallback
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/**
 * 安全存储管理器
 * 用于存储敏感数据（如Token），使用sessionStorage减少XSS攻击风险
 * sessionStorage在浏览器关闭后自动清除，比localStorage更安全
 */
export class SecureStorageManager {
  private static isAvailable(): boolean {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const testKey = '__secure_storage_test__'
        sessionStorage.setItem(testKey, 'test')
        sessionStorage.removeItem(testKey)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  static getItem<T = string>(key: string): T | null {
    try {
      if (!this.isAvailable()) {
        return StorageManager.getItem<T>(key)
      }
      const value = sessionStorage.getItem(key)
      if (value === null) {
        return null
      }
      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    } catch (error) {
      logger.error(`[SecureStorage] Failed to get storage item:`, error)
      return null
    }
  }

  static setItem<T>(key: string, value: T): boolean {
    try {
      if (!this.isAvailable()) {
        return StorageManager.setItem(key, value)
      }
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      sessionStorage.setItem(key, stringValue)
      return true
    } catch (error) {
      logger.error(`[SecureStorage] Failed to set storage item:`, error)
      return false
    }
  }

  static removeItem(key: string): boolean {
    try {
      if (!this.isAvailable()) {
        return StorageManager.removeItem(key)
      }
      sessionStorage.removeItem(key)
      return true
    } catch (error) {
      logger.error(`[SecureStorage] Failed to delete storage item:`, error)
      return false
    }
  }

  static clear(): boolean {
    try {
      if (!this.isAvailable()) {
        return false
      }
      sessionStorage.clear()
      return true
    } catch (error) {
      logger.error('[SecureStorage] Failed to clear storage:', error)
      return false
    }
  }

  static hasItem(key: string): boolean {
    try {
      if (!this.isAvailable()) {
        return StorageManager.hasItem(key)
      }
      return sessionStorage.getItem(key) !== null
    } catch {
      return false
    }
  }

  static migrateFromLocalStorage(key: string): boolean {
    try {
      const localValue = localStorage.getItem(key)
      if (localValue !== null) {
        this.setItem(key, localValue)
        localStorage.removeItem(key)
        logger.info(`[SecureStorage] migrated to secure storage`)
        return true
      }
      return false
    } catch (error) {
      logger.error(`[SecureStorage] Failed to migrate:`, error)
      return false
    }
  }
}

/**
 * 统一的 Token 存储工具
 * 解决 StorageManager（localStorage）与 SecureStorageManager（sessionStorage）双写/双读不一致问题
 *
 * 原则：写入时同时写入两处，读取时优先 sessionStorage（安全），清除时同时清除两处
 */
export const TokenStorage = {
  /**
   * 获取 token（优先 sessionStorage，降级 localStorage）
   */
  getItem<T = string>(key: string): T | null {
    const secure = SecureStorageManager.getItem<T>(key)
    if (secure !== null) return secure
    return StorageManager.getItem<T>(key)
  },

  /**
   * 同时写入 sessionStorage 和 localStorage
   */
  setItem<T>(key: string, value: T): void {
    StorageManager.setItem(key, value)
    SecureStorageManager.setItem(key, value)
  },

  /**
   * 同时从两处移除
   */
  removeItem(key: string): void {
    StorageManager.removeItem(key)
    SecureStorageManager.removeItem(key)
  },

  /**
   * 获取 access token（按优先级尝试多个键名）
   */
  getToken(): string | null {
    return (
      this.getItem<string>(STORAGE_KEYS.USER_TOKEN) ||
      this.getItem<string>(STORAGE_KEYS.TOKEN) ||
      this.getItem<string>(STORAGE_KEYS.ACCESS_TOKEN) ||
      null
    )
  },

  /**
   * 写入 access token（统一写入两个键名）
   */
  setToken(token: string): void {
    this.setItem(STORAGE_KEYS.TOKEN, token)
    this.setItem(STORAGE_KEYS.USER_TOKEN, token)
  },

  /**
   * 获取 refresh token
   */
  getRefreshToken(): string | null {
    return this.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN)
  },

  /**
   * 写入 refresh token
   */
  setRefreshToken(refreshToken: string): void {
    this.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
  },

  /**
   * 清除所有认证相关的存储（localStorage + sessionStorage）
   */
  clearAuth(): void {
    const authKeys = [
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.USER_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.LOGIN_EXPIRY_TIME,
      'refreshToken',
    ]
    authKeys.forEach(key => this.removeItem(key))
  },
}
