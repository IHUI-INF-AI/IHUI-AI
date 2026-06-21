import { describe, it, expect, vi } from 'vitest'
import {
  safeSplit,
  safeGetProperty,
  safeGetStringProperty,
  replaceAtSymbol,
} from '../stringUtils'

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('stringUtils', () => {
  describe('safeSplit', () => {
    it('应该正确分割字符串', () => {
      expect(safeSplit('a,b,c', ',')).toEqual(['a', 'b', 'c'])
    })

    it('应该支持正则表达式分隔符', () => {
      expect(safeSplit('a1b2c3', /\d/)).toEqual(['a', 'b', 'c', ''])
    })

    it('应该支持limit参数', () => {
      expect(safeSplit('a,b,c,d', ',', 2)).toEqual(['a', 'b'])
    })

    it('应该返回空数组当输入不是字符串', () => {
      expect(safeSplit(null, ',')).toEqual([])
      expect(safeSplit(undefined, ',')).toEqual([])
      expect(safeSplit(123, ',')).toEqual([])
      expect(safeSplit({}, ',')).toEqual([])
    })

    it('应该返回空数组当发生错误', () => {
      expect(safeSplit('test', {} as RegExp)).toEqual([])
    })
  })

  describe('safeGetProperty', () => {
    it('应该获取嵌套属性', () => {
      const obj = { a: { b: { c: 'value' } } }
      expect(safeGetProperty(obj, 'a.b.c')).toBe('value')
    })

    it('应该支持数组路径', () => {
      const obj = { a: { b: { c: 'value' } } }
      expect(safeGetProperty(obj, ['a', 'b', 'c'])).toBe('value')
    })

    it('应该返回null当路径不存在', () => {
      const obj = { a: 1 }
      expect(safeGetProperty(obj, 'b.c')).toBeNull()
    })

    it('应该返回null当obj不是对象', () => {
      expect(safeGetProperty(null, 'a.b')).toBeNull()
      expect(safeGetProperty(undefined, 'a.b')).toBeNull()
      expect(safeGetProperty('string', 'a.b')).toBeNull()
    })

    it('应该返回中间对象', () => {
      const obj = { a: { b: { c: 1 } } }
      expect(safeGetProperty(obj, 'a.b')).toEqual({ c: 1 })
    })

    it('应该返回null当中间值不是对象', () => {
      const obj = { a: 1 }
      expect(safeGetProperty(obj, 'a.b')).toBeNull()
    })
  })

  describe('safeGetStringProperty', () => {
    it('应该返回字符串值', () => {
      const obj = { a: { b: 'value' } }
      expect(safeGetStringProperty(obj, 'a.b')).toBe('value')
    })

    it('应该将非字符串值转换为字符串', () => {
      const obj = { a: { b: 123 } }
      expect(safeGetStringProperty(obj, 'a.b')).toBe('123')
    })

    it('应该返回空字符串当值为null', () => {
      const obj = { a: 1 }
      expect(safeGetStringProperty(obj, 'a.b')).toBe('')
    })
  })

  describe('replaceAtSymbol', () => {
    it('应该替换转义的@符号', () => {
      expect(replaceAtSymbol("test{'@'}example")).toBe('test@example')
    })

    it('应该替换多个转义的@符号', () => {
      expect(replaceAtSymbol("{'@'}test{'@'}")).toBe('@test@')
    })

    it('应该返回空字符串当值为null或undefined', () => {
      expect(replaceAtSymbol(null)).toBe('')
      expect(replaceAtSymbol(undefined)).toBe('')
    })

    it('应该将非字符串值转换为字符串', () => {
      expect(replaceAtSymbol(123)).toBe('123')
    })

    it('应该保持普通字符串不变', () => {
      expect(replaceAtSymbol('test string')).toBe('test string')
    })
  })
})
