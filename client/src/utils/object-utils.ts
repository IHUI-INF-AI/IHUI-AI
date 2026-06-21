/**
 * 对象处理工具
 * 统一项目中的对象操作函数
 */

/**
 * 深拷贝对象
 * 支持 Date、Array 和普通对象
 * @param obj 要拷贝的对象
 * @returns 深拷贝后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
  return obj
}

/**
 * 深度比较两个对象是否相等
 * 使用深度比较而非 JSON.stringify，更准确且性能更好
 * @param obj1 第一个对象
 * @param obj2 第二个对象
 * @returns 是否相等
 */
export function deepEqual<T>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true
  if (obj1 === null || obj2 === null) return false
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime()
  }
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false
    }
    return true
  }
  const keys1 = Object.keys(obj1 as Record<string, unknown>)
  const keys2 = Object.keys(obj2 as Record<string, unknown>)
  if (keys1.length !== keys2.length) return false
  for (const key of keys1) {
    if (!keys2.includes(key)) return false
    if (!deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) {
      return false
    }
  }
  return true
}
