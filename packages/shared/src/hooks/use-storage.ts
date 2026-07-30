/**
 * 跨端共享 useStorage hook(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn 与 apps/miniapp-taro 各页面/组件中
 * "useState + useEffect 同步 storage" 重复模式(典型场景:记住密码/自动登录/历史记录)。
 *
 * 设计模式:与 use-clipboard 共享层模式对齐(工厂函数 + 平台 adapter 注入)。
 * - 调用方传 createJsonStorage/createStringStorage/createFlagStorage/createHistoryStorage 实例
 * - hook 负责 useState + useEffect 同步 + 暴露 set/remove/refresh
 *
 * 平台无关:不依赖 RN/Taro/DOM,只基于 React useState/useEffect + 共享 storage 工具。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn
 * const transport = createAsyncTransport({ getItem: AsyncStorage.getItem, ... })
 * const storage = createJsonStorage<{ account: string; password: string }>(transport, 'ihui-remember-credentials')
 * export const useRememberedCredentials = createUseStorage({ storage })
 *
 * // 组件
 * const { value, set, remove, refresh, ready } = useRememberedCredentials()
 * ```
 */

import * as React from 'react'
import type { JsonStorage, StringStorage, FlagStorage, HistoryStorage } from '../utils/storage'

/** 通用 useStorage 返回值(只读 value + setter + refresh) */
export interface UseStorageReturn<T> {
  /** 当前值(未 hydrate 完成时为 initialValue) */
  value: T
  /** 写入新值(异步) */
  set: (next: T) => Promise<void>
  /** 删除(异步) */
  remove: () => Promise<void>
  /** 手动从底层 storage 重新读取 */
  refresh: () => Promise<void>
  /** hydrate 是否完成(未完成时 value 为 initialValue) */
  ready: boolean
}

/**
 * JsonStorage hook 工厂
 *
 * 初始值(initialValue)用于 hydrate 前的占位,避免首帧渲染时 value 为 null 导致的闪烁。
 */
export interface UseJsonStorageOptions<T> {
  storage: JsonStorage<T>
  /** hydrate 前的占位值(默认 null) */
  initialValue?: T
}

export function createUseJsonStorage<T>(options: UseJsonStorageOptions<T>) {
  const { storage, initialValue = null as T } = options
  return function useStorage(): UseStorageReturn<T> {
    const [value, setValue] = React.useState<T>(initialValue)
    const [ready, setReady] = React.useState(false)

    const refresh = React.useCallback(async (): Promise<void> => {
      const next = await storage.get()
      setValue(next ?? initialValue)
    }, [storage])

    React.useEffect(() => {
      let cancelled = false
      void (async () => {
        const next = await storage.get()
        if (!cancelled) {
          setValue(next ?? initialValue)
          setReady(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [storage])

    const set = React.useCallback(
      async (next: T): Promise<void> => {
        setValue(next)
        await storage.set(next)
      },
      [storage],
    )

    const remove = React.useCallback(async (): Promise<void> => {
      setValue(initialValue)
      await storage.remove()
    }, [storage])

    return { value, set, remove, refresh, ready }
  }
}

/** 字符串 storage hook 工厂 */
export interface UseStringStorageOptions {
  storage: StringStorage
  initialValue?: string
}

export function createUseStringStorage(options: UseStringStorageOptions) {
  const { storage, initialValue = '' } = options
  return function useStringStorage(): UseStorageReturn<string> {
    const [value, setValue] = React.useState<string>(initialValue)
    const [ready, setReady] = React.useState(false)

    const refresh = React.useCallback(async (): Promise<void> => {
      const next = await storage.get()
      setValue(next ?? initialValue)
    }, [storage])

    React.useEffect(() => {
      let cancelled = false
      void (async () => {
        const next = await storage.get()
        if (!cancelled) {
          setValue(next ?? initialValue)
          setReady(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [storage])

    const set = React.useCallback(
      async (next: string): Promise<void> => {
        setValue(next)
        await storage.set(next)
      },
      [storage],
    )

    const remove = React.useCallback(async (): Promise<void> => {
      setValue(initialValue)
      await storage.remove()
    }, [storage])

    return { value, set, remove, refresh, ready }
  }
}

/** 布尔 flag storage hook 工厂(自动登录/首次启动等场景) */
export interface UseFlagStorageOptions {
  storage: FlagStorage
  initialValue?: boolean
}

export function createUseFlagStorage(options: UseFlagStorageOptions) {
  const { storage, initialValue = false } = options
  return function useFlagStorage(): UseStorageReturn<boolean> {
    const [value, setValue] = React.useState<boolean>(initialValue)
    const [ready, setReady] = React.useState(false)

    const refresh = React.useCallback(async (): Promise<void> => {
      const next = await storage.get()
      setValue(next)
    }, [storage])

    React.useEffect(() => {
      let cancelled = false
      void (async () => {
        const next = await storage.get()
        if (!cancelled) {
          setValue(next)
          setReady(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [storage])

    const set = React.useCallback(
      async (next: boolean): Promise<void> => {
        setValue(next)
        await storage.set(next)
      },
      [storage],
    )

    const remove = React.useCallback(async (): Promise<void> => {
      setValue(initialValue)
      await storage.clear()
    }, [storage])

    return { value, set, remove, refresh, ready }
  }
}

/** History 列表 storage hook 工厂(登录历史/搜索历史等) */
export interface UseHistoryStorageReturn<T> {
  /** 当前列表(最新在前) */
  list: T[]
  /** 追加条目(去重 + LRU + 截断 maxItems) */
  push: (item: T) => Promise<void>
  /** 删除指定条目 */
  remove: (item: T) => Promise<void>
  /** 清空 */
  clear: () => Promise<void>
  /** 手动从底层 storage 重新读取 */
  refresh: () => Promise<void>
  /** hydrate 是否完成 */
  ready: boolean
}

export interface UseHistoryStorageOptions<T> {
  storage: HistoryStorage<T>
  initialList?: T[]
}

export function createUseHistoryStorage<T>(options: UseHistoryStorageOptions<T>) {
  const { storage, initialList = [] } = options
  return function useHistoryStorage(): UseHistoryStorageReturn<T> {
    const [list, setList] = React.useState<T[]>(initialList)
    const [ready, setReady] = React.useState(false)

    const refresh = React.useCallback(async (): Promise<void> => {
      const next = await storage.get()
      setList(next)
    }, [storage])

    React.useEffect(() => {
      let cancelled = false
      void (async () => {
        const next = await storage.get()
        if (!cancelled) {
          setList(next)
          setReady(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [storage])

    const push = React.useCallback(
      async (item: T): Promise<void> => {
        const next = await storage.push(item)
        setList(next)
      },
      [storage],
    )

    const remove = React.useCallback(
      async (item: T): Promise<void> => {
        const next = await storage.remove(item)
        setList(next)
      },
      [storage],
    )

    const clear = React.useCallback(async (): Promise<void> => {
      const next = await storage.clear()
      setList(next)
    }, [storage])

    return { list, push, remove, clear, refresh, ready }
  }
}
