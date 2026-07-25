/**
 * @ihui/miniapp-taro/stores/storage-adapter — Taro.storage 持久化 transport
 *
 * 设计原则(2026-07-25 立):
 * 1. 单一职责:只做"user 持久化 transport",不混入任何 token 相关方法
 *    (token 仍由 utils/auth.ts + Taro.storage 的 TOKEN_STORAGE_KEY /
 *    REFRESH_TOKEN_STORAGE_KEY 两个独立 key 管理,与 user 互不干扰)。
 * 2. 同步语义:Taro.storage 是同步 API(getStorageSync / setStorageSync /
 *    removeStorageSync),与 web 端 localStorage 一致,因此走 createSyncTransport
 *    而不是 createAsyncTransport。直接复用 @ihui/shared/stores 抽象,符合
 *    跨端 PersistTransport 契约。
 * 3. 零新概念:不做 JSON 序列化(Taro.storage 已支持任意 JSON-serializable 值,
 *    且本 transport 契约要求 string|null,与 zustand persist StateStorage 一致);
 *    如需存对象,由调用方自行 JSON.stringify 后传入。
 * 4. 严格只读 Taro.storage,不引入额外副作用,确保与 utils/auth.ts 的存储区域
 *    完全一致(用独立 key 'ihui-auth-user',不与 token / userInfo 冲突)。
 *
 * 使用场景(只用于持久化 user + isAuthenticated,token 一律不落盘):
 * - zustand persist 写入 user 字段:经 createJSONStorage → PersistTransport
 *   → Taro.storage.setStorageSync('ihui-auth-user', json)
 * - hydrate 时:从 Taro.storage.getStorageSync('ihui-auth-user') 读出 JSON 字符串
 *   喂给 zustand persist 的 rehydrate
 *
 * 与 utils/auth.ts 关系:
 * - utils/auth.ts(tokenStore):管 token / refreshToken / UserInfo
 *   (TOKEN_STORAGE_KEY / REFRESH_TOKEN_STORAGE_KEY / 'ihui_user_info' 三个 key)
 * - 本模块:管 user('ihui-auth-user'),与 token 互不干扰
 * - 两者共享 Taro.storage,自然获得 weapp / alipay / h5 / swan / tt 五端统一持久化
 *
 * 接入示例(在 auth-store.ts):
 * ```ts
 * import { createTaroStorageTransport } from './storage-adapter'
 * const userTransport = createTaroStorageTransport()
 * // 注入给 @ihui/shared/stores/createAuthStore
 * ```
 */

import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import { createSyncTransport, type PersistTransport } from '@ihui/shared/stores'

/**
 * 创建 Taro.storage 持久化 transport
 *
 * 同步接口(getItem / setItem / removeItem 同步返回),符合 zustand persist
 * middleware 的 StateStorage 签名。底层包装 @tarojs/taro 的 getStorageSync /
 * setStorageSync / removeStorageSync,跨 weapp / alipay / h5 / swan / tt 五端
 * 一致行为(各端 Taro 插件代理到底层 storage API,语义对齐)。
 *
 * 行为:
 * - Taro.storage 可用 → 包装 getStorageSync / setStorageSync / removeStorageSync
 * - 注意:Taro.storage 的 getStorageSync 在 key 不存在时返回空串 ''(不是 null),
 *   本 transport 内部统一将空串视为 null,保持 PersistTransport 契约一致
 *   (getItem 返回 null 表 key 不存在,避免 zustand persist 解析空串时异常)。
 *
 * @example
 * ```ts
 * const transport = createTaroStorageTransport()
 * transport.setItem('k', 'v')
 * const v = transport.getItem('k') // 'v'
 * transport.removeItem('k')
 * const none = transport.getItem('k') // null
 * ```
 *
 * @returns PersistTransport 实例,供 @ihui/shared/stores/createAuthStore 注入为
 *          userTransport(user 持久化通道;token 一律不落盘,走 tokenStore)
 */
export function createTaroStorageTransport(): PersistTransport {
  return createSyncTransport({
    getItem: (key) => {
      const value = getStorageSync(key)
      // Taro.storage 契约:key 不存在时返回空串 '',统一归一为 null,
      // 保持与 web / extension / mobile-rn 等端 PersistTransport 行为一致
      if (value === '' || value === undefined || value === null) return null
      // 防御:Taro.storage 可能返回非 string 值(理论上不应发生),
      // 非 string 一律视为 null,避免 zustand persist 解析异常
      if (typeof value !== 'string') return null
      return value
    },
    setItem: (key, value) => {
      setStorageSync(key, value)
    },
    removeItem: (key) => {
      removeStorageSync(key)
    },
  })
}
