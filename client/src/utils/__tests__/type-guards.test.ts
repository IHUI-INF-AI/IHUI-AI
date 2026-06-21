import { describe, it, expect } from 'vitest'
import {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isNonNull,
  hasProperty,
  hasStringProperty,
  hasNumberProperty,
  isRecordOfString,
  isRecordOfNumber,
  assertIsString,
  assertIsObject,
  assertIsArray,
  safeCast,
  safeObjectAccess,
  safeStringAccess,
  safeNumberAccess,
} from '../type-guards'

describe('type-guards', () => {
  describe('isString', () => {
    it('应该返回true当值是字符串', () => {
      expect(isString('hello')).toBe(true)
      expect(isString('')).toBe(true)
    })

    it('应该返回false当值不是字符串', () => {
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString(undefined)).toBe(false)
      expect(isString({})).toBe(false)
    })
  })

  describe('isNumber', () => {
    it('应该返回true当值是数字', () => {
      expect(isNumber(123)).toBe(true)
      expect(isNumber(0)).toBe(true)
      expect(isNumber(-1)).toBe(true)
      expect(isNumber(3.14)).toBe(true)
    })

    it('应该返回false当值不是数字', () => {
      expect(isNumber('123')).toBe(false)
      expect(isNumber(NaN)).toBe(false)
      expect(isNumber(null)).toBe(false)
    })
  })

  describe('isBoolean', () => {
    it('应该返回true当值是布尔值', () => {
      expect(isBoolean(true)).toBe(true)
      expect(isBoolean(false)).toBe(true)
    })

    it('应该返回false当值不是布尔值', () => {
      expect(isBoolean(1)).toBe(false)
      expect(isBoolean('true')).toBe(false)
    })
  })

  describe('isObject', () => {
    it('应该返回true当值是对象', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ a: 1 })).toBe(true)
    })

    it('应该返回false当值不是对象', () => {
      expect(isObject(null)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject(123)).toBe(false)
    })
  })

  describe('isArray', () => {
    it('应该返回true当值是数组', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
    })

    it('应该返回false当值不是数组', () => {
      expect(isArray({})).toBe(false)
      expect(isArray('array')).toBe(false)
    })
  })

  describe('isFunction', () => {
    it('应该返回true当值是函数', () => {
      expect(isFunction(() => {})).toBe(true)
      expect(isFunction(function () {})).toBe(true)
    })

    it('应该返回false当值不是函数', () => {
      expect(isFunction({})).toBe(false)
      expect(isFunction('function')).toBe(false)
    })
  })

  describe('isNonNull', () => {
    it('应该返回true当值不是null或undefined', () => {
      expect(isNonNull(0)).toBe(true)
      expect(isNonNull('')).toBe(true)
      expect(isNonNull(false)).toBe(true)
    })

    it('应该返回false当值是null或undefined', () => {
      expect(isNonNull(null)).toBe(false)
      expect(isNonNull(undefined)).toBe(false)
    })
  })

  describe('hasProperty', () => {
    it('应该返回true当对象有指定属性', () => {
      expect(hasProperty({ a: 1 }, 'a')).toBe(true)
    })

    it('应该返回false当对象没有指定属性', () => {
      expect(hasProperty({ a: 1 }, 'b')).toBe(false)
      expect(hasProperty(null, 'a')).toBe(false)
    })
  })

  describe('hasStringProperty', () => {
    it('应该返回true当对象有指定字符串属性', () => {
      expect(hasStringProperty({ a: 'hello' }, 'a')).toBe(true)
    })

    it('应该返回false当属性不是字符串', () => {
      expect(hasStringProperty({ a: 123 }, 'a')).toBe(false)
    })
  })

  describe('hasNumberProperty', () => {
    it('应该返回true当对象有指定数字属性', () => {
      expect(hasNumberProperty({ a: 123 }, 'a')).toBe(true)
    })

    it('应该返回false当属性不是数字', () => {
      expect(hasNumberProperty({ a: '123' }, 'a')).toBe(false)
    })
  })

  describe('isRecordOfString', () => {
    it('应该返回true当对象所有值都是字符串', () => {
      expect(isRecordOfString({ a: '1', b: '2' })).toBe(true)
    })

    it('应该返回false当对象有非字符串值', () => {
      expect(isRecordOfString({ a: '1', b: 2 })).toBe(false)
      expect(isRecordOfString(null)).toBe(false)
    })
  })

  describe('isRecordOfNumber', () => {
    it('应该返回true当对象所有值都是数字', () => {
      expect(isRecordOfNumber({ a: 1, b: 2 })).toBe(true)
    })

    it('应该返回false当对象有非数字值', () => {
      expect(isRecordOfNumber({ a: 1, b: '2' })).toBe(false)
    })
  })

  describe('assertIsString', () => {
    it('应该不抛出错误当值是字符串', () => {
      expect(() => assertIsString('hello')).not.toThrow()
    })

    it('应该抛出错误当值不是字符串', () => {
      expect(() => assertIsString(123)).toThrow(TypeError)
    })

    it('应该使用自定义错误消息', () => {
      expect(() => assertIsString(123, '自定义错误')).toThrow('自定义错误')
    })
  })

  describe('assertIsObject', () => {
    it('应该不抛出错误当值是对象', () => {
      expect(() => assertIsObject({})).not.toThrow()
    })

    it('应该抛出错误当值不是对象', () => {
      expect(() => assertIsObject(null)).toThrow(TypeError)
    })
  })

  describe('assertIsArray', () => {
    it('应该不抛出错误当值是数组', () => {
      expect(() => assertIsArray([])).not.toThrow()
    })

    it('应该抛出错误当值不是数组', () => {
      expect(() => assertIsArray({})).toThrow(TypeError)
    })
  })

  describe('safeCast', () => {
    it('应该安全转换类型', () => {
      const value = 'hello' as unknown
      const result = safeCast<string>(value)
      expect(result).toBe('hello')
    })
  })

  describe('safeObjectAccess', () => {
    it('应该返回对象属性值', () => {
      expect(safeObjectAccess({ a: 1 }, 'a', 0)).toBe(1)
    })

    it('应该返回默认值当属性不存在', () => {
      expect(safeObjectAccess({ a: 1 }, 'b', 0)).toBe(0)
    })

    it('应该返回默认值当不是对象', () => {
      expect(safeObjectAccess(null, 'a', 0)).toBe(0)
    })
  })

  describe('safeStringAccess', () => {
    it('应该返回字符串属性值', () => {
      expect(safeStringAccess({ a: 'hello' }, 'a')).toBe('hello')
    })

    it('应该返回默认值', () => {
      expect(safeStringAccess({ a: 1 }, 'b', 'default')).toBe('default')
    })
  })

  describe('safeNumberAccess', () => {
    it('应该返回数字属性值', () => {
      expect(safeNumberAccess({ a: 123 }, 'a')).toBe(123)
    })

    it('应该返回默认值', () => {
      expect(safeNumberAccess({ a: 'string' }, 'a', 0)).toBe(0)
    })
  })
})
