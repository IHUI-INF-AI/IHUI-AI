import type { Component } from 'vue'
import type { markRaw } from 'vue'

/**
 * IconComponent 类型别名
 *
 * 项目中所有 icon 字段应使用此类型，约束开发者使用 markRaw 包装的组件
 * 避免 Vue 响应式系统对组件对象进行代理，消除控制台警告
 *
 * @example
 * interface MenuItem {
 *   icon: IconComponent  // 类型层面约束使用 markRaw
 *   label: string
 * }
 *
 * import { House } from '@element-plus/icons-vue'
 * const item: MenuItem = { icon: markRaw(House), label: '首页' }
 */
export type IconComponent = ReturnType<typeof markRaw<Component>>

export type AnyObject = Record<string, unknown>
export type AnyArray = unknown[]
export type AnyFunction = (...args: any[]) => unknown
export type AnyAsyncFunction = (...args: any[]) => Promise<unknown>

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Maybe<T> = T | null | undefined

export type NonNullable<T> = T extends null | undefined ? never : T

export type KeysOf<T> = keyof T
export type ValuesOf<T> = T[keyof T]

export type EntriesOf<T> = [keyof T, T[keyof T]][]

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

export type OmitByValue<T, ValueType> = {
  [Key in keyof T as T[Key] extends ValueType ? never : Key]: T[Key]
}

export type PickByValue<T, ValueType> = {
  [Key in keyof T as T[Key] extends ValueType ? Key : never]: T[Key]
}

export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, unknown> extends Pick<T, K> ? never : K
}[keyof T]

export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, unknown> extends Pick<T, K> ? K : never
}[keyof T]

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message?: string
  timestamp?: number
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface BaseEntity {
  id: string
  createdAt?: string | number
  updatedAt?: string | number
}

export interface UserBase extends BaseEntity {
  uuid: string
  name?: string
  email?: string
  phone?: string
  avatar?: string
  status?: 'active' | 'inactive' | 'banned'
  roles?: string[]
  permissions?: string[]
}

export interface FileUploadResult {
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
}

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface AppError {
  code: string
  message: string
  details?: any
  stack?: string
  timestamp: number
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data }
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error }
}

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

export type EventCallback<T = unknown> = (data: T) => void

export interface EventEmitter<T extends Record<string, unknown>> {
  on<K extends keyof T>(event: K, callback: EventCallback<T[K]>): () => void
  emit<K extends keyof T>(event: K, data: T[K]): void
  off<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void
}
