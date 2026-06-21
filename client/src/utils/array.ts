/**
 * 数组工具函数
 * 提供数组操作、排序、过滤、分组等功能
 */

export type CompareFunction<T> = (a: T, b: T) => number

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>()
  return arr.filter(item => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function groupBy<T, K extends string | number>(arr: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return arr.reduce(
    (groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    },
    {} as Record<K, T[]>
  )
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item)) {
      return acc.concat(item)
    }
    return acc.concat(item)
  }, [])
}

export function flattenDeep<T>(arr: any[]): T[] {
  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item)) {
      return acc.concat(flattenDeep(item))
    }
    return acc.concat(item as T)
  }, [])
}

export function sortBy<T>(arr: T[], keyFn: (item: T) => number | string, order: 'asc' | 'desc' = 'asc'): T[] {
  const sorted = [...arr].sort((a, b) => {
    const aVal = keyFn(a)
    const bVal = keyFn(b)
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
    return 0
  })
  return order === 'desc' ? sorted.reverse() : sorted
}

export function sortByMultiple<T>(arr: T[], keys: Array<{ key: (item: T) => number | string; order?: 'asc' | 'desc' }>): T[] {
  return [...arr].sort((a, b) => {
    for (const { key, order = 'asc' } of keys) {
      const aVal = key(a)
      const bVal = key(b)
      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
    }
    return 0
  })
}

export function difference<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2)
  return arr1.filter(item => !set2.has(item))
}

export function intersection<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2)
  return arr1.filter(item => set2.has(item))
}

export function union<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat())
}

export function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = []
  const fail: T[] = []
  arr.forEach(item => {
    if (predicate(item)) {
      pass.push(item)
    } else {
      fail.push(item)
    }
  })
  return [pass, fail]
}

export function first<T>(arr: T[]): T | undefined {
  return arr[0]
}

export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1]
}

export function nth<T>(arr: T[], n: number): T | undefined {
  if (n < 0) {
    return arr[arr.length + n]
  }
  return arr[n]
}

export function take<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n)
}

export function takeRight<T>(arr: T[], n: number): T[] {
  return arr.slice(-n)
}

export function drop<T>(arr: T[], n: number): T[] {
  return arr.slice(n)
}

export function dropRight<T>(arr: T[], n: number): T[] {
  return arr.slice(0, -n)
}

export function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  const length = Math.min(arr1.length, arr2.length)
  const result: [T, U][] = []
  for (let i = 0; i < length; i++) {
    result.push([arr1[i], arr2[i]])
  }
  return result
}

export function unzip<T, U>(arr: [T, U][]): [T[], U[]] {
  const arr1: T[] = []
  const arr2: U[] = []
  arr.forEach(([a, b]) => {
    arr1.push(a)
    arr2.push(b)
  })
  return [arr1, arr2]
}

export function range(start: number, end?: number, step: number = 1): number[] {
  if (end === undefined) {
    end = start
    start = 0
  }
  const result: number[] = []
  for (let i = start; step > 0 ? i < end : i > end; i += step) {
    result.push(i)
  }
  return result
}

export function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0)
}

export function sumBy<T>(arr: T[], keyFn: (item: T) => number): number {
  return arr.reduce((acc, item) => acc + keyFn(item), 0)
}

export function average(arr: number[]): number {
  if (arr.length === 0) return 0
  return sum(arr) / arr.length
}

export function averageBy<T>(arr: T[], keyFn: (item: T) => number): number {
  if (arr.length === 0) return 0
  return sumBy(arr, keyFn) / arr.length
}

export function min(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined
  return Math.min(...arr)
}

export function max(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined
  return Math.max(...arr)
}

export function minBy<T>(arr: T[], keyFn: (item: T) => number): T | undefined {
  if (arr.length === 0) return undefined
  return arr.reduce((min, item) => (keyFn(item) < keyFn(min) ? item : min))
}

export function maxBy<T>(arr: T[], keyFn: (item: T) => number): T | undefined {
  if (arr.length === 0) return undefined
  return arr.reduce((max, item) => (keyFn(item) > keyFn(max) ? item : max))
}

export function countBy<T, K extends string | number>(arr: T[], keyFn: (item: T) => K): Record<K, number> {
  return arr.reduce(
    (counts, item) => {
      const key = keyFn(item)
      counts[key] = (counts[key] || 0) + 1
      return counts
    },
    {} as Record<K, number>
  )
}

export function keyBy<T, K extends string | number>(arr: T[], keyFn: (item: T) => K): Record<K, T> {
  return arr.reduce(
    (obj, item) => {
      obj[keyFn(item)] = item
      return obj
    },
    {} as Record<K, T>
  )
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function sample<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

export function sampleSize<T>(arr: T[], n: number): T[] {
  const shuffled = shuffle(arr)
  return shuffled.slice(0, Math.min(n, arr.length))
}

export function useArray() {
  return {
    unique,
    uniqueBy,
    groupBy,
    chunk,
    flatten,
    flattenDeep,
    sortBy,
    sortByMultiple,
    difference,
    intersection,
    union,
    partition,
    first,
    last,
    nth,
    take,
    takeRight,
    drop,
    dropRight,
    zip,
    unzip,
    range,
    sum,
    sumBy,
    average,
    averageBy,
    min,
    max,
    minBy,
    maxBy,
    countBy,
    keyBy,
    shuffle,
    sample,
    sampleSize,
  }
}

export default {
  unique,
  uniqueBy,
  groupBy,
  chunk,
  flatten,
  flattenDeep,
  sortBy,
  sortByMultiple,
  difference,
  intersection,
  union,
  partition,
  first,
  last,
  nth,
  take,
  takeRight,
  drop,
  dropRight,
  zip,
  unzip,
  range,
  sum,
  sumBy,
  average,
  averageBy,
  min,
  max,
  minBy,
  maxBy,
  countBy,
  keyBy,
  shuffle,
  sample,
  sampleSize,
}
