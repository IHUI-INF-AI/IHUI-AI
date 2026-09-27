// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权 Token 管理
 * 基于 Taro.storage 持久化 + createInMemoryTokenStore 内存缓存工厂
 */
import {
  getStorageSync,
  setStorageSync,
  removeStorageSync,
  reLaunch,
  getCurrentPages,
} from '@tarojs/taro'
import {
  fetchApi,
  type LoginResult as SharedLoginResult,
  type AuthUser,
  type UnauthorizedContext,
} from '@ihui/api-client'
import {
  TOKEN_STORAGE_KEY as TOKEN_KEY,
  REFRESH_TOKEN_STORAGE_KEY as REFRESH_TOKEN_KEY,
  USER_INFO_STORAGE_KEY,
} from '@ihui/shared/constants'
import { createInMemoryTokenStore } from '@ihui/shared/auth'
import type { TokenStoreWithUserInfo } from '@ihui/shared/auth'

// legacy underscore key (read-only for migration); new key uses hyphen via USER_INFO_STORAGE_KEY
const USER_INFO_KEY_LEGACY = 'ihui_user_info'

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
    removeStorageSync(USER_INFO_STORAGE_KEY)
    removeStorageSync(USER_INFO_KEY_LEGACY)
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
  const newData = getStorageSync(USER_INFO_STORAGE_KEY)
  if (newData) return newData as UserInfo
  const oldData = getStorageSync(USER_INFO_KEY_LEGACY)
  if (oldData) {
    setStorageSync(USER_INFO_STORAGE_KEY, oldData)
    removeStorageSync(USER_INFO_KEY_LEGACY)
    return oldData as UserInfo
  }
  return null
}

/** 设置用户信息 */
export function setUserInfo(info: UserInfo): void {
  setStorageSync(USER_INFO_STORAGE_KEY, info)
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

/** 登录页路由(与 app.config.ts 的 pages 串一致;不是 tabBar 页,可用 reLaunch 直达) */
const LOGIN_PAGE = 'pages/login/login'

/**
 * 401 静默续期(2026-09-27 立,补齐与 RN/web 的同源能力)
 *
 * 此前 `bindTokenStoreToApiClient(tokenStore)` **没有注入 refreshAccessToken**,而
 * `refreshAccessTokenOnce()` 的第一行就是 `if (!tokenProvider.refreshAccessToken) return null`
 * ⇒ 小程序侧每一次 access token 过期都直接判死,没有第二次机会。RN 端 2026-09-22 已补同一回调
 * (注释原文:"登录 15 分钟后全部鉴权接口失效"),小程序一直缺 —— 这是 §9"任何一端改了样式/组件/
 * 主题必须同步另一端"在认证链上的同一个洞。
 *
 * 走 fetchApi 自身:`/auth/refresh` 属认证端点,401 拦截器对它豁免,不会递归续期。
 * 成功 → 轮转写回 token(+ refreshToken);失败 → 返回 null,由 api-client 的失败冷却兜底。
 */
export async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = getRefreshToken()
  const res = await fetchApi<{ accessToken: string; refreshToken?: string | null }>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    },
  )
  if (res.success && res.data?.accessToken) {
    setToken(res.data.accessToken)
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    return res.data.accessToken
  }
  return null
}

/**
 * 会话彻底失效的统一出口(与 apps/mobile-rn/src/lib/token.ts 同一设计,2026-09-27)
 *
 * 三条边界与 RN 逐字同形:
 * 1. **游客态不接管** —— 手里没有凭据时 401 的含义是"这个接口要登录",不是"你的会话死了";
 * 2. **不重复跳** —— 直接读当前页栈判定"是不是已经在登录页",不引入需要复位的模块级布尔量;
 * 3. **不清凭据** —— 清 storage 会让在飞 UI 立刻翻成未登录态(头像/余额闪空),观感比停在原页更差;
 *    登录成功后 `setToken` 自然覆盖。
 */
export function onUnrecoverableUnauthorized(ctx: UnauthorizedContext): void {
  // 与 RN 端同批改:不再以"手里有没有 token"作准入条件(2026-09-27 真机实测)。
  // 能进到这里的前提已经是"本应用主动发了一次需要身份的请求且它 401 了"。
  const pages = getCurrentPages()
  const current = pages.length > 0 ? pages[pages.length - 1]?.route : undefined
  if (current === LOGIN_PAGE) return
  if (pages.length === 0) {
    console.warn(`[mp-auth] 会话失效但读不到当前页面栈,仍跳登录页(来源 ${ctx.method} ${ctx.url})`)
  }
  void reLaunch({ url: `/${LOGIN_PAGE}` })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
