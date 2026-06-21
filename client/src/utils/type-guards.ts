// 类型守卫工具 - 接收 any 判断具体类型, 是 type-guard 函数的标准模式
// 函数参数声明为 any 才有意义 (断言 value is X 需要 unknown 输入)
/* eslint-disable @typescript-eslint/no-explicit-any */
export function isString(value: any): value is string {
  return typeof value === 'string'
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

export function isObject(value: any): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isArray<T = unknown>(value: any): value is T[] {
  return Array.isArray(value)
}

export function isFunction(value: any): value is (...args: any[]) => unknown {
  return typeof value === 'function'
}

export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function hasProperty<K extends string>(obj: any, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj
}

export function hasStringProperty<K extends string>(obj: any, key: K): obj is Record<K, string> {
  return hasProperty(obj, key) && typeof obj[key] === 'string'
}

export function hasNumberProperty<K extends string>(obj: any, key: K): obj is Record<K, number> {
  return hasProperty(obj, key) && typeof obj[key] === 'number'
}

export function isRecordOfString(value: any): value is Record<string, string> {
  if (!isObject(value)) return false
  return Object.values(value).every(v => typeof v === 'string')
}

export function isRecordOfNumber(value: any): value is Record<string, number> {
  if (!isObject(value)) return false
  return Object.values(value).every(v => typeof v === 'number')
}

export function assertIsString(value: any, message?: string): asserts value is string {
  if (!isString(value)) {
    throw new TypeError(message ?? `Expected string, got ${typeof value}`)
  }
}

export function assertIsObject(value: any, message?: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(message ?? `Expected object, got ${typeof value}`)
  }
}

export function assertIsArray(value: any, message?: string): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new TypeError(message ?? `Expected array, got ${typeof value}`)
  }
}

export type SafeRecord<T = unknown> = Record<string, T>

export function safeCast<T>(value: any): T {
  return value as T
}

export function safeObjectAccess<T>(obj: any, key: string, defaultValue: T): T {
  if (isObject(obj) && key in obj) {
    return obj[key] as T
  }
  return defaultValue
}

export function safeStringAccess(obj: any, key: string, defaultValue = ''): string {
  return safeObjectAccess(obj, key, defaultValue)
}

export function safeNumberAccess(obj: any, key: string, defaultValue = 0): number {
  const value = safeObjectAccess(obj, key, defaultValue)
  return isNumber(value) ? value : defaultValue
}
