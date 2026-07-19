import { describe, it, expect } from 'vitest'
import { isAdminUser, ADMIN_ROLE_THRESHOLD } from '../src/lib/admin-guard'

describe('admin-guard', () => {
  it('returns false for null user', () => {
    expect(isAdminUser(null)).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(isAdminUser(undefined)).toBe(false)
  })

  it('returns false when roleId is 0 (普通用户)', () => {
    expect(isAdminUser({ id: 'u1', roleId: 0 } as never)).toBe(false)
  })

  it('returns false when roleId is missing', () => {
    expect(isAdminUser({ id: 'u1' } as never)).toBe(false)
  })

  it('returns true when roleId >= threshold', () => {
    expect(isAdminUser({ id: 'u1', roleId: ADMIN_ROLE_THRESHOLD } as never)).toBe(true)
    expect(isAdminUser({ id: 'u1', roleId: 5 } as never)).toBe(true)
  })
})
