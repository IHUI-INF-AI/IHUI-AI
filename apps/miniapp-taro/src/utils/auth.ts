/**
 * 鉴权 Token 管理
 * 基于 Taro.storage 持久化 + createInMemoryTokenStore 内存缓存工厂
 */
import { getStorageSync, setStorageSync, removeStorageSync, reLaunch } from '@tarojs/taro'
import type { LoginResult as SharedLoginResult, AuthUser } from '@ihui/api-client'
import {
  TOKEN_STORAGE_KEY as TOKEN_KEY,
  REFRESH_TOKEN_STORAGE_KEY as REFRESH_TOKEN_KEY,
} from '@ihui/shared/constants'
import { createInMemoryTokenStore } from '@ihui/shared/auth'
import type { TokenStoreWithUserInfo } from '@ihui/shared/auth'

const USER_INFO_KEY = 'ihui_user_info'

/**
 * 用户信息 — 字段复用 @ihui/api-client AuthUser(单一来源),
 * 仅本地保留 miniapp-taro 语义差异字段:
 *  - id: AuthUser 为必填 string,此处保留可选 string|number(兼容历史 storage 数据)
 *  - isVip: AuthUser 为 number,此处保留 boolean(前端布尔语义)
 *  - uuid/userName/realName: miniapp-taro 特有扩展
 */
export interface UserInfo extends Omit<AuthUser, 'id' | 'isVip'> {
  id?: string | number
  isVip?: boolean
  uuid?: string
  userName?: string
  realName?: string
  balance?: number
  realnameStatus?: string
  idCard?: string
  realnameRejectReason?: string
}

/**
 * 登录结果 — token 四字段复用 @ihui/api-client LoginResult(单一来源),
 * user 保留 miniapp-taro UserInfo(含 uuid/userName 等扩展,登录流程依赖)。
 */
export interface LoginResult extends Omit<SharedLoginResult, 'user'> {
  user: UserInfo
}

/**
 * 内存缓存 TokenStore(Taro.storage 持久化层)
 *
 * 工厂维护 token/refreshToken 内存缓存,通过回调将持久化下放到本端:
 * - initial:模块加载时从 Taro.storage 同步 hydrate 缓存
 * - onSetToken/onSetRefreshToken/onClearAll:同步写 Taro.storage(返回 void,
 *   工厂接受 Promise<void> | void)
 *
 * 注意:token-store.ts 注释明确 miniapp-taro 因同步 storage 语义不匹配,通常不走
 * bindTokenStoreToApiClient 适配器;app.tsx 仍调用 bindTokenStoreToApiClient(tokenStore)
 * 仅做类型契约验证,实际 token 注入由 createNotificationClient 的 tokenProvider 负责。
 */
const tokenStoreCore = createInMemoryTokenStore({
  initial: {
    token: getStorageSync(TOKEN_KEY) || null,
    refreshToken: getStorageSync(REFRESH_TOKEN_KEY) || null,
  },
  onSetToken: (token) => setStorageSync(TOKEN_KEY, token ?? ''),
  onSetRefreshToken: (token) => setStorageSync(REFRESH_TOKEN_KEY, token ?? ''),
  onClearAll: () => {
    removeStorageSync(TOKEN_KEY)
    removeStorageSync(REFRESH_TOKEN_KEY)
    removeStorageSync(USER_INFO_KEY)
  },
})

/** 获取 Token */
export function getToken(): string {
  return tokenStoreCore.getToken() ?? ''
}

/** 设置 Token */
export function setToken(token: string): void {
  void tokenStoreCore.setToken(token)
}

/** 获取 Refresh Token */
export function getRefreshToken(): string {
  return tokenStoreCore.getRefreshToken() ?? ''
}

/** 设置 Refresh Token */
export function setRefreshToken(token: string): void {
  void tokenStoreCore.setRefreshToken(token)
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
  void tokenStoreCore.clearAll()
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

/**
 * TokenStore 契约接入(类型层验证 + UserInfo 扩展)
 *
 * 在 createInMemoryTokenStore 之上扩展 UserInfo 管理,构成 TokenStoreWithUserInfo。
 * app.tsx 调用 bindTokenStoreToApiClient(tokenStore) 做类型契约验证;实际 token
 * 注入由 createNotificationClient 的 tokenProvider 负责(因同步 storage 语义不匹配,
 * 通常不走 bindTokenStoreToApiClient,见 token-store.ts 注释)。
 *
 * 注意:
 * - clearAuth 同时清除 token + refreshToken + userInfo,映射到 clearAll
 * - getToken/getRefreshToken 返回 string(空串表空),TokenStore 要求 string | null,
 *   string 是 string | null 的子类型,协变位置赋值兼容
 */
export const tokenStore: TokenStoreWithUserInfo<UserInfo> = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearAuth,
  getUserInfo,
  setUserInfo,
}
