import { describe, it, expect } from 'vitest'
import { withAudit, withAuditBoth } from '../src/utils/audit.js'

describe('withAudit helper (update 场景)', () => {
  it('附加 updatedBy = operatorId', () => {
    const result = withAudit({ name: 'foo', amount: 100 }, 'user-123')
    expect(result).toEqual({ name: 'foo', amount: 100, updatedBy: 'user-123' })
  })

  it('operatorId 为 null 时 updatedBy 为 null(系统操作)', () => {
    const result = withAudit({ name: 'foo' }, null)
    expect(result).toEqual({ name: 'foo', updatedBy: null })
  })

  it('不修改原对象(纯函数)', () => {
    const original = { name: 'foo' }
    const result = withAudit(original, 'user-123')
    expect(original).toEqual({ name: 'foo' })
    expect(result).not.toBe(original)
  })

  it('不覆盖已存在的 updatedBy 字段(覆盖为当前 operator)', () => {
    // G10 已写入的 updatedBy 应该被覆盖为当前操作者
    const result = withAudit({ name: 'foo', updatedBy: 'old-user' }, 'new-user')
    expect(result.updatedBy).toBe('new-user')
  })

  it('保持其他字段不变', () => {
    const input = { a: 1, b: 'x', c: { nested: true } }
    const result = withAudit(input, 'user-1')
    expect(result.a).toBe(1)
    expect(result.b).toBe('x')
    expect(result.c).toEqual({ nested: true })
    expect(result.updatedBy).toBe('user-1')
  })
})

describe('withAuditBoth helper (insert 场景)', () => {
  it('同时附加 createdBy + updatedBy = operatorId', () => {
    const result = withAuditBoth({ name: 'foo', amount: 100 }, 'user-123')
    expect(result).toEqual({
      name: 'foo',
      amount: 100,
      createdBy: 'user-123',
      updatedBy: 'user-123',
    })
  })

  it('operatorId 为 null 时 createdBy + updatedBy 都为 null(系统操作,如 commission-service 自动分佣)', () => {
    const result = withAuditBoth({ name: 'foo' }, null)
    expect(result).toEqual({ name: 'foo', createdBy: null, updatedBy: null })
  })

  it('不修改原对象(纯函数)', () => {
    const original = { name: 'foo' }
    const result = withAuditBoth(original, 'user-123')
    expect(original).toEqual({ name: 'foo' })
    expect(result).not.toBe(original)
  })

  it('已存在的 createdBy/updatedBy 字段被覆盖为当前 operator', () => {
    const result = withAuditBoth(
      { name: 'foo', createdBy: 'old-user', updatedBy: 'old-user' },
      'new-user',
    )
    expect(result.createdBy).toBe('new-user')
    expect(result.updatedBy).toBe('new-user')
  })

  it('createdBy 与 updatedBy 总是相同(insert 一次性创建,默认两者一致)', () => {
    const result = withAuditBoth({ name: 'bar' }, 'op-99')
    expect(result.createdBy).toBe(result.updatedBy)
  })

  it('保持其他业务字段不变', () => {
    const input = { orderNo: 'WX20260722001', amount: 9900, currency: 'CNY' }
    const result = withAuditBoth(input, 'user-1')
    expect(result.orderNo).toBe('WX20260722001')
    expect(result.amount).toBe(9900)
    expect(result.currency).toBe('CNY')
    expect(result.createdBy).toBe('user-1')
    expect(result.updatedBy).toBe('user-1')
  })

  it('支持复杂嵌套字段(jsonb 字段不丢失)', () => {
    const input = { name: 'task', payload: { foo: 'bar' }, accountInfo: { bank: 'ICBC' } }
    const result = withAuditBoth(input, 'admin-1')
    expect(result.payload).toEqual({ foo: 'bar' })
    expect(result.accountInfo).toEqual({ bank: 'ICBC' })
    expect(result.createdBy).toBe('admin-1')
  })
})
