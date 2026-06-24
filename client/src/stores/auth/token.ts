import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StorageManager, SecureStorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
import {
  LOGIN_DURATION_OPTIONS,
  DEFAULT_LOGIN_DURATION,
  calculateExpiryTime,
  isLoginExpired,
  isExpiryTimePassed,
  type LoginDuration,
} from '@/utils/login-duration'
import { clearAuthStorage } from './utils'

export const useTokenStore = defineStore('token', () => {
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const loginTime = ref<string>('')
  const lastActiveTime = ref<string>('')
  const initCompleted = ref(false)

  const isInitialized = computed(() => !!token.value)

  const isTokenExpired = computed(() => {
    const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
    if (expiryTime !== null) {
      // expiryTime 是「过期时间戳」，应直接比较是否已过，而非用 isLoginExpired
      return isExpiryTimePassed(expiryTime)
    }
    if (!loginTime.value) return true
    const loginTimestamp = new Date(loginTime.value).getTime()
    const savedDuration = StorageManager.getItem<number>(STORAGE_KEYS.LOGIN_DURATION) || DEFAULT_LOGIN_DURATION
    return isLoginExpired(loginTimestamp, savedDuration)
  })

  const setToken = (newToken: string, newRefreshToken?: string) => {
    token.value = newToken
    if (newRefreshToken) {
      refreshToken.value = newRefreshToken
    }
    const currentTime = new Date().toISOString()
    loginTime.value = currentTime
    lastActiveTime.value = currentTime

    SecureStorageManager.setItem(STORAGE_KEYS.USER_TOKEN, newToken)
    SecureStorageManager.setItem(STORAGE_KEYS.TOKEN, newToken)
    if (newRefreshToken) {
      SecureStorageManager.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)
    }
  }

  const setLoginExpiry = (loginDuration?: LoginDuration) => {
    const duration = loginDuration ||
      StorageManager.getItem<LoginDuration>(STORAGE_KEYS.LOGIN_DURATION) ||
      LOGIN_DURATION_OPTIONS[1]
    // calculateExpiryTime 期望毫秒，应使用 duration.value（毫秒）而非 duration.days（天）
    // 兼容存储中可能存为 number/string 的情况
    let durationMs: number
    if (typeof duration === 'number') {
      durationMs = duration
    } else if (typeof duration === 'string') {
      durationMs = parseInt(duration, 10)
      if (Number.isNaN(durationMs)) durationMs = DEFAULT_LOGIN_DURATION
    } else if (duration && typeof duration.value === 'number') {
      durationMs = duration.value
    } else {
      durationMs = DEFAULT_LOGIN_DURATION
    }
    const expiryTime = calculateExpiryTime(durationMs)
    if (expiryTime !== null && !Number.isNaN(expiryTime)) {
      StorageManager.setItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME, expiryTime)
    } else {
      StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
    }
  }

  const restoreToken = (): boolean => {
    SecureStorageManager.migrateFromLocalStorage(STORAGE_KEYS.TOKEN)
    SecureStorageManager.migrateFromLocalStorage(STORAGE_KEYS.USER_TOKEN)
    SecureStorageManager.migrateFromLocalStorage(STORAGE_KEYS.REFRESH_TOKEN)

    const storedToken =
      SecureStorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
      SecureStorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN) ||
      StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
      StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)

    if (!storedToken) {
      logger.debug('[TokenStore] No stored token found')
      return false
    }

    token.value = storedToken
    const storedRefreshToken = 
      SecureStorageManager.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN) ||
      StorageManager.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN)
    if (storedRefreshToken) {
      refreshToken.value = storedRefreshToken
    }
    logger.debug('[TokenStore] Token restored')
    return true
  }

  const checkExpiryAndClear = (): boolean => {
    const storedExpiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
    // storedExpiryTime 是「过期时间戳」，应使用 isExpiryTimePassed 判断
    if (storedExpiryTime !== null && isExpiryTimePassed(storedExpiryTime)) {
      logger.info('[TokenStore] Login expired, clearing auth state')
      clearTokens()
      return true
    }
    return false
  }

  const clearTokens = () => {
    token.value = ''
    refreshToken.value = ''
    loginTime.value = ''
    lastActiveTime.value = ''
    clearAuthStorage()
  }

  const updateLastActiveTime = () => {
    lastActiveTime.value = new Date().toISOString()
  }

  const setInitCompleted = (value: boolean) => {
    initCompleted.value = value
  }

  const checkTokenExpiry = (onRefresh: () => void) => {
    const now = new Date().getTime()
    const loginTimeMs = new Date(loginTime.value).getTime()
    const savedDuration = StorageManager.getItem<number>(STORAGE_KEYS.LOGIN_DURATION) || DEFAULT_LOGIN_DURATION

    if (now - loginTimeMs > savedDuration * 0.8) {
      onRefresh()
    }
  }

  return {
    token,
    refreshToken,
    loginTime,
    lastActiveTime,
    initCompleted,
    isInitialized,
    isTokenExpired,
    setToken,
    setLoginExpiry,
    restoreToken,
    checkExpiryAndClear,
    clearTokens,
    updateLastActiveTime,
    setInitCompleted,
    checkTokenExpiry,
  }
})
