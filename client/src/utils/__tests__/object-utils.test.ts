import { describe, it, expect } from 'vitest'
import { deepClone, deepEqual } from '../object-utils'

describe('object-utils', () => {
  describe('deepClone', () => {
    it('应该克隆普通对象', () => {
      const obj = { a: 1, b: 'test', c: true }
      const cloned = deepClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
    })

    it('应该深度克隆嵌套对象', () => {
      const obj = { a: { b: { c: 1 } } }
      const cloned = deepClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned.a).not.toBe(obj.a)
      expect(cloned.a.b).not.toBe(obj.a.b)
    })

    it('应该克隆数组', () => {
      const arr = [1, 2, { a: 3 }]
      const cloned = deepClone(arr)
      expect(cloned).toEqual(arr)
      expect(cloned).not.toBe(arr)
      expect(cloned[2]).not.toBe(arr[2])
    })

    it('应该克隆Date对象', () => {
      const date = new Date('2024-01-01')
      const cloned = deepClone(date)
      expect(cloned.getTime()).toBe(date.getTime())
      expect(cloned).not.toBe(date)
    })

    it('应该处理null', () => {
      expect(deepClone(null)).toBeNull()
    })

    it('应该处理原始类型', () => {
      expect(deepClone(1)).toBe(1)
      expect(deepClone('test')).toBe('test')
      expect(deepClone(true)).toBe(true)
      expect(deepClone(undefined)).toBeUndefined()
    })
  })

  describe('deepEqual', () => {
    it('应该比较相等的对象', () => {
      const obj1 = { a: 1, b: 'test' }
      const obj2 = { a: 1, b: 'test' }
      expect(deepEqual(obj1, obj2)).toBe(true)
    })

    it('应该比较不等的对象', () => {
      const obj1 = { a: 1 }
      const obj2 = { a: 2 }
      expect(deepEqual(obj1, obj2)).toBe(false)
    })

    it('应该深度比较嵌套对象', () => {
      const obj1 = { a: { b: { c: 1 } } }
      const obj2 = { a: { b: { c: 1 } } }
      expect(deepEqual(obj1, obj2)).toBe(true)
    })

    it('应该比较数组', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('应该比较Date对象', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-01')
      const date3 = new Date('2024-01-02')
      expect(deepEqual(date1, date2)).toBe(true)
      expect(deepEqual(date1, date3)).toBe(false)
    })

    it('应该处理null', () => {
      expect(deepEqual(null, null)).toBe(true)
      expect(deepEqual(null, {})).toBe(false)
      expect(deepEqual({}, null)).toBe(false)
    })

    it('应该处理原始类型', () => {
      expect(deepEqual(1, 1)).toBe(true)
      expect(deepEqual(1, 2)).toBe(false)
      expect(deepEqual('test', 'test')).toBe(true)
      expect(deepEqual(true, true)).toBe(true)
    })

    it('应该处理相同引用', () => {
      const obj = { a: 1 }
      expect(deepEqual(obj, obj)).toBe(true)
    })

    it('应该比较不同键数量的对象', () => {
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })
  })
})
