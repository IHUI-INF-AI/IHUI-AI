/**
 * 鉴权 Token 管理
 * 基于 uni.storage 的本地持久化
 */

const TOKEN_KEY = 'ihui_token'
const USER_INFO_KEY = 'ihui_user_info'

export interface UserInfo {
  id?: string | number
  uuid?: string
  userName?: string
  nickname?: string
  avatar?: string
  phone?: string
  isVip?: boolean
  [key: string]: any
}

/** 获取 Token */
export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

/** 设置 Token */
export function setToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token)
}

/** 获取用户信息 */
export function getUserInfo(): UserInfo | null {
  const info = uni.getStorageSync(USER_INFO_KEY)
  return info || null
}

/** 设置用户信息 */
export function setUserInfo(info: UserInfo): void {
  uni.setStorageSync(USER_INFO_KEY, info)
}

/** 清除登录态 */
export function clearAuth(): void {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_INFO_KEY)
}

/** 是否已登录 */
export function isLoggedIn(): boolean {
  return !!getToken()
}

/**
 * 检查登录状态，未登录时按需跳转登录页
 * @param redirect 是否在未登录时跳转登录页，默认 true
 * @returns 是否已登录
 */
export function checkLoginStatus(redirect = false): boolean {
  const loggedIn = isLoggedIn()
  if (!loggedIn && redirect) {
    uni.reLaunch({ url: '/pages/login/login' })
  }
  return loggedIn
}
