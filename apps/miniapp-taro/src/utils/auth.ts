/**
 * 鉴权 Token 管理
 * 基于 Taro.storage 的本地持久化
 */
import { getStorageSync, setStorageSync, removeStorageSync, reLaunch } from '@tarojs/taro'
import type { LoginResult as SharedLoginResult, AuthUser } from '@ihui/api-client'

const TOKEN_KEY = 'ihui_token'
const REFRESH_TOKEN_KEY = 'ihui_refresh_token'
const USER_INFO_KEY = 'ihui_user_info'

/**
 * 用户信息 — 字段复用 @ihui/api-client AuthUser(单一来源),
 * 仅本地保留 miniapp-taro 语义差异字段:
 *  - id: AuthUser 为必填 string,此处保留可选 string|number(兼容历史 storage 数据)
 *  - isVip: AuthUser 为 number,此处保留 boolean(前端布尔语义)
 *  - uuid/userName/realName: miniapp-taro 特有扩展
 *  - [key: string]: unknown 索引签名(兼容后端任意附加字段)
 */
export interface UserInfo extends Omit<AuthUser, 'id' | 'isVip'> {
  id?: string | number
  isVip?: boolean
  uuid?: string
  userName?: string
  realName?: string
  [key: string]: unknown
}

/**
 * 登录结果 — token 四字段复用 @ihui/api-client LoginResult(单一来源),
 * user 保留 miniapp-taro UserInfo(含 uuid/userName 等扩展,登录流程依赖)。
 */
export interface LoginResult extends Omit<SharedLoginResult, 'user'> {
  user: UserInfo
}

/** 获取 Token */
export function getToken(): string {
  return getStorageSync(TOKEN_KEY) || ''
}

/** 设置 Token */
export function setToken(token: string): void {
  setStorageSync(TOKEN_KEY, token)
}

/** 获取 Refresh Token */
export function getRefreshToken(): string {
  return getStorageSync(REFRESH_TOKEN_KEY) || ''
}

/** 设置 Refresh Token */
export function setRefreshToken(token: string): void {
  setStorageSync(REFRESH_TOKEN_KEY, token)
}

/** 获取用户信息 */
export function getUserInfo(): UserInfo | null {
  const info = getStorageSync(USER_INFO_KEY)
  return info || null
}

/** 设置用户信息 */
export function setUserInfo(info: UserInfo): void {
  setStorageSync(USER_INFO_KEY, info)
}

/** 清除登录态 */
export function clearAuth(): void {
  removeStorageSync(TOKEN_KEY)
  removeStorageSync(REFRESH_TOKEN_KEY)
  removeStorageSync(USER_INFO_KEY)
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
    reLaunch({ url: '/pages/login/login' })
  }
  return loggedIn
}
