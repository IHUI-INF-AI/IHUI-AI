import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { success, error, emptyToUndefined, parseOrThrow } from '../src/utils/response.js'
import { AppError } from '../src/errors/AppError.js'

describe('response — 统一 API 响应辅助函数', () => {
  describe('success', () => {
    it('包装数据为 { code: 0, message: "success", data }', () => {
      expect(success({ id: 1 })).toEqual({ code: 0, message: 'success', data: { id: 1 } })
    })

    it('支持字符串数据', () => {
      expect(success('hello')).toEqual({ code: 0, message: 'success', data: 'hello' })
    })

    it('支持数组数据', () => {
      expect(success([1, 2, 3])).toEqual({ code: 0, message: 'success', data: [1, 2, 3] })
    })

    it('支持 null 数据', () => {
      expect(success(null)).toEqual({ code: 0, message: 'success', data: null })
    })

    it('支持 undefined 数据', () => {
      const res = success(undefined)
      expect(res.code).toBe(0)
      expect(res.message).toBe('success')
      expect(res.data).toBeUndefined()
    })
  })

  describe('error', () => {
    it('构造 { code, message } 错误响应', () => {
      expect(error(400, '参数错误')).toEqual({ code: 400, message: '参数错误' })
    })

    it('404 错误', () => {
      expect(error(404, '未找到')).toEqual({ code: 404, message: '未找到' })
    })

    it('500 错误', () => {
      expect(error(500, '服务器内部错误')).toEqual({ code: 500, message: '服务器内部错误' })
    })
  })

  describe('emptyToUndefined', () => {
    it('空字符串转 undefined', () => {
      expect(emptyToUndefined('')).toBeUndefined()
    })

    it('null 转 undefined', () => {
      expect(emptyToUndefined(null)).toBeUndefined()
    })

    it('undefined 转 undefined', () => {
      expect(emptyToUndefined(undefined)).toBeUndefined()
    })

    it('非空字符串原样返回', () => {
      expect(emptyToUndefined('hello')).toBe('hello')
    })

    it('数字原样返回', () => {
      expect(emptyToUndefined(0)).toBe(0)
      expect(emptyToUndefined(42)).toBe(42)
    })

    it('对象原样返回', () => {
      const obj = { a: 1 }
      expect(emptyToUndefined(obj)).toBe(obj)
    })

    it('false 原样返回（非空值）', () => {
      expect(emptyToUndefined(false)).toBe(false)
    })
  })

  describe('parseOrThrow', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    })

    it('合法输入返回解析后的数据', () => {
      const result = parseOrThrow(schema, { name: 'Alice', age: 30 })
      expect(result).toEqual({ name: 'Alice', age: 30 })
    })

    it('缺少必填字段抛 AppError', () => {
      expect(() => parseOrThrow(schema, { age: 30 })).toThrow(AppError)
    })

    it('类型错误抛 AppError', () => {
      expect(() => parseOrThrow(schema, { name: 'Alice', age: -1 })).toThrow(AppError)
    })

    it('AppError 携带 400 statusCode', () => {
      try {
        parseOrThrow(schema, { name: '', age: 0 })
      } catch (e) {
        const err = e as AppError
        expect(err.statusCode).toBe(400)
        expect(err.errorCode).toBe('VALIDATION_FAILED')
      }
    })

    it('AppError message 包含校验错误信息', () => {
      try {
        parseOrThrow(schema, { name: 123, age: 'abc' })
      } catch (e) {
        const err = e as AppError
        expect(err.message).toBeTruthy()
      }
    })

    it('空对象抛 AppError', () => {
      expect(() => parseOrThrow(schema, {})).toThrow(AppError)
    })

    it('null 抛 AppError', () => {
      expect(() => parseOrThrow(schema, null)).toThrow(AppError)
    })
  })
})
