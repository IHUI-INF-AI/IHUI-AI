/**
 * RLS 上下文工具测试。
 * 注:RLS 实际行为需要真实 PostgreSQL 连接测试,这里仅验证参数校验与降级逻辑。
 */
import { describe, it, expect } from 'vitest'
import { isValidTenantId, DEFAULT_TENANT_ID } from '../src/rls.js'

describe('rls 工具', () => {
  it('合法 UUID 通过 isValidTenantId', () => {
    expect(isValidTenantId('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isValidTenantId('aBc12345-1234-5678-9abc-def012345678')).toBe(true)
  })

  it('非法 UUID 拒绝', () => {
    expect(isValidTenantId('not-a-uuid')).toBe(false)
    expect(isValidTenantId('12345')).toBe(false)
    expect(isValidTenantId('')).toBe(false)
    expect(isValidTenantId('00000000-0000-0000-0000-00000000000')).toBe(false) // 少一位
    expect(isValidTenantId('00000000-0000-0000-0000-0000000000000')).toBe(false) // 多一位
  })

  it('默认租户 UUID 是全零', () => {
    expect(DEFAULT_TENANT_ID).toBe('00000000-0000-0000-0000-000000000000')
    expect(isValidTenantId(DEFAULT_TENANT_ID)).toBe(true)
  })
})
