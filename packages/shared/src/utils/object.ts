/** 深拷贝:优先使用原生 structuredClone,降级到手动递归 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (typeof structuredClone === 'function') return structuredClone(obj)
  const clone = (Array.isArray(obj) ? [] : {}) as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      ;(clone as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key])
    }
  }
  return clone
}

/** 判空:null/undefined/空字符串/空数组/空对象 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true
  return false
}
