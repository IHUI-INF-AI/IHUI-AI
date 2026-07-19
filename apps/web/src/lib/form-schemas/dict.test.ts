import { describe, expect, it } from 'vitest'
import {
  dictTypeSchema,
  dictItemSchema,
  EMPTY_DICT_TYPE_FORM,
  EMPTY_DICT_ITEM_FORM,
  type DictTypeFormValues,
  type DictItemFormValues,
} from './dict'

describe('dictTypeSchema', () => {
  it('合法值通过校验', () => {
    const r = dictTypeSchema.safeParse({ name: '订单状态', code: 'order_status', description: 'desc' })
    expect(r.success).toBe(true)
  })

  it('空 name 触发 required', () => {
    const r = dictTypeSchema.safeParse({ name: '', code: 'ok', description: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('name') && i.message === 'required')).toBe(true)
    }
  })

  it('name 超过 64 触发 maxLength', () => {
    const r = dictTypeSchema.safeParse({ name: 'a'.repeat(65), code: 'ok', description: '' })
    expect(r.success).toBe(false)
  })

  it('code 以大写字母开头触发 pattern', () => {
    const r = dictTypeSchema.safeParse({ name: 'n', code: 'Order', description: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('code') && i.message === 'pattern')).toBe(true)
    }
  })

  it('code 含非法字符触发 pattern', () => {
    const r = dictTypeSchema.safeParse({ name: 'n', code: 'order-status', description: '' })
    expect(r.success).toBe(false)
  })

  it('description 可选,空值通过', () => {
    const r = dictTypeSchema.safeParse({ name: 'n', code: 'order_status' })
    expect(r.success).toBe(true)
  })

  it('EMPTY_DICT_TYPE_FORM 通过校验', () => {
    const r = dictTypeSchema.safeParse(EMPTY_DICT_TYPE_FORM)
    expect(r.success).toBe(false) // name/code 必填
  })

  it('EMPTY_DICT_TYPE_FORM 类型契约', () => {
    const v: DictTypeFormValues = EMPTY_DICT_TYPE_FORM
    expect(v.name).toBe('')
    expect(v.code).toBe('')
    expect(v.description).toBe('')
  })
})

describe('dictItemSchema', () => {
  it('合法值通过校验', () => {
    const r = dictItemSchema.safeParse({
      label: '待支付',
      value: 'pending',
      sort: 1,
      dictType: 'order_status',
      listClass: 'warning',
      status: 1,
      cssClass: '',
      remark: '',
    })
    expect(r.success).toBe(true)
  })

  it('sort 为负数触发 min', () => {
    const r = dictItemSchema.safeParse({
      label: 'l',
      value: 'v',
      sort: -1,
      dictType: 'd',
      listClass: 'default',
      status: 1,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('sort'))).toBe(true)
    }
  })

  it('listClass 非法值触发 enum 错误', () => {
    const r = dictItemSchema.safeParse({
      label: 'l',
      value: 'v',
      sort: 0,
      dictType: 'd',
      listClass: 'invalid' as never,
      status: 1,
    })
    expect(r.success).toBe(false)
  })

  it('status 只能 0 或 1', () => {
    const r = dictItemSchema.safeParse({
      label: 'l',
      value: 'v',
      sort: 0,
      dictType: 'd',
      listClass: 'default',
      status: 2 as never,
    })
    expect(r.success).toBe(false)
  })

  it('label 超过 128 触发 maxLength', () => {
    const r = dictItemSchema.safeParse({
      label: 'a'.repeat(129),
      value: 'v',
      sort: 0,
      dictType: 'd',
      listClass: 'default',
      status: 1,
    })
    expect(r.success).toBe(false)
  })

  it('EMPTY_DICT_ITEM_FORM 触发必填错误', () => {
    const r = dictItemSchema.safeParse(EMPTY_DICT_ITEM_FORM)
    expect(r.success).toBe(false)
  })

  it('EMPTY_DICT_ITEM_FORM 类型契约', () => {
    const v: DictItemFormValues = EMPTY_DICT_ITEM_FORM
    expect(v.listClass).toBe('default')
    expect(v.status).toBe(1)
    expect(v.sort).toBe(0)
  })
})
