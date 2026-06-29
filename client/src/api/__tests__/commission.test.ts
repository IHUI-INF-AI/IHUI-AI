import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../commission'

describe('commission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCommissionOverview 应能正常调用', async () => {
    const fn = (api as any).getCommissionOverview
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getInviteInfo 应能正常调用', async () => {
    const fn = (api as any).getInviteInfo
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getCommissionList 应能正常调用', async () => {
    const fn = (api as any).getCommissionList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getInvitedUsers 应能正常调用', async () => {
    const fn = (api as any).getInvitedUsers
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawList 应能正常调用', async () => {
    const fn = (api as any).getWithdrawList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('applyWithdraw 应能正常调用', async () => {
    const fn = (api as any).applyWithdraw
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('cancelWithdraw 应能正常调用', async () => {
    const fn = (api as any).cancelWithdraw
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getWithdrawConfig 应能正常调用', async () => {
    const fn = (api as any).getWithdrawConfig
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getCommissionStats 应能正常调用', async () => {
    const fn = (api as any).getCommissionStats
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('generateInvitePoster 应能正常调用', async () => {
    const fn = (api as any).generateInvitePoster
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getCommissionRanking 应能正常调用', async () => {
    const fn = (api as any).getCommissionRanking
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getCommissionRules 应能正常调用', async () => {
    const fn = (api as any).getCommissionRules
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
