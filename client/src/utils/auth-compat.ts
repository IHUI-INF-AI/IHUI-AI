/**
 * 认证兼容性模块
 * 提供认证相关的兼容性功能
 */

import { logger } from './logger'

/**
 * 完全清除登录数据
 * 包括所有存储的认证信息
 */
export function clearLoginDataCompletely(): void {
  if (typeof window === 'undefined') return

  // 清除 localStorage 中的认证数据
  const keysToRemove = [
    'token',
    'access_token',
    'refresh_token',
    'user_info',
    'userId',
    'login_time',
    'remember_me',
    'auth_state',
  ]

  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (_e) {
      // 忽略清除错误
    }
  })

  // 清除 sessionStorage
  try {
    sessionStorage.clear()
  } catch (_e) {
    // 忽略清除错误
  }

  logger.info('[auth-compat] Login data fully cleared')
}

/**
 * 清除所有认证数据（别名）
 */
export function clearAllAuthData(): void {
  return clearLoginDataCompletely()
}

/**
 * 检查是否有登录数据
 */
export function hasLoginData(): boolean {
  if (typeof window === 'undefined') return false

  const token = localStorage.getItem('token') || localStorage.getItem('access_token')
  return !!token
}

/**
 * 获取存储的 token
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null

  return (
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token')
  )
}

/**
 * 设置 token
 */
export function setStoredToken(token: string, remember: boolean = false): void {
  if (typeof window === 'undefined') return

  if (remember) {
    localStorage.setItem('token', token)
  } else {
    sessionStorage.setItem('token', token)
  }
}

/**
 * 清除 token
 */
export function clearStoredToken(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem('token')
  localStorage.removeItem('access_token')
  sessionStorage.removeItem('token')
}
