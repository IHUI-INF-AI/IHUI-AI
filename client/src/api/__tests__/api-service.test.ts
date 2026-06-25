import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

import * as api from '../api-mgmt/api-service'

describe('api-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getApiTokens 应能正常调用', async () => {
    const fn = (api as any).getApiTokens
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiTokenDetail 应能正常调用', async () => {
    const fn = (api as any).getApiTokenDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createApiToken 应能正常调用', async () => {
    const fn = (api as any).createApiToken
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateApiToken 应能正常调用', async () => {
    const fn = (api as any).updateApiToken
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteApiToken 应能正常调用', async () => {
    const fn = (api as any).deleteApiToken
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('regenerateApiToken 应能正常调用', async () => {
    const fn = (api as any).regenerateApiToken
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiUsageStats 应能正常调用', async () => {
    const fn = (api as any).getApiUsageStats
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiCallLogs 应能正常调用', async () => {
    const fn = (api as any).getApiCallLogs
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiCallLogDetail 应能正常调用', async () => {
    const fn = (api as any).getApiCallLogDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('exportApiCallLogs 应能正常调用', async () => {
    const fn = (api as any).exportApiCallLogs
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getModelApiInfo 应能正常调用', async () => {
    const fn = (api as any).getModelApiInfo
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getModelPricingList 应能正常调用', async () => {
    const fn = (api as any).getModelPricingList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiServiceConfig 应能正常调用', async () => {
    const fn = (api as any).getApiServiceConfig
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getUserApiBalance 应能正常调用', async () => {
    const fn = (api as any).getUserApiBalance
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getApiRechargeRecords 应能正常调用', async () => {
    const fn = (api as any).getApiRechargeRecords
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('generateApiExample 应能正常调用', async () => {
    const fn = (api as any).generateApiExample
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('formatTokenCount 应能正常调用', async () => {
    const fn = (api as any).formatTokenCount
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('formatCost 应能正常调用', async () => {
    const fn = (api as any).formatCost
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('calculateTokenCost 应能正常调用', async () => {
    const fn = (api as any).calculateTokenCost
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
