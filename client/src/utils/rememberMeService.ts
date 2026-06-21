/**
 * 记住我服务
 * 用于管理持久化登录状态
 */

import { logger } from './logger'
import { REMEMBER_ME_CONFIG } from '@/config/auth.config'

const REFRESH_TOKEN_KEY = REMEMBER_ME_CONFIG.REFRESH_TOKEN_KEY
const USER_PREFERENCE_KEY = REMEMBER_ME_CONFIG.USER_PREFERENCE_KEY
const REMEMBER_ME_CREDENTIALS_KEY = REMEMBER_ME_CONFIG.CREDENTIALS_KEY
const REMEMBER_ME_AUTO_LOGIN_KEY = REMEMBER_ME_CONFIG.AUTO_LOGIN_KEY
const MAX_CREDENTIALS_AGE = REMEMBER_ME_CONFIG.MAX_CREDENTIALS_AGE_MS
const MAX_FAILURE_COUNT = REMEMBER_ME_CONFIG.MAX_FAILURE_COUNT
const LOCK_DURATION = REMEMBER_ME_CONFIG.LOCK_DURATION_MS

export interface Credentials {
  phone?: string
  username?: string
  type?: 'phone' | 'account'
  refreshToken?: string
  countryCode?: string
  timestamp: number
}

interface AutoLoginRecord {
  failures: number
  lastFailureTime?: number
  isLocked: boolean
}

export class RememberMeService {
  private static isServer(): boolean {
    return typeof window === 'undefined'
  }

  static isRememberMeEnabled(): boolean {
    if (this.isServer()) return false
    return localStorage.getItem(USER_PREFERENCE_KEY) === 'true'
  }

  static setRememberMePreference(enabled: boolean): void {
    if (this.isServer()) return
    localStorage.setItem(USER_PREFERENCE_KEY, enabled.toString())
    logger.info('[RememberMe] Remember me preference set:', enabled)
  }

  static saveRefreshToken(token: string): void {
    if (this.isServer()) return
    if (!token) return
    if (!this.isRememberMeEnabled()) return

    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token)
      logger.info('[RememberMe] Refresh token saved')
    } catch (e) {
      logger.error('[RememberMe] Failed to save refresh token:', e)
    }
  }

  static getRefreshToken(): string | null {
    if (this.isServer()) return null
    if (!this.isRememberMeEnabled()) return null
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }

  static updateRefreshToken(token: string): void {
    this.saveRefreshToken(token)
  }

  static clearRefreshToken(): void {
    if (this.isServer()) return
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    logger.info('[RememberMe] Refresh token cleared')
  }

  static hasRefreshToken(): boolean {
    return !!this.getRefreshToken()
  }

  static clearAll(): void {
    if (this.isServer()) return
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_PREFERENCE_KEY)
    localStorage.removeItem(REMEMBER_ME_CREDENTIALS_KEY)
    localStorage.removeItem(REMEMBER_ME_AUTO_LOGIN_KEY)
    logger.info('[RememberMe] All data cleared')
  }

  static savePhoneCredentials(phone: string, countryCode?: string, refreshToken?: string): void {
    if (this.isServer()) return
    if (!phone) return

    const credentials: Credentials = {
      phone,
      countryCode: countryCode || '+86',
      refreshToken,
      type: 'phone',
      timestamp: Date.now()
    }
    localStorage.setItem(REMEMBER_ME_CREDENTIALS_KEY, JSON.stringify(credentials))
    logger.info('[RememberMe] Phone credentials saved')
  }

  static saveAccountCredentials(username: string, refreshToken?: string): void {
    if (this.isServer()) return
    if (!username) return

    const credentials: Credentials = {
      username,
      refreshToken,
      type: 'account',
      timestamp: Date.now()
    }
    localStorage.setItem(REMEMBER_ME_CREDENTIALS_KEY, JSON.stringify(credentials))
    logger.info('[RememberMe] Account credentials saved')
  }

  static getCredentials(): Credentials | null {
    if (this.isServer()) return null

    const data = localStorage.getItem(REMEMBER_ME_CREDENTIALS_KEY)
    if (!data) return null

    try {
      const credentials = JSON.parse(data) as Credentials
      if (Date.now() - credentials.timestamp > MAX_CREDENTIALS_AGE) {
        this.clearCredentials()
        return null
      }
      return credentials
    } catch {
      this.clearCredentials()
      return null
    }
  }

  static clearCredentials(): void {
    if (this.isServer()) return
    localStorage.removeItem(REMEMBER_ME_CREDENTIALS_KEY)
    localStorage.removeItem(REMEMBER_ME_AUTO_LOGIN_KEY)
    logger.info('[RememberMe] Credentials cleared')
  }

  static migrateOldCredentials(): void {
    if (this.isServer()) return

    const oldKeys = ['remember_me_phone', 'remember_me_user']
    let migrated = false

    for (const key of oldKeys) {
      const oldData = localStorage.getItem(key)
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData)
          if (parsed.phone || parsed.username) {
            const credentials: Credentials = {
              phone: parsed.phone,
              username: parsed.username,
              type: parsed.phone ? 'phone' : 'account',
              timestamp: parsed.timestamp || Date.now()
            }
            localStorage.setItem(REMEMBER_ME_CREDENTIALS_KEY, JSON.stringify(credentials))
            migrated = true
          }
          localStorage.removeItem(key)
        } catch {
          localStorage.removeItem(key)
        }
      }
    }

    if (migrated) {
      logger.info('[RememberMeService] Old credentials migrated')
    }
  }

  static recordAutoLoginFailure(reason: string): void {
    if (this.isServer()) return

    const record = this.getAutoLoginRecord()
    record.failures++
    record.lastFailureTime = Date.now()

    if (record.failures >= MAX_FAILURE_COUNT) {
      record.isLocked = true
      logger.warn('[RememberMeService] Auto login locked, failure count:', record.failures)
    }

    localStorage.setItem(REMEMBER_ME_AUTO_LOGIN_KEY, JSON.stringify(record))
    logger.info('[RememberMeService] Auto login failure recorded:', reason)
  }

  private static getAutoLoginRecord(): AutoLoginRecord {
    if (this.isServer()) return { failures: 0, isLocked: false }

    const data = localStorage.getItem(REMEMBER_ME_AUTO_LOGIN_KEY)
    if (!data) return { failures: 0, isLocked: false }

    try {
      return JSON.parse(data) as AutoLoginRecord
    } catch {
      return { failures: 0, isLocked: false }
    }
  }

  static isAutoLoginLocked(): boolean {
    if (this.isServer()) return false

    const record = this.getAutoLoginRecord()
    if (record.isLocked && record.lastFailureTime) {
      if (Date.now() - record.lastFailureTime > LOCK_DURATION) {
        this.resetAutoLoginRecord()
        return false
      }
    }
    return record.isLocked
  }

  static getLockRemainingTime(): number {
    if (this.isServer()) return 0

    const record = this.getAutoLoginRecord()
    if (record.isLocked && record.lastFailureTime) {
      const elapsed = Date.now() - record.lastFailureTime
      const remaining = LOCK_DURATION - elapsed
      return remaining > 0 ? remaining : 0
    }
    return 0
  }

  static getAutoLoginFailureCount(): number {
    return this.getAutoLoginRecord().failures
  }

  static resetAutoLoginRecord(): void {
    if (this.isServer()) return
    localStorage.removeItem(REMEMBER_ME_AUTO_LOGIN_KEY)
    logger.info('[RememberMeService] Auto login record reset')
  }

  static canAttemptAutoLogin(): boolean {
    if (!this.isRememberMeEnabled()) return false
    if (this.isAutoLoginLocked()) return false
    if (!this.hasRefreshToken()) return false
    return true
  }

  static init(): void {
    if (this.isServer()) return
    this.migrateOldCredentials()
    const credentials = this.getCredentials()
    if (credentials && Date.now() - credentials.timestamp > MAX_CREDENTIALS_AGE) {
      this.clearCredentials()
    }
  }
}

export default RememberMeService
