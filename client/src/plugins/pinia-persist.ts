/**
 * P21: Pinia 状态持久化插件
 *
 * 功能：
 * - 自动持久化指定 store 的状态到 localStorage/sessionStorage
 * - 支持按字段路径选择性持久化
 * - 支持自定义序列化/反序列化
 * - 支持跨标签页同步（storage 事件）
 * - 防抖写入（避免高频更新打满 localStorage）
 *
 * 用法：
 *   // main.ts
 *   import { createPersistedState } from '@/plugins/pinia-persist'
 *   const pinia = createPinia()
 *   pinia.use(createPersistedState())
 *
 *   // store 定义
 *   defineStore('auth', {
 *     state: () => ({ token: '', user: null }),
 *     persist: {
 *       paths: ['token'],          // 只持久化 token
 *       key: 'app-auth',           // 自定义 storage key
 *       storage: sessionStorage,   // 默认 localStorage
 *     }
 *   })
 */

import type { PiniaPluginContext } from 'pinia'

// ============================================================================
// 类型定义
// ============================================================================

interface PersistConfig {
  /** localStorage 存储键名，默认 `pinia-{storeId}` */
  key?: string
  /** 需要持久化的 state 字段路径列表，默认全部 */
  paths?: string[]
  /** 存储引擎，默认 window.localStorage */
  storage?: Storage
  /** 自定义序列化器，默认 JSON.stringify/parse */
  serializer?: {
    serialize: (state: Record<string, unknown>) => string
    deserialize: (str: string) => Record<string, unknown>
  }
  /** 是否启用跨标签页同步，默认 false */
  crossTab?: boolean
  /** 写入防抖延迟（毫秒），默认 300ms */
  debounce?: number
}

type PersistOption = boolean | PersistConfig

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_SERIALIZER = {
  serialize: (state: Record<string, unknown>): string => JSON.stringify(state),
  deserialize: (str: string): Record<string, unknown> => JSON.parse(str),
}

function getDefaultStorage(): Storage | undefined {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // SSR 或隐私模式下 localStorage 不可用
  }
  return undefined
}

// ============================================================================
// 防抖工具
// ============================================================================

function createDebouncedWriter(delay: number): (fn: () => void) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (fn: () => void) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, delay)
  }
}

// ============================================================================
// 核心插件
// ============================================================================

/**
 * 创建 Pinia 持久化插件
 *
 * @param globalOptions 全局默认配置
 * @returns Pinia 插件函数
 */
export function createPersistedState(
  globalOptions: {
    storage?: Storage
    serializer?: PersistConfig['serializer']
    defaultDebounce?: number
  } = {}
) {
  const globalStorage = globalOptions.storage || getDefaultStorage()
  const globalSerializer = globalOptions.serializer || DEFAULT_SERIALIZER
  const globalDebounce = globalOptions.defaultDebounce ?? 300

  // 跨标签页同步的 store 注册表
  const crossTabStores = new Map<string, { config: PersistConfig; storeId: string }>()

  // 监听跨标签页 storage 事件（只注册一次）
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (!event.key) return
      const entry = crossTabStores.get(event.key)
      if (!entry) return

      // 在下一个微任务中恢复状态，避免 Pinia 响应式循环
      queueMicrotask(() => {
        try {
          if (!event.newValue) return
          const parsed = entry.config.serializer?.deserialize(event.newValue) ||
            globalSerializer.deserialize(event.newValue)
          // 通过 key 反查 store 并 patch
          const store = (window as unknown as Record<string, unknown>).__PINIA_STORES__ as
            Record<string, { $patch: (state: Record<string, unknown>) => void }> | undefined
          if (store && store[entry.storeId]) {
            store[entry.storeId].$patch(parsed)
          }
        } catch {
          // 反序列化失败，静默忽略
        }
      })
    })
  }

  return (context: PiniaPluginContext) => {
    const persistOption = (context.options as { persist?: PersistOption }).persist
    if (!persistOption) return

    // 解析配置
    const config: PersistConfig =
      typeof persistOption === 'boolean' ? {} : { ...persistOption }

    const key = config.key || `pinia-${context.store.$id}`
    const paths = config.paths
    const storage = config.storage || globalStorage
    const serializer = config.serializer || globalSerializer
    const debounceMs = config.debounce ?? globalDebounce
    const crossTab = config.crossTab ?? false

    if (!storage) return

    // 注册跨标签页同步
    if (crossTab) {
      crossTabStores.set(key, { config, storeId: context.store.$id })
    }

    // 注册到全局 store 表（供跨标签页恢复使用）
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      if (!w.__PINIA_STORES__) w.__PINIA_STORES__ = {}
      ;(w.__PINIA_STORES__ as Record<string, unknown>)[context.store.$id] = context.store
    }

    // ---- 恢复状态 ----
    try {
      const saved = storage.getItem(key)
      if (saved) {
        const parsed = serializer.deserialize(saved)
        if (paths && paths.length > 0) {
          // 选择性恢复
          const picked: Record<string, unknown> = {}
          for (const path of paths) {
            if (path in parsed) {
              picked[path] = parsed[path]
            }
          }
          context.store.$patch(picked)
        } else {
          context.store.$patch(parsed)
        }
      }
    } catch (e) {
      console.warn(`[Pinia Persist] 恢复 ${context.store.$id} 状态失败:`, e)
    }

    // ---- 持久化状态 ----
    const debouncedWrite = createDebouncedWriter(debounceMs)

    context.store.$subscribe((_mutation: any, state: any) => {
      debouncedWrite(() => {
        try {
          let toSave: Record<string, unknown>
          if (paths && paths.length > 0) {
            toSave = {}
            for (const path of paths) {
              if (path in state) {
                toSave[path] = (state as Record<string, unknown>)[path]
              }
            }
          } else {
            toSave = { ...state }
          }
          storage.setItem(key, serializer.serialize(toSave))
        } catch (e) {
          console.warn(`[Pinia Persist] 保存 ${context.store.$id} 状态失败:`, e)
        }
      })
    })

    // ---- 清理方法 ----
    context.store.$persist = () => {
      try {
        let toSave: Record<string, unknown>
        const state = context.store.$state
        if (paths && paths.length > 0) {
          toSave = {}
          for (const path of paths) {
            if (path in state) {
              toSave[path] = (state as Record<string, unknown>)[path]
            }
          }
        } else {
          toSave = { ...state }
        }
        storage.setItem(key, serializer.serialize(toSave))
      } catch (e) {
        console.warn(`[Pinia Persist] 手动保存 ${context.store.$id} 失败:`, e)
      }
    }

    context.store.$clearPersisted = () => {
      try {
        storage.removeItem(key)
      } catch {
        // 静默处理
      }
    }
  }
}

// ============================================================================
// 类型扩展
// ============================================================================

declare module 'pinia' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface DefineStoreOptionsBase<S, Store> {
    /** 持久化配置 */
    persist?: PersistOption
  }

  export interface PiniaCustomProperties {
    /** 手动触发持久化保存 */
    $persist: () => void
    /** 清除持久化数据 */
    $clearPersisted: () => void
  }
}

export default createPersistedState
