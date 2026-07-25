/**
 * storage-adapter — web 端 localStorage 持久化 transport(2026-07-25 立)
 *
 * 用途:
 * - 包装 `window.localStorage` 为 `@ihui/shared/stores` 定义的 `PersistTransport`
 * - 供 `createAuthStore` / `createUserStore` 等 zustand persist 工厂使用
 * - **不**包含任何 token 相关方法(只做 user / isAuthenticated / theme 等非敏感状态持久化)
 *   遵循 web 端 2026-07-21 安全审计结论:token 一律走 cookie,localStorage 不可存
 *
 * 与共享层 transport 的差异:
 * - `@ihui/shared/stores/transport.ts` 的 `createSyncTransport` 接受通用 SyncStorageAdapter
 *   工厂,本文件针对 web 端 `window.localStorage` 提供两个开箱即用工厂
 * - 包含 SSR 安全 fallback(避免 Next.js 服务端渲染阶段访问 `window` 报错)
 *
 * 使用示例:
 * ```ts
 * // 客户端直接用(假设 window 存在,如 useEffect 内部)
 * const transport = createLocalStorageTransport()
 * transport.setItem('k', 'v')
 *
 * // SSR 安全版(顶层模块作用域安全,服务端返回 noop 内存 transport)
 * const ssrTransport = createSSRSafeWebTransport()
 * ```
 */

import {
  createSSRSafeTransport,
  createSyncTransport,
  type PersistTransport,
} from '@ihui/shared/stores'

/**
 * 直接包装 `window.localStorage` 为 `PersistTransport`
 *
 * 约束:
 * - 必须在客户端调用(useEffect / 事件回调 / 挂载后)
 * - 不做 SSR 防御,如需 SSR 兼容请用 `createSSRSafeWebTransport`
 * - 底层走 `createSyncTransport`,三方法同步返回,无 Promise
 *
 * @returns 包装 `window.localStorage` 的 `PersistTransport` 实例
 */
export function createLocalStorageTransport(): PersistTransport {
  return createSyncTransport({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  })
}

/**
 * SSR 安全的 web localStorage transport
 *
 * 行为:
 * - 服务端(`typeof window === 'undefined'`)返回内存 transport(无持久化效果)
 * - 客户端懒加载真实 localStorage adapter(首次访问时构造)
 * - 加载 localStorage 失败(隐私模式 / 配额超限)自动 fallback 到内存
 *
 * 适用场景:
 * - zustand persist 的 storage 配置(模块顶层初始化时调用安全)
 * - 任何需要跨 SSR/CSR 同一份 transport 引用,且对持久化不强制要求的场景
 *
 * @returns 智能选择 localStorage / 内存的 `PersistTransport` 实例
 */
export function createSSRSafeWebTransport(): PersistTransport {
  return createSSRSafeTransport(() => ({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }))
}
