/**
 * Vue 3.5 类型兼容性定义
 * 解决常见的类型推断问题
 */

import type { WatchStopHandle } from 'vue'

/**
 * 扩展 ComputedRef 类型以支持更灵活的泛型
 */
declare module 'vue' {
  interface ComputedRef<T> {
    // 允许更灵活的类型推断
    readonly value: T
  }
}

/**
 * Watch 函数类型辅助
 */
export type WatchCallback<T> = (newValue: T, oldValue: T) => void

/**
 * 异步组件类型辅助
 */
export type AsyncComponentLoader = () => Promise<{
  default: any
  [key: string]: any
}>

/**
 * 扩展 watch 函数类型以支持更灵活的参数
 */
declare module 'vue' {
  function watch<T>(
    source: () => T,
    callback: (newValue: T, oldValue: T) => void,
    options?: { immediate?: boolean; deep?: boolean }
  ): WatchStopHandle
}
