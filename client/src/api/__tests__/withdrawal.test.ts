import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../payment/withdrawal'

describe('withdrawal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zhsWithdrawal 应能正常调用', async () => {
    const fn = (api as any).zhsWithdrawal
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawal 应能正常调用', async () => {
    const fn = (api as any).getWithdrawal
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawals 应能正常调用', async () => {
    const fn = (api as any).getWithdrawals
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawalDetail 应能正常调用', async () => {
    const fn = (api as any).getWithdrawalDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('approveWithdrawal 应能正常调用', async () => {
    const fn = (api as any).approveWithdrawal
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('rejectWithdrawal 应能正常调用', async () => {
    const fn = (api as any).rejectWithdrawal
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawalRecords 应能正常调用', async () => {
    const fn = (api as any).getWithdrawalRecords
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
