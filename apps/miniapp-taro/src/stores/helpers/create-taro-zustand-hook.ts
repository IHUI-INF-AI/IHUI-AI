// 2026-07-28 抽取自 user.ts/vip.ts/invite.ts 三处重复的
// `useSyncExternalStore + Object.assign(useStore, { getState/setState/subscribe })` 模式。
// 背景:Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'` 错误归并为
// `taro.react_production_min.create`(React 上无此函数),导致运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 规避方案:绕开 zustand/react 的 create,直接用 zustand/vanilla 的 createStore
// 创建 store 实例 + React 18 的 useSyncExternalStore 手动实现订阅 hook,
// 保持与原 useXxxStore API 完全兼容(支持 hook 调用 + getState/setState/subscribe)。
// 待 Taro Vite bug 修复后,可回归 @ihui/shared/stores 工厂。
import { useSyncExternalStore, useCallback } from 'react'
import type { StoreApi } from 'zustand/vanilla'

const identity = <T>(x: T): T => x

/**
 * 为 Taro Vite 兼容创建 zustand hook(绕过 useStore 的 batching 问题)
 *
 * 返回的 hook 既能作为函数调用(useStore((s) => s.xxx)),
 * 又能访问 .getState()/.setState()/.subscribe() 方法,
 * 与 zustand `create` 返回的 UseBoundStore 接口一致。
 */
export function createTaroZustandHook<TState>(storeApi: StoreApi<TState>): {
  (): TState
  <U>(selector: (state: TState) => U): U
  getState: () => TState
  setState: StoreApi<TState>['setState']
  subscribe: StoreApi<TState>['subscribe']
} {
  function useStore<U>(selector: (state: TState) => U = identity as (state: TState) => U): U {
    return useSyncExternalStore(
      storeApi.subscribe,
      useCallback(() => selector(storeApi.getState()), [selector]),
      useCallback(() => selector(storeApi.getInitialState()), [selector]),
    )
  }
  return Object.assign(useStore, {
    getState: storeApi.getState,
    setState: storeApi.setState,
    subscribe: storeApi.subscribe,
  })
}
