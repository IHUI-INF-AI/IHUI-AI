import { describe, it, expect } from 'vitest'
import { withAudit } from '../audit.js'

describe('withAudit helper', () => {
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

  it('不覆盖已存在的 updatedBy 字段', () => {
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
