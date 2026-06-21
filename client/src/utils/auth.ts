import Cookies from 'js-cookie'

import { COZE_PATHS } from '@/config/backend-paths'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/core'
const TOKEN_KEY = 'ai_zhihui_token'
const REFRESH_TOKEN_KEY = 'ai_zhihui_refresh_token'
const USER_KEY = 'ai_zhihui_user'
const LOGIN_TIME_KEY = 'ai_zhihui_login_time'
const LAST_ACTIVE_KEY = 'ai_zhihui_last_active'

// Token管理
export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || undefined
}

export function setToken(token: string, remember: boolean = false): void {
  if (remember) {
    // 记住登录状态，使用localStorage
    localStorage.setItem(TOKEN_KEY, token)
    Cookies.set(TOKEN_KEY, token, { expires: 30 }) // 30天过期
  } else {
    // 会话登录，使用sessionStorage
    sessionStorage.setItem(TOKEN_KEY, token)
    Cookies.set(TOKEN_KEY, token) // 浏览器会话过期
  }
}

export function removeToken(): void {
  Cookies.remove(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  Cookies.remove(USER_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(USER_KEY)
}

// RefreshToken管理
export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY) || undefined
}

export function setRefreshToken(refreshToken: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 })
  } else {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export function removeRefreshToken(): void {
  Cookies.remove(REFRESH_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

// 用户信息管理
export function getUserFromStorage(): Record<string, unknown> | null {
  const userStr =
    Cookies.get(USER_KEY) || localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
  if (userStr) {
    try {
      return JSON.parse(userStr)
    } catch (error) {
      logger.error('Failed to parse user info:', error)
      return null
    }
  }
  return null
}

export function getUserUuid(): string {
  // 1. 优先从统一用户存储（core userStore 使用的 userInfo）中获取
  try {
    const storedUser = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (storedUser) {
      const uuid = (storedUser.uuid as string) || (storedUser.id as string)
      if (uuid) return uuid
    }
  } catch (error) {
    logger.error('Failed to get userInfo from StorageManager:', error)
  }

  // 1.5 兼容新版认证流程：从统一的 USER_DATA（authStore 使用的 userData）中获取
  try {
    // 新版核心存储：userData（camelCase）
    let storedUserData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

    // 兼容 authStore 使用的 user_data（snake_case）
    if (!storedUserData) {
      storedUserData = StorageManager.getItem<Record<string, unknown>>('user_data')
    }

    if (storedUserData) {
      // 1.5.1 顶层 UUID / ID
      const directUuid =
        (storedUserData.uuid as string) ||
        (storedUserData.id as string) ||
        (storedUserData.userId as string) ||
        (storedUserData.userUuid as string)

      if (directUuid) return directUuid

      // 1.5.2 兼容嵌套在资金信息/保证金信息中的 userId/userUuid（如 userMargin.userUuid、fundInfo.userId）
      const userMargin = storedUserData.userMargin as
        | { userUuid?: string; userId?: string }
        | undefined
      const fundInfo = storedUserData.fundInfo as
        | { userUuid?: string; userId?: string }
        | undefined

      const nestedUuid =
        userMargin?.userUuid ||
        userMargin?.userId ||
        fundInfo?.userUuid ||
        fundInfo?.userId

      if (nestedUuid) return nestedUuid
    }
  } catch (error) {
    logger.error('Failed to get userData from StorageManager:', error)
  }

  // 2. 兼容旧逻辑：从 Cookies/localStorage 中的 ai_zhihui_user 获取
  const user = getUserFromStorage()
  if (user) {
    const legacyUuid =
      (user.uuid as string) ||
      (user.id as string) ||
      (user.userId as string) ||
      (user.userUuid as string)

    if (legacyUuid) return legacyUuid
  }

  // 3. 兼容无登录场景下的 guest UUID（旧项目在 window/localStorage 中设置）
  try {
    if (typeof window !== 'undefined') {
      const win = window as unknown as { userUuid?: string }
      if (win.userUuid && typeof win.userUuid === 'string') {
        return win.userUuid
      }
    }
  } catch (error) {
    logger.error('Failed to get userUuid from window.userUuid:', error)
  }

  try {
    const localUserUuid = localStorage.getItem('userUuid')
    if (localUserUuid) return localUserUuid
  } catch (error) {
    logger.error('Failed to get userUuid from localStorage.userUuid:', error)
  }

  // 4. 找不到任何有效的用户ID时，返回空字符串
  //    由调用方自行决定是否发起需要 user_uuid 的请求
  return ''
}

export function setUserToStorage(user: Record<string, unknown>, remember: boolean = false): void {
  const userStr = JSON.stringify(user)
  if (remember) {
    localStorage.setItem(USER_KEY, userStr)
    Cookies.set(USER_KEY, userStr, { expires: 30 })
  } else {
    sessionStorage.setItem(USER_KEY, userStr)
    Cookies.set(USER_KEY, userStr)
  }
}

export function clearUserStorage(): void {
  removeToken()
  removeRefreshToken()
  removeLoginTime()
  removeLastActiveTime()
}

// 清除所有认证信息的别名函数
export function clearAuth(): void {
  clearUserStorage()
}

// 登录时间管理
export function getLoginTime(): string | undefined {
  return Cookies.get(LOGIN_TIME_KEY) || localStorage.getItem(LOGIN_TIME_KEY) || undefined
}

export function setLoginTime(time: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem(LOGIN_TIME_KEY, time)
    Cookies.set(LOGIN_TIME_KEY, time, { expires: 30 })
  } else {
    sessionStorage.setItem(LOGIN_TIME_KEY, time)
    Cookies.set(LOGIN_TIME_KEY, time)
  }
}

export function removeLoginTime(): void {
  Cookies.remove(LOGIN_TIME_KEY)
  localStorage.removeItem(LOGIN_TIME_KEY)
  sessionStorage.removeItem(LOGIN_TIME_KEY)
}

// 最后活跃时间管理
export function getLastActiveTime(): string | undefined {
  return Cookies.get(LAST_ACTIVE_KEY) || localStorage.getItem(LAST_ACTIVE_KEY) || undefined
}

export function setLastActiveTime(time: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem(LAST_ACTIVE_KEY, time)
    Cookies.set(LAST_ACTIVE_KEY, time, { expires: 30 })
  } else {
    sessionStorage.setItem(LAST_ACTIVE_KEY, time)
    Cookies.set(LAST_ACTIVE_KEY, time)
  }
}

export function removeLastActiveTime(): void {
  Cookies.remove(LAST_ACTIVE_KEY)
  localStorage.removeItem(LAST_ACTIVE_KEY)
  sessionStorage.removeItem(LAST_ACTIVE_KEY)
}

// Token验证
export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true

  try {
    // 解析JWT token
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Date.now() / 1000
    return payload.exp < currentTime
  } catch (error) {
    logger.error('Failed to parse token:', error)
    return true
  }
}

// 检查Token是否即将过期（提前5分钟刷新）
export function isTokenExpiringSoon(): boolean {
  const token = getToken()
  if (!token) return true

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Date.now() / 1000
    const fiveMinutesFromNow = currentTime + 5 * 60 // 5分钟
    return payload.exp < fiveMinutesFromNow
  } catch (error) {
    logger.error('Failed to parse token:', error)
    return true
  }
}

// 获取Token剩余时间（秒）
export function getTokenRemainingTime(): number {
  const token = getToken()
  if (!token) return 0

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Date.now() / 1000
    return Math.max(0, payload.exp - currentTime)
  } catch (error) {
    logger.error('Failed to parse token:', error)
    return 0
  }
}

// 刷新token状态管理
let isRefreshing = false
let refreshPromise: Promise<{
  token: string
  refreshToken: string
} | null> | null = null

// 刷新token（需要与API接口对接）
export async function refreshTokenFromAPI(): Promise<{
  token: string
  refreshToken: string
} | null> {
  // 如果正在刷新，返回现有的Promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    logger.warn('No refresh token, need to re-login')
    clearAuth()
    return null
  }

  isRefreshing = true
  refreshPromise = performTokenRefresh(refreshToken)

  try {
    const result = await refreshPromise
    if (result) {
      // 更新token
      setToken(result.token)
      setRefreshToken(result.refreshToken)
      logger.info('Token refreshed successfully')
    } else {
      // 刷新失败，清除认证信息
      clearAuth()
      logger.warn('Token refresh failed, auth info cleared')
    }
    return result
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}

// 执行token刷新的核心逻辑
async function performTokenRefresh(
  refreshToken: string
): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const response = await fetch(COZE_PATHS.users.refreshToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('Refresh token expired, need to re-login')
        return null
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.code === 200 || data.code === 0) {
      return {
        token: data.data.token,
        refreshToken: data.data.refreshToken,
      }
    } else {
      logger.error('Refresh token API error:', data.message)
      return null
    }
  } catch (error) {
    logger.error('Refresh token network request failed:', error)
    return null
  }
}

// 自动刷新token
export async function autoRefreshToken(): Promise<boolean> {
  const token = getToken()
  if (!token) return false

  // 检查token是否即将过期（5分钟内）
  if (isTokenExpiringSoon()) {
    const result = await refreshTokenFromAPI()
    return !!result
  }
  return true
}

// 权限检查
export function hasPermission(permission: string): boolean {
  const user = getUserFromStorage()
  if (!user) return false

  const permissions = user.permissions
  if (!Array.isArray(permissions)) return false

  return permissions.includes(permission) || permissions.includes('*')
}

// 角色检查
export function hasRole(role: string): boolean {
  const user = getUserFromStorage()
  if (!user) return false

  const roles = user.roles
  if (!Array.isArray(roles)) return false

  return roles.includes(role) || roles.includes('admin')
}

// VIP状态检查
export function isVipUser(): boolean {
  const user = getUserFromStorage()
  if (!user) return false

  const isVip = user.isVip
  const vipLevel = user.vipLevel
  // vipLevel 可能是等级名称（字符串）或等级ID
  // 如果有有效的 vipLevel 值（非空字符串或正数），则认为是VIP
  return isVip === true || 
    (typeof vipLevel === 'string' && vipLevel.length > 0) ||
    (typeof vipLevel === 'number' && vipLevel > 0)
}

// 检查VIP是否过期
export function isVipExpired(): boolean {
  const user = getUserFromStorage()
  if (!user) return true

  const vipEndTime = user.vipEndTime
  if (!vipEndTime || typeof vipEndTime !== 'string') return true

  const endTime = new Date(vipEndTime).getTime()
  const currentTime = Date.now()
  return currentTime > endTime
}

// 更新最后活跃时间
export function updateLastActiveTime(): void {
  const currentTime = new Date().toISOString()
  const remember = !!localStorage.getItem(TOKEN_KEY) // 如果token在localStorage中，说明是记住登录
  setLastActiveTime(currentTime, remember)
}

// 导出兼容函数
export { clearLoginDataCompletely, clearAllAuthData } from './auth-compat'