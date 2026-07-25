/**
 * mobile-rn AsyncStorage PersistTransport 适配器
 *
 * 用途:把 @react-native-async-storage/async-storage 包装为
 *       @ihui/shared/stores 定义的 PersistTransport 接口,
 *       供 createAuthStore 的 userTransport 参数使用。
 *
 * 设计要点:
 * - **不存 token**:token/refreshToken/expiresIn 仍由本端 tokenStore(SecureStore 优先,
 *   AsyncStorage fallback)管理,这里只负责 user + isAuthenticated 的非敏感持久化。
 *   遵循 web 端 2026-07-21 安全审计结论,token 一律不落 AsyncStorage。
 * - **零运行时开销**:createAsyncStorageTransport() 调用一次,
 *   后续 set/get 直接 await AsyncStorage,无中间序列化层。
 *   user 序列化由 zustand persist 中间件的 createJSONStorage 负责。
 * - **测试友好**:vitest/jsdom 环境可能没有原生 AsyncStorage,
 *   调用方需自行 mock `@react-native-async-storage/async-storage`。
 *   本文件不主动探测环境(避免动态 import 噪音),保持同步导出语义。
 *
 * 与 createAsyncTransport(shared/stores/transport)的关系:
 * - 本工厂 = createAsyncTransport(AsyncStorageAdapter) 的便捷封装,
 *   把 AsyncStorage 静态绑定为 adapter,各端使用更简洁。
 *
 * 接入示例(见 auth-store.ts 顶部):
 * ```ts
 * import { createAuthStore } from '@ihui/shared/stores'
 * import { createAsyncStorageTransport } from './storage-adapter'
 * import { tokenStore } from '../lib/token'
 *
 * const rnAuthStore = createAuthStore({
 *   tokenStore,
 *   userTransport: createAsyncStorageTransport(),
 * })
 * ```
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PersistTransport } from '@ihui/shared/stores'

/**
 * 创建 AsyncStorage 持久化 transport
 *
 * @returns 符合 PersistTransport 契约的 transport 实例(异步 get/set/remove)
 *
 * @example
 * ```ts
 * const transport = createAsyncStorageTransport()
 * await transport.setItem('foo', 'bar')
 * const value = await transport.getItem('foo') // 'bar'
 * await transport.removeItem('foo')
 * ```
 */
export function createAsyncStorageTransport(): PersistTransport {
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  }
}
