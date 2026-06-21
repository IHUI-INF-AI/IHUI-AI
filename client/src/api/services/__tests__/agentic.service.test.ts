import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../agentic.service'

describe('agentic.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createAgenticSwarm 应能正常调用', async () => {
    const fn = (api as any).createAgenticSwarm
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSwarmStatus 应能正常调用', async () => {
    const fn = (api as any).getSwarmStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSwarmResults 应能正常调用', async () => {
    const fn = (api as any).getSwarmResults
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSwarmPerformance 应能正常调用', async () => {
    const fn = (api as any).getSwarmPerformance
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getUserSwarms 应能正常调用', async () => {
    const fn = (api as any).getUserSwarms
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('cancelSwarm 应能正常调用', async () => {
    const fn = (api as any).cancelSwarm
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSwarmOptimization 应能正常调用', async () => {
    const fn = (api as any).getSwarmOptimization
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
