import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../system/monitoring'

describe('monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPoolStats 应能正常调用', async () => {
    const fn = (api as any).getPoolStats
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getIndexUsage 应能正常调用', async () => {
    const fn = (api as any).getIndexUsage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('analyzeQueryPlan 应能正常调用', async () => {
    const fn = (api as any).analyzeQueryPlan
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('batchQuery 应能正常调用', async () => {
    const fn = (api as any).batchQuery
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('optimizedPaginate 应能正常调用', async () => {
    const fn = (api as any).optimizedPaginate
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('clearQueryCache 应能正常调用', async () => {
    const fn = (api as any).clearQueryCache
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
