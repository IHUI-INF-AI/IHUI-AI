/**
 * 对象工具函数
 * 提供深拷贝、对象比较、合并等功能
 */

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T
  }

  if (obj instanceof Map) {
    const clonedMap = new Map()
    obj.forEach((value, key) => {
      clonedMap.set(deepClone(key), deepClone(value))
    })
    return clonedMap as T
  }

  if (obj instanceof Set) {
    const clonedSet = new Set()
    obj.forEach(value => {
      clonedSet.add(deepClone(value))
    })
    return clonedSet as T
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T
  }

  if (typeof obj === 'object') {
    const cloned = {} as T
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }

  return obj
}

export function shallowClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return [...obj] as T
  }

  return { ...obj }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false
    }
    return true
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false
    for (const value of a) {
      if (!b.has(value)) return false
    }
    return true
  }

  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key])
}

export function deepMerge<T extends object>(target: T, ...sources: DeepPartial<T>[]): T {
  if (!sources.length) return target

  const source = sources.shift()

  if (source === undefined) return target

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = (target as Record<string, unknown>)[key]

      if (isObject(sourceValue) && isObject(targetValue)) {
        (target as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as DeepPartial<object>
        )
      } else {
        (target as Record<string, unknown>)[key] = sourceValue
      }
    }
  }

  return deepMerge(target, ...sources)
}

export function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item)
}

export function isEmpty(obj: unknown): boolean {
  if (obj === null || obj === undefined) return true

  if (typeof obj === 'string') return obj.trim().length === 0
  if (Array.isArray(obj)) return obj.length === 0
  if (obj instanceof Map || obj instanceof Set) return obj.size === 0
  if (typeof obj === 'object') return Object.keys(obj as object).length === 0

  return false
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key]
    }
  })
  return result
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj }
  keys.forEach(key => {
    delete result[key]
  })
  return result
}

export function getNestedValue<T>(obj: unknown, path: string, defaultValue?: T): T | undefined {
  if (!obj || typeof path !== 'string') return defaultValue

  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return defaultValue
    }
  }

  return current as T
}

export function setNestedValue<T>(obj: T, path: string, value: unknown): T {
  if (!obj || typeof path !== 'string') return obj

  const keys = path.split('.')
  const result = deepClone(obj)
  let current: Record<string, unknown> = result as Record<string, unknown>

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
  return result
}

export function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key
      const value = obj[key]

      if (isObject(value)) {
        Object.assign(result, flattenObject(value, newKey))
      } else {
        result[newKey] = value
      }
    }
  }

  return result
}

export function unflattenObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const keys = key.split('.')
      let current: Record<string, unknown> = result

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        if (!(k in current)) {
          current[k] = {}
        }
        current = current[k] as Record<string, unknown>
      }

      current[keys[keys.length - 1]] = obj[key]
    }
  }

  return result
}

export function useObject() {
  return {
    deepClone,
    shallowClone,
    deepEqual,
    shallowEqual,
    deepMerge,
    isObject,
    isEmpty,
    pick,
    omit,
    getNestedValue,
    setNestedValue,
    flattenObject,
    unflattenObject,
  }
}

export default {
  deepClone,
  shallowClone,
  deepEqual,
  shallowEqual,
  deepMerge,
  isObject,
  isEmpty,
  pick,
  omit,
  getNestedValue,
  setNestedValue,
  flattenObject,
  unflattenObject,
}
