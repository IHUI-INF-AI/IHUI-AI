/**
 * 跨端共享 storage 抽象(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/lib/credential-storage.ts 与
 * apps/miniapp-taro/src/lib/credential-storage.ts 中重复的
 * "JSON 读写 + 错误兜底 + history 列表" 模式。
 *
 * 核心思想:基于 @ihui/shared/stores 的 PersistTransport(已支持 5 端),
 *          在此之上提供高阶工厂:
 *   - createJsonStorage:JSON.parse/stringify + null 兜底
 *   - createStorage:按 key 的类型化 get/set/remove(泛型)
 *   - createHistoryStorage:history 列表(去重 + LRU + maxItems)
 *
 * 平台无关:本文件不 import 任何平台 API(RN / Taro / DOM),
 * 依赖项只有 @ihui/shared/stores 的 PersistTransport。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn(AsyncStorage)
 * const transport = createAsyncTransport({
 *   getItem: (k) => AsyncStorage.getItem(k),
 *   setItem: (k, v) => AsyncStorage.setItem(k, v),
 *   removeItem: (k) => AsyncStorage.removeItem(k),
 * })
 * const storage = createStorage<{ account: string; password: string }>({
 *   transport,
 *   key: 'ihui-remember-credentials',
 * })
 *
 * // miniapp-taro(Taro.storage)
 * const transport = createSyncTransport({
 *   getItem: (k) => Taro.getStorageSync(k),
 *   setItem: (k, v) => Taro.setStorageSync(k, v),
 *   removeItem: (k) => Taro.removeStorageSync(k),
 * })
 * ```
 */

import type { PersistTransport } from '../stores/transport'

/**
 * 基础 storage 抽象:JSON 序列化 + null 兜底 + 错误静默
 *
 * 区别于 createJsonTransport(transport.ts):
 * - createJsonTransport 是 transport 装饰器,作用在 transport 之上
 * - createJsonStorage 是独立工厂,内部自带 transport,直接面向业务
 *
 * @example
 * ```ts
 * const storage = createJsonStorage(transport, 'foo')
 * await storage.set({ a: 1 })
 * const v = await storage.get() // { a: 1 } | null
 * await storage.remove()
 * ```
 */
export interface JsonStorage<T> {
  /** 读取并 JSON.parse,失败/不存在返回 null */
  get: () => Promise<T | null>
  /** JSON.stringify 写入,失败静默 */
  set: (value: T) => Promise<void>
  /** 删除 */
  remove: () => Promise<void>
}

/**
 * 创建 JSON 序列化 storage 工厂
 *
 * @param transport 各端注入的 transport(同 zustand persist 契约)
 * @param key storage key
 * @returns get/set/remove 三方法
 */
export function createJsonStorage<T>(transport: PersistTransport, key: string): JsonStorage<T> {
  return {
    async get(): Promise<T | null> {
      try {
        const raw = await transport.getItem(key)
        if (raw === null || raw === '') return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },
    async set(value: T): Promise<void> {
      try {
        await transport.setItem(key, JSON.stringify(value))
      } catch {
        // 静默失败,storage 不可用不阻断业务
      }
    },
    async remove(): Promise<void> {
      try {
        await transport.removeItem(key)
      } catch {
        // 静默失败
      }
    },
  }
}

/**
 * 字符串 storage:不做 JSON 序列化,直接读写字符串
 *
 * 适用于 flag / 计数 / 短文本,避免 JSON.parse 开销。
 */
export interface StringStorage {
  get: () => Promise<string | null>
  set: (value: string) => Promise<void>
  remove: () => Promise<void>
}

export function createStringStorage(transport: PersistTransport, key: string): StringStorage {
  return {
    async get(): Promise<string | null> {
      try {
        const raw = await transport.getItem(key)
        return raw === null || raw === '' ? null : raw
      } catch {
        return null
      }
    },
    async set(value: string): Promise<void> {
      try {
        await transport.setItem(key, value)
      } catch {
        // 静默失败
      }
    },
    async remove(): Promise<void> {
      try {
        await transport.removeItem(key)
      } catch {
        // 静默失败
      }
    },
  }
}

/**
 * History 列表 storage:LRU 去重 + 最大长度
 *
 * 场景:登录账号历史 / 搜索关键词历史 / 浏览记录等。
 * 行为:
 * - 新条目 unshift 到头部
 * - 同值条目先移除再 unshift(去重)
 * - 总长度 > maxItems 时截断尾部
 * - 空数组不持久化(remove 替代)
 */
export interface HistoryStorage<T> {
  /** 读取完整列表(最新在前),失败/不存在返回 [] */
  get: () => Promise<T[]>
  /** 追加条目(去重 + LRU + 截断) */
  push: (item: T) => Promise<T[]>
  /** 删除指定条目(value 与 item 相等的全部删除,需调用方传 equals) */
  remove: (item: T) => Promise<T[]>
  /** 清空 */
  clear: () => Promise<T[]>
}

export interface CreateHistoryStorageOptions<T> {
  transport: PersistTransport
  key: string
  maxItems: number
  /**
   * 序列化比较(默认 Object.is + JSON.stringify 降级),
   * 传 equals 后强制走 equals 路径。
   */
  equals?: (a: T, b: T) => boolean
  /**
   * 元素校验:返回 false 时跳过(防止持久化空串/无效值)。
   * 默认:非空字符串 / 非空对象
   */
  isValid?: (item: T) => boolean
}

function defaultIsValid<T>(item: T): boolean {
  if (item === null || item === undefined) return false
  if (typeof item === 'string') return item.length > 0
  if (Array.isArray(item)) return item.length > 0
  if (typeof item === 'object') return Object.keys(item as object).length > 0
  return true
}

function defaultEquals<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * 创建 history 列表 storage 工厂
 *
 * @example
 * ```ts
 * const loginHistory = createHistoryStorage<string>({
 *   transport,
 *   key: 'ihui-login-history',
 *   maxItems: 5,
 * })
 * await loginHistory.push('alice')
 * const list = await loginHistory.get() // ['alice']
 * ```
 */
export function createHistoryStorage<T>(
  options: CreateHistoryStorageOptions<T>,
): HistoryStorage<T> {
  const { transport, key, maxItems, equals = defaultEquals, isValid = defaultIsValid } = options

  const read = async (): Promise<T[]> => {
    try {
      const raw = await transport.getItem(key)
      if (raw === null || raw === '') return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter((x): x is T => isValid(x))
    } catch {
      return []
    }
  }

  const write = async (list: T[]): Promise<T[]> => {
    if (list.length === 0) {
      try {
        await transport.removeItem(key)
      } catch {
        // 静默
      }
    } else {
      try {
        await transport.setItem(key, JSON.stringify(list))
      } catch {
        // 静默
      }
    }
    return list
  }

  return {
    get: read,
    async push(item: T): Promise<T[]> {
      if (!isValid(item)) return read()
      const list = await read()
      const filtered = list.filter((x) => !equals(x, item))
      filtered.unshift(item)
      return write(filtered.slice(0, maxItems))
    },
    async remove(item: T): Promise<T[]> {
      const list = await read()
      const filtered = list.filter((x) => !equals(x, item))
      return write(filtered)
    },
    clear: () => write([]),
  }
}

/**
 * 通用 key-value storage:把任意类型值与一个 key 绑定,
 * 在 JsonStorage 之上做"标志位/短文本/对象"通用抽象。
 *
 * 适用场景:
 * - 自动登录 flag(布尔,序列化为 '1' / '0')
 * - 单值配置项(主题模式、字号等)
 */
export interface FlagStorage {
  get: () => Promise<boolean>
  set: (enabled: boolean) => Promise<void>
  clear: () => Promise<void>
}

/**
 * 布尔 flag storage:底层用 '1' / '0' 字符串,
 * 默认 false,set(true) 写 '1',clear() 删 key。
 */
export function createFlagStorage(transport: PersistTransport, key: string): FlagStorage {
  return {
    async get(): Promise<boolean> {
      try {
        const raw = await transport.getItem(key)
        return raw === '1'
      } catch {
        return false
      }
    },
    async set(enabled: boolean): Promise<void> {
      try {
        if (enabled) {
          await transport.setItem(key, '1')
        } else {
          await transport.removeItem(key)
        }
      } catch {
        // 静默
      }
    },
    async clear(): Promise<void> {
      try {
        await transport.removeItem(key)
      } catch {
        // 静默
      }
    },
  }
}
