import { describe, it, expect } from 'vitest'
import {
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
} from '../object'

describe('object utils', () => {
  describe('deepClone', () => {
    it('应该深拷贝对象', () => {
      const obj = { a: 1, b: { c: 2 } }
      const cloned = deepClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).not.toBe(obj.b)
    })

    it('应该深拷贝数组', () => {
      const arr = [1, [2, 3], { a: 4 }]
      const cloned = deepClone(arr)
      expect(cloned).toEqual(arr)
      expect(cloned).not.toBe(arr)
      expect(cloned[1]).not.toBe(arr[1])
    })

    it('应该深拷贝Date对象', () => {
      const date = new Date('2024-01-01')
      const cloned = deepClone(date)
      expect(cloned).toEqual(date)
      expect(cloned).not.toBe(date)
    })

    it('应该深拷贝Map', () => {
      const map = new Map([['a', 1], ['b', { c: 2 }]])
      const cloned = deepClone(map)
      expect(cloned).toEqual(map)
      expect(cloned).not.toBe(map)
    })

    it('应该深拷贝Set', () => {
      const set = new Set([1, 2, 3])
      const cloned = deepClone(set)
      expect(cloned).toEqual(set)
      expect(cloned).not.toBe(set)
    })

    it('应该深拷贝RegExp', () => {
      const regex = /test/gi
      const cloned = deepClone(regex)
      expect(cloned.source).toBe(regex.source)
      expect(cloned.flags).toBe(regex.flags)
      expect(cloned).not.toBe(regex)
    })

    it('应该返回原始值', () => {
      expect(deepClone(null)).toBe(null)
      expect(deepClone(undefined)).toBe(undefined)
      expect(deepClone(123)).toBe(123)
      expect(deepClone('string')).toBe('string')
    })
  })

  describe('shallowClone', () => {
    it('应该浅拷贝对象', () => {
      const obj = { a: 1, b: { c: 2 } }
      const cloned = shallowClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).toBe(obj.b)
    })

    it('应该浅拷贝数组', () => {
      const arr = [1, 2, 3]
      const cloned = shallowClone(arr)
      expect(cloned).toEqual(arr)
      expect(cloned).not.toBe(arr)
    })

    it('应该返回原始值', () => {
      expect(shallowClone(null)).toBe(null)
      expect(shallowClone(123)).toBe(123)
    })
  })

  describe('deepEqual', () => {
    it('应该比较原始值', () => {
      expect(deepEqual(1, 1)).toBe(true)
      expect(deepEqual(1, 2)).toBe(false)
      expect(deepEqual('a', 'a')).toBe(true)
      expect(deepEqual(null, null)).toBe(true)
    })

    it('应该比较对象', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true)
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
      expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    })

    it('应该比较嵌套对象', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
    })

    it('应该比较数组', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('应该比较Date', () => {
      const d1 = new Date('2024-01-01')
      const d2 = new Date('2024-01-01')
      const d3 = new Date('2024-01-02')
      expect(deepEqual(d1, d2)).toBe(true)
      expect(deepEqual(d1, d3)).toBe(false)
    })

    it('应该比较RegExp', () => {
      expect(deepEqual(/test/gi, /test/gi)).toBe(true)
      expect(deepEqual(/test/gi, /test/i)).toBe(false)
    })

    it('应该比较Map', () => {
      const m1 = new Map([['a', 1], ['b', 2]])
      const m2 = new Map([['a', 1], ['b', 2]])
      const m3 = new Map([['a', 1]])
      expect(deepEqual(m1, m2)).toBe(true)
      expect(deepEqual(m1, m3)).toBe(false)
    })

    it('应该比较Set', () => {
      const s1 = new Set([1, 2, 3])
      const s2 = new Set([1, 2, 3])
      const s3 = new Set([1, 2])
      expect(deepEqual(s1, s2)).toBe(true)
      expect(deepEqual(s1, s3)).toBe(false)
    })
  })

  describe('shallowEqual', () => {
    it('应该浅比较对象', () => {
      const obj = { a: 1, b: 2 }
      expect(shallowEqual(obj, { a: 1, b: 2 })).toBe(true)
      expect(shallowEqual(obj, { a: 1, b: 3 })).toBe(false)
    })

    it('应该不比较嵌套对象', () => {
      const nested = { a: { b: 1 } }
      expect(shallowEqual(nested, { a: { b: 1 } })).toBe(false)
    })
  })

  describe('deepMerge', () => {
    it('应该合并对象', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3, c: 4 }
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('应该深度合并嵌套对象', () => {
      const target = { a: { b: 1, c: 2 } }
      const source = { a: { c: 3, d: 4 } }
      expect(deepMerge(target, source)).toEqual({ a: { b: 1, c: 3, d: 4 } })
    })

    it('应该合并多个源对象', () => {
      const target = { a: 1 }
      const source1 = { b: 2 }
      const source2 = { c: 3 }
      expect(deepMerge(target, source1, source2)).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('应该返回目标当没有源对象', () => {
      const target = { a: 1 }
      expect(deepMerge(target)).toEqual({ a: 1 })
    })
  })

  describe('isObject', () => {
    it('应该返回true当是对象', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ a: 1 })).toBe(true)
    })

    it('应该返回false当不是对象', () => {
      expect(isObject(null)).toBe(false)
      expect(isObject(undefined)).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject([1, 2, 3])).toBe(false)
    })
  })

  describe('isEmpty', () => {
    it('应该返回true当为空', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
      expect(isEmpty('')).toBe(true)
      expect(isEmpty('  ')).toBe(true)
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)
      expect(isEmpty(new Map())).toBe(true)
      expect(isEmpty(new Set())).toBe(true)
    })

    it('应该返回false当不为空', () => {
      expect(isEmpty('text')).toBe(false)
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ a: 1 })).toBe(false)
      expect(isEmpty(new Map([['a', 1]]))).toBe(false)
      expect(isEmpty(new Set([1]))).toBe(false)
    })
  })

  describe('pick', () => {
    it('应该选取指定属性', () => {
      const obj = { a: 1, b: 2, c: 3 }
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('应该忽略不存在的属性', () => {
      const obj = { a: 1 }
      expect(pick(obj, ['a', 'b'] as ('a' | 'b')[])).toEqual({ a: 1 })
    })
  })

  describe('omit', () => {
    it('应该排除指定属性', () => {
      const obj = { a: 1, b: 2, c: 3 }
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 })
    })
  })

  describe('getNestedValue', () => {
    it('应该获取嵌套值', () => {
      const obj = { a: { b: { c: 1 } } }
      expect(getNestedValue(obj, 'a.b.c')).toBe(1)
    })

    it('应该返回默认值当路径不存在', () => {
      const obj = { a: 1 }
      expect(getNestedValue(obj, 'a.b.c', 'default')).toBe('default')
    })

    it('应该处理null和undefined', () => {
      expect(getNestedValue(null, 'a.b')).toBeUndefined()
      expect(getNestedValue(undefined, 'a.b')).toBeUndefined()
    })
  })

  describe('setNestedValue', () => {
    it('应该设置嵌套值', () => {
      const obj = { a: { b: 1 } }
      const result = setNestedValue(obj, 'a.b', 2)
      expect(result.a.b).toBe(2)
    })

    it('应该创建不存在的路径', () => {
      const obj = { a: 1 }
      const result = setNestedValue(obj, 'b.c', 2)
      expect(result.b.c).toBe(2)
    })

    it('应该不修改原对象', () => {
      const obj = { a: 1 }
      setNestedValue(obj, 'a', 2)
      expect(obj.a).toBe(1)
    })
  })

  describe('flattenObject', () => {
    it('应该扁平化对象', () => {
      const obj = { a: { b: 1, c: 2 }, d: 3 }
      expect(flattenObject(obj)).toEqual({ 'a.b': 1, 'a.c': 2, 'd': 3 })
    })

    it('应该支持前缀', () => {
      const obj = { a: 1 }
      expect(flattenObject(obj, 'prefix')).toEqual({ 'prefix.a': 1 })
    })
  })

  describe('unflattenObject', () => {
    it('应该反扁平化对象', () => {
      const obj = { 'a.b': 1, 'a.c': 2, 'd': 3 }
      expect(unflattenObject(obj)).toEqual({ a: { b: 1, c: 2 }, d: 3 })
    })
  })
})
