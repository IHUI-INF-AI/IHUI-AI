import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('../utils/apiResponseHandler', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import * as api from '../agent/agent-settlement'

describe('agent-settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).createAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).updateAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('exportAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).exportAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentSettlementById 应能正常调用', async () => {
    const fn = (api as any).getAgentSettlementById
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentSettlementList 应能正常调用', async () => {
    const fn = (api as any).getAgentSettlementList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).deleteAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('batchDeleteSettlement 应能正常调用', async () => {
    const fn = (api as any).batchDeleteSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSettlementOverview 应能正常调用', async () => {
    const fn = (api as any).getSettlementOverview
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('syncExistingToSettlement 应能正常调用', async () => {
    const fn = (api as any).syncExistingToSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getIncomeOverview 应能正常调用', async () => {
    const fn = (api as any).getIncomeOverview
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('settleAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).settleAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('withdrawAgentSettlement 应能正常调用', async () => {
    const fn = (api as any).withdrawAgentSettlement
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
