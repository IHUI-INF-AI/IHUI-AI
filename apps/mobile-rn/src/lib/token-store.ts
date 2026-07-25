/**
 * mobile-rn TokenStore 适配器(2026-07-25 立)
 *
 * 将现有 lib/token.ts 函数式 API 包装成 TokenStore 接口对象,
 * 供 @ihui/shared/hooks/useAuth hook 消费。
 *
 * 设计原则(非破坏性):
 * - 现有 lib/token.ts 完全不动(4 个消费文件继续用函数式 API)
 * - AuthContext.tsx 完全不动(SSO + 密码登录流程复杂,改造风险大)
 * - 本适配器仅作为基础设施,后续新页面/新功能可直接 useAuth({ store: rnTokenStore })
 *
 * 接入示例:
 * ```ts
 * import { useAuth } from '@ihui/shared/hooks'
 * import { rnTokenStore } from '../lib/token-store'
 *
 * const auth = useAuth({
 *   store: rnTokenStore,
 *   // bindTransport 不传:lib/token.ts initApi 已 setTokenProvider,避免重复绑定
 *   fetchProfile: async () => {
 *     const res = await getProfile()
 *     return { success: res.success, data: res.data }
 *   },
 * })
 * ```
 */
import type { TokenStore } from '@ihui/shared/auth'
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearToken,
} from './token'

/**
 * mobile-rn TokenStore 实例
 *
 * - getToken/getRefreshToken:同步读取内存缓存(由 lib/token.ts 维护)
 * - setToken/setRefreshToken:写内存 + 持久化到 SecureStore(iOS Keychain / Android Keystore)
 * - clearAll:对应 lib/token.ts 的 clearToken,清内存 + 删 SecureStore
 */
export const rnTokenStore: TokenStore = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearToken,
}

// Re-export 给 mobile-rn 端使用(避免各处自行 import @ihui/shared/auth)
export { bindTokenStoreToApiClient } from '@ihui/shared/auth'
export type { TokenStore, TokenStoreWithUserInfo } from '@ihui/shared/auth'
