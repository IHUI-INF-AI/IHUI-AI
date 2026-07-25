/**
 * @ihui/shared/auth/token-store — 跨端 Token 管理通用契约
 *
 * 三端(extension/mobile-rn/miniapp-taro)token 管理实现差异:
 * - extension: chrome.storage.local 异步 + onChanged 监听
 * - mobile-rn: SecureStore 异步 + AsyncStorage fallback
 * - miniapp-taro: Taro.storage 同步(无 setTokenProvider 注入,因 API 语义不匹配)
 *
 * 本文件提供:
 * 1. TokenStore 接口:跨端类型契约(可选方法允许各端按需实现)
 * 2. TokenStoreWithUserInfo 接口:扩展契约(含 UserInfo 管理)
 * 3. createInMemoryTokenStore:可复用内存缓存工厂(各端 adapter 基类)
 * 4. bindTokenStoreToApiClient:统一注入到 @ihui/api-client 的适配器
 *
 * 各端**可选**接入:现有实现保持不变,后续重构或新端接入时复用此契约。
 */

import { setTokenProvider } from '@ihui/api-client'

/**
 * 跨端 Token 存储契约
 *
 * 描述 extension/mobile-rn/miniapp-taro 三端 token 管理的统一类型契约。
 * 同步方法(getToken/getRefreshToken)兼容内存缓存与 sync storage 两种语义;
 * 异步方法(setToken/setRefreshToken)返回 Promise<void> | void,
 * 兼容 chrome.storage.local / SecureStore / Taro.storage 等不同存储后端。
 * clearAll 为可选方法,允许各端按需实现(部分端命名差异如 clearAuth)。
 */
export interface TokenStore {
  /** 同步获取 token(extension/mobile-rn 走缓存,miniapp-taro 走 sync storage) */
  getToken(): string | null
  /** 同步获取 refresh token */
  getRefreshToken(): string | null
  /** 异步设置 token(写存储 + 更新缓存) */
  setToken(token: string | null): Promise<void> | void
  /** 异步设置 refresh token */
  setRefreshToken(token: string | null): Promise<void> | void
  /** 异步清除所有 token(可选,部分端可能用 clearAuth 等不同命名) */
  clearAll?(): Promise<void> | void
}

/**
 * 含 UserInfo 管理的 Token 存储扩展契约
 *
 * 为 miniapp-taro 这类需要管理 UserInfo 的端提供扩展契约,
 * 通过泛型 TUserInfo 允许各端注入自己的用户信息类型。
 */
export interface TokenStoreWithUserInfo<TUserInfo = unknown> extends TokenStore {
  /** 同步获取用户信息 */
  getUserInfo(): TUserInfo | null
  /** 同步设置用户信息 */
  setUserInfo(info: TUserInfo): void
}

/**
 * createInMemoryTokenStore 工厂配置项
 *
 * - initial:初始缓存值(可选,用于 hydration 场景)
 * - onSetToken/onSetRefreshToken/onClearAll:持久化回调,
 *   各端 adapter 在此调用 chrome.storage / SecureStore / Taro.storage
 */
export interface InMemoryTokenStoreOptions {
  /** 初始缓存值(可选,用于 hydration 场景) */
  initial?: { token?: string | null; refreshToken?: string | null }
  /** 设置 token 后的持久化回调(各端在此写存储) */
  onSetToken?: (token: string | null) => Promise<void> | void
  /** 设置 refresh token 后的持久化回调 */
  onSetRefreshToken?: (token: string | null) => Promise<void> | void
  /** 清除所有 token 后的持久化回调 */
  onClearAll?: () => Promise<void> | void
}

/**
 * 创建内存缓存 TokenStore(各端 adapter 基类)
 *
 * 维护 cachedToken/cachedRefreshToken 内存缓存,通过 options 回调
 * 将持久化逻辑下放到各端 adapter,实现"缓存统一 + 存储差异化"。
 *
 * @example
 * ```ts
 * // extension adapter 示意
 * const store = createInMemoryTokenStore({
 *   onSetToken: (t) => chrome.storage.local.set({ token: t }),
 *   onClearAll: () => chrome.storage.local.remove(['token', 'refreshToken']),
 * })
 * ```
 */
export function createInMemoryTokenStore(
  options?: InMemoryTokenStoreOptions,
): TokenStore {
  let cachedToken = options?.initial?.token ?? null
  let cachedRefreshToken = options?.initial?.refreshToken ?? null
  return {
    getToken: () => cachedToken,
    getRefreshToken: () => cachedRefreshToken,
    setToken: async (token) => {
      cachedToken = token
      await options?.onSetToken?.(token)
    },
    setRefreshToken: async (token) => {
      cachedRefreshToken = token
      await options?.onSetRefreshToken?.(token)
    },
    clearAll: async () => {
      cachedToken = null
      cachedRefreshToken = null
      await options?.onClearAll?.()
    },
  }
}

/**
 * 将 TokenStore 绑定到 @ihui/api-client 的 setTokenProvider
 *
 * 统一适配:extension/mobile-rn 等需要把 token 注入到 api-client 的端,
 * 调用此函数即可,无需各自手写 setTokenProvider({ getToken: ... })。
 *
 * 注意:miniapp-taro 因同步 storage 语义不匹配,通常不走此适配器。
 */
export function bindTokenStoreToApiClient(store: TokenStore): void {
  setTokenProvider({ getToken: () => store.getToken() })
}
