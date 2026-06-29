import Cookies from 'js-cookie'

import { COZE_PATHS } from '@/config/backend-paths'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/core'
import { TokenStorage } from '@/utils/storage'
// 旧版键名（仅用于清理历史残留数据，新代码不应使用）
const _LEGACY_TOKEN_KEY = 'ai_zhihui_token'
const _LEGACY_REFRESH_TOKEN_KEY = 'ai_zhihui_refresh_token'
const _LEGACY_USER_KEY = 'ai_zhihui_user'
const _LEGACY_LOGIN_TIME_KEY = 'ai_zhihui_login_time'
const _LEGACY_LAST_ACTIVE_KEY = 'ai_zhihui_last_active'

// Token管理 - 统一通过 TokenStorage
export function getToken(): string | undefined {
  return TokenStorage.getToken() || undefined
}

export function setToken(token: string, _remember: boolean = false): void {
  TokenStorage.setToken(token)
}

export function removeToken(): void {
  TokenStorage.clearAuth()
  Cookies.remove(_LEGACY_TOKEN_KEY)
  localStorage.removeItem(_LEGACY_TOKEN_KEY)
  sessionStorage.removeItem(_LEGACY_TOKEN_KEY)
  Cookies.remove(_LEGACY_USER_KEY)
  localStorage.removeItem(_LEGACY_USER_KEY)
  sessionStorage.removeItem(_LEGACY_USER_KEY)
}

// RefreshToken管理 - 统一通过 TokenStorage
export function getRefreshToken(): string | undefined {
  return TokenStorage.getRefreshToken() || undefined
}

export function setRefreshToken(refreshToken: string, _remember: boolean = false): void {
  TokenStorage.setRefreshToken(refreshToken)
}

export function removeRefreshToken(): void {
  Cookies.remove(_LEGACY_REFRESH_TOKEN_KEY)
  localStorage.removeItem(_LEGACY_REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(_LEGACY_REFRESH_TOKEN_KEY)
}

// 用户信息管理 - 统一从 STORAGE_KEYS.USER_DATA 获取
export function getUserFromStorage(): Record<string, unknown> | null {
  try {
    const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (userData) return userData
    // 兼容 authStore 使用的 user_data（snake_case）
    const userDataSnake = StorageManager.getItem<Record<string, unknown>>('user_data')
    if (userDataSnake) return userDataSnake
  } catch (error) {
    logger.error('Failed to get user info:', error)
  }
  return null
}

export function getUserUuid(): string {
  try {
    // 1. 从统一用户存储中获取
    let storedUser = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

    // 1.5 兼容 authStore 使用的 user_data（snake_case）
    if (!storedUser) {
      storedUser = StorageManager.getItem<Record<string, unknown>>('user_data')
    }

    if (storedUser) {
      // 顶层 UUID / ID
      const directUuid =
        (storedUser.uuid as string) ||
        (storedUser.id as string) ||
        (storedUser.userId as string) ||
        (storedUser.userUuid as string)

      if (directUuid) return directUuid

      // 兼容嵌套在资金信息/保证金信息中的 userId/userUuid
      const userMargin = storedUser.userMargin as
        | { userUuid?: string; userId?: string }
        | undefined
      const fundInfo = storedUser.fundInfo as
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
    logger.error('Failed to get userUuid:', error)
  }

  // 2. 兼容无登录场景下的 guest UUID（旧项目在 window/localStorage 中设置）
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

  // 找不到任何有效的用户ID时，返回空字符串
  return ''
}

// 用户信息写入（已废弃，新代码应直接使用 StorageManager.setItem(STORAGE_KEYS.USER_DATA, user)）
/** @deprecated 使用 StorageManager.setItem(STORAGE_KEYS.USER_DATA, user) 替代 */
export function setUserToStorage(user: Record<string, unknown>, remember: boolean = false): void {
  const userStr = JSON.stringify(user)
  if (remember) {
    localStorage.setItem(_LEGACY_USER_KEY, userStr)
  } else {
    sessionStorage.setItem(_LEGACY_USER_KEY, userStr)
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
  return localStorage.getItem(_LEGACY_LOGIN_TIME_KEY) || sessionStorage.getItem(_LEGACY_LOGIN_TIME_KEY) || undefined
}

export function setLoginTime(time: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem(_LEGACY_LOGIN_TIME_KEY, time)
  } else {
    sessionStorage.setItem(_LEGACY_LOGIN_TIME_KEY, time)
  }
}

export function removeLoginTime(): void {
  localStorage.removeItem(_LEGACY_LOGIN_TIME_KEY)
  sessionStorage.removeItem(_LEGACY_LOGIN_TIME_KEY)
}

// 最后活跃时间管理
export function getLastActiveTime(): string | undefined {
  return localStorage.getItem(_LEGACY_LAST_ACTIVE_KEY) || sessionStorage.getItem(_LEGACY_LAST_ACTIVE_KEY) || undefined
}

export function setLastActiveTime(time: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem(_LEGACY_LAST_ACTIVE_KEY, time)
  } else {
    sessionStorage.setItem(_LEGACY_LAST_ACTIVE_KEY, time)
  }
}

export function removeLastActiveTime(): void {
  localStorage.removeItem(_LEGACY_LAST_ACTIVE_KEY)
  sessionStorage.removeItem(_LEGACY_LAST_ACTIVE_KEY)
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

// 执行token刷新的核心逻辑（使用 axios，统一响应解析）
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
    // 兼容多种响应格式
    const token = data?.data?.token || data?.data?.accessToken || data?.token || data?.accessToken
    const newRefresh = data?.data?.refreshToken || data?.refreshToken || refreshToken

    if (token) {
      return { token, refreshToken: newRefresh }
    } else {
      logger.error('Refresh token API error: no token in response', data.message)
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
  // 如果 token 在 localStorage 中（记住登录模式），则登录时间也持久化
  const remember = !!TokenStorage.getItem<string>(STORAGE_KEYS.TOKEN) &&
    !!TokenStorage.getToken()
  setLastActiveTime(currentTime, remember)
}

// 导出兼容函数
export { clearLoginDataCompletely, clearAllAuthData } from './auth-compat'

/**
 * 获取安全的重定向路径
 * 只允许以单个 / 开头的相对路径，拒绝 // (协议相对 URL) 和 http(s):// 等绝对 URL
 * 防止开放重定向漏洞
 */
export function getSafeRedirectPath(redirect: string | undefined | null): string {
  if (!redirect || typeof redirect !== 'string') return '/'
  // 去除首尾空白
  const path = redirect.trim()
  // 拒绝空、协议相对 URL (//)、绝对 URL (http://, https://)、非 / 开头
  if (!path || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path) || !path.startsWith('/')) {
    return '/'
  }
  // 防止回退攻击：不允许 \ (Windows 路径分隔符)
  if (path.includes('\\')) return '/'
  return path
}