/**
 * @ihui/extension/stores/storage-adapter — chrome.storage.local 持久化 transport
 *
 * 设计原则(2026-07-25 立):
 * 1. 单一职责:只做"user 持久化 transport",不混入任何 token 相关方法
 *    (token 仍由 lib/token.ts + chrome.storage.local 的 TOKEN_STORAGE_KEY
 *    三个独立 key 管理;chrome.storage.onChanged 已在 token.ts 内监听)。
 * 2. SSR / 测试安全:chrome.storage 不可用(测试环境)时,自动 fallback 到
 *    内存 transport,避免 vitest node 环境因 chrome 全局缺失而崩溃。
 * 3. 零新概念:内部直接包装 createAsyncTransport,跟 web 端 createSyncTransport
 *    + localStorage 的模式一一对应,只是底层换成 chrome.storage.local。
 * 4. 严格只读 chrome.storage.local,不使用 session / sync / managed,确保
 *    与 lib/token.ts 的存储区域完全一致(跨 background/popup/sidepanel 共享)。
 *
 * 使用场景(只用于持久化 user + isAuthenticated,token 一律不落盘):
 * - zustand persist 写入 user 字段:经 createJSONStorage → PersistTransport
 *   → chrome.storage.local.set({ 'ihui-auth-user': json })
 * - hydrate 时:从 chrome.storage.local.get('ihui-auth-user') 读出 JSON 字符串
 *   喂给 zustand persist 的 rehydrate
 *
 * 与 lib/token.ts 关系:
 * - lib/token.ts:管 token(TOKEN_STORAGE_KEY/REFRESH_TOKEN_STORAGE_KEY/EXPIRES_IN_STORAGE_KEY)
 *   + 监听 chrome.storage.onChanged 更新 cachedToken
 * - 本模块:管 user('ihui-auth-user'),与 token 互不干扰
 * - 两者共享 chrome.storage.local,自然获得 background/popup/sidepanel 跨上下文同步
 *
 * 接入示例(在 auth-store.ts):
 * ```ts
 * import { createChromeStorageTransport } from './storage-adapter'
 * const userTransport = createChromeStorageTransport()
 * // 注入给 @ihui/shared/stores/createAuthStore
 * ```
 */

import {
  createAsyncTransport,
  createMemoryTransport,
  type PersistTransport,
} from '@ihui/shared/stores'

/**
 * 检测 chrome.storage.local 是否可用
 *
 * 返回 false 的场景:
 * - 单元测试(vitest node 环境,未 mock chrome 全局)
 * - Service Worker 启动早期的瞬时窗口(chrome.runtime 尚未就绪)
 * - 某些 web_accessible_resources 上下文(无 chrome 全局)
 */
function hasChromeStorage(): boolean {
  try {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.storage !== 'undefined' &&
      typeof chrome.storage.local !== 'undefined' &&
      typeof chrome.storage.local.get === 'function' &&
      typeof chrome.storage.local.set === 'function' &&
      typeof chrome.storage.local.remove === 'function'
    )
  } catch {
    return false
  }
}

/**
 * 创建 chrome.storage.local 持久化 transport
 *
 * 异步接口(getItem / setItem / removeItem 均返回 Promise),
 * 符合 zustand persist middleware 的 StateStorage 签名。
 *
 * 行为:
 * - chrome.storage.local 可用 → 包 chrome.storage.local
 * - chrome.storage.local 不可用 → fallback 到内存 transport
 *   (数据不持久化,但行为一致,适合 vitest / 早期 SW 启动场景)
 *
 * @example
 * ```ts
 * const transport = createChromeStorageTransport()
 * await transport.setItem('k', 'v')
 * const v = await transport.getItem('k') // 'v'
 * await transport.removeItem('k')
 * ```
 */
export function createChromeStorageTransport(): PersistTransport {
  if (!hasChromeStorage()) {
    // 测试 / SSR 阶段:无 chrome 全局,fallback 到内存 transport
    // 内存数据在进程重启后会丢失,仅作为接口占位
    return createMemoryTransport()
  }

  return createAsyncTransport({
    getItem: async (key) => {
      const result = await chrome.storage.local.get(key)
      const value = result?.[key]
      // chrome.storage 接受任意 JSON-serializable 值,但本 transport 契约是 string|null
      // 非 string 值(数字/布尔/对象)统一转为 null,避免 zustand persist 解析异常
      if (value === undefined || value === null) return null
      if (typeof value === 'string') return value
      return null
    },
    setItem: async (key, value) => {
      await chrome.storage.local.set({ [key]: value })
    },
    removeItem: async (key) => {
      await chrome.storage.local.remove(key)
    },
  })
}
