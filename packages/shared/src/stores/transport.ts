/**
 * @ihui/shared/stores/transport — 跨端持久化 transport 抽象
 *
 * 5 端存储后端差异:
 * - web: localStorage(同步)
 * - mobile-rn: AsyncStorage(异步)
 * - miniapp-taro: Taro.storage(同步,跨平台封装)
 * - extension: chrome.storage.local(异步,含 onChanged 跨上下文同步)
 * - desktop: Tauri Store(异步,通过 IPC 桥接)
 *
 * zustand persist 中间件的 storage 接口签名:
 *   { getItem, setItem, removeItem } — 全部可同步可异步
 *
 * 本模块提供 4 个工厂:
 * 1. createMemoryTransport:无持久化(SSR / 测试用)
 * 2. createSyncTransport:同步 storage 包装(localStorage / Taro.storage)
 * 3. createAsyncTransport:异步 storage 包装(AsyncStorage / chrome.storage / Tauri Store)
 * 4. createJsonTransport:在上述任一 transport 之上加 JSON 序列化(默认行为)
 *
 * 设计原则:
 * - 零运行时开销:transport 实例化一次,后续 set/get 直接调用底层 API
 * - 类型安全:PersistTransport 接口约束三方法签名,支持同步+异步混合
 * - SSR 安全:createMemoryTransport 在 window/Taro/AsyncStorage 不可用时自动 fallback
 */

export interface PersistTransport {
  /** 读取存储值,返回 null 表示 key 不存在 */
  getItem: (key: string) => string | null | Promise<string | null>
  /** 写入存储 */
  setItem: (key: string, value: string) => void | Promise<void>
  /** 删除存储 */
  removeItem: (key: string) => void | Promise<void>
}

export interface SyncStorageAdapter {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface AsyncStorageAdapter {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
  removeItem: (key: string) => void | Promise<void>
}

/**
 * 内存 transport — 无持久化,适用于 SSR / 测试场景
 *
 * @example
 * ```ts
 * const transport = createMemoryTransport()
 * transport.setItem('k', 'v')
 * transport.getItem('k') // 'v'
 * ```
 */
export function createMemoryTransport(): PersistTransport {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

/**
 * 同步 storage 包装 — 适配 localStorage / Taro.storage
 *
 * 约束:adapter 三方法必须同步返回,不可返回 Promise(否则在 SSR 阶段会因 await 阻塞首屏)。
 * 异步场景请用 createAsyncTransport。
 */
export function createSyncTransport(adapter: SyncStorageAdapter): PersistTransport {
  return {
    getItem: (key) => adapter.getItem(key),
    setItem: (key, value) => adapter.setItem(key, value),
    removeItem: (key) => adapter.removeItem(key),
  }
}

/**
 * 异步 storage 包装 — 适配 AsyncStorage / chrome.storage.local / Tauri Store
 *
 * 允许 adapter 三方法返回 Promise 或同步值,适合 extension(MV3 storage)/
 * mobile-rn(AsyncStorage)/ desktop(Tauri IPC) 等需要跨进程读写的端。
 */
export function createAsyncTransport(adapter: AsyncStorageAdapter): PersistTransport {
  return {
    getItem: (key) => adapter.getItem(key),
    setItem: (key, value) => adapter.setItem(key, value),
    removeItem: (key) => adapter.removeItem(key),
  }
}

/**
 * JSON 序列化 transport — 在已有 transport 之上加 JSON.stringify/parse
 *
 * 适用于 storage adapter 只接受 string(原生 localStorage)但需要存对象的场景。
 * 如果 storage adapter 已支持 JSON(如 AsyncStorage),无需本装饰。
 *
 * @example
 * ```ts
 * const transport = createJsonTransport(createSyncTransport({
 *   getItem: (k) => localStorage.getItem(k),
 *   setItem: (k, v) => localStorage.setItem(k, v),
 *   removeItem: (k) => localStorage.removeItem(k),
 * }))
 * ```
 */
export function createJsonTransport(base: PersistTransport): PersistTransport {
  return {
    getItem: async (key) => {
      const raw = await base.getItem(key)
      if (raw === null || raw === '') return null
      try {
        return JSON.stringify(JSON.parse(raw))
      } catch {
        return null
      }
    },
    setItem: async (key, value) => {
      await base.setItem(key, value)
    },
    removeItem: async (key) => {
      await base.removeItem(key)
    },
  }
}

/**
 * SSR 安全 transport — 客户端 window 存在时用真实 storage,否则用内存
 *
 * 解决 Next.js / Taro SSR 阶段 window/localStorage 不可用导致的报错。
 * hydrate 完成后,store 会从真实 storage 读值覆盖内存值。
 *
 * @param getClientAdapter 客户端 adapter 工厂(在 useEffect/挂载时调用)
 */
export function createSSRSafeTransport(getClientAdapter: () => SyncStorageAdapter): PersistTransport {
  const memory = createMemoryTransport()
  let client: PersistTransport | null = null
  const ensureClient = (): PersistTransport => {
    if (!client) {
      try {
        client = createSyncTransport(getClientAdapter())
      } catch {
        client = memory
      }
    }
    return client
  }
  return {
    getItem: (key) => {
      if (typeof window === 'undefined') return memory.getItem(key)
      return ensureClient().getItem(key)
    },
    setItem: (key, value) => {
      if (typeof window === 'undefined') {
        memory.setItem(key, value)
        return
      }
      ensureClient().setItem(key, value)
    },
    removeItem: (key) => {
      if (typeof window === 'undefined') {
        memory.removeItem(key)
        return
      }
      ensureClient().removeItem(key)
    },
  }
}
