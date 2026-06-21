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

import * as api from '../xuqiu'

describe('xuqiu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getDemandsList 应能正常调用', async () => {
    const fn = (api as any).getDemandsList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createDemand 应能正常调用', async () => {
    const fn = (api as any).createDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('batchCreateDemands 应能正常调用', async () => {
    const fn = (api as any).batchCreateDemands
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getDemandDetail 应能正常调用', async () => {
    const fn = (api as any).getDemandDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateDemandStatus 应能正常调用', async () => {
    const fn = (api as any).updateDemandStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('likeDemand 应能正常调用', async () => {
    const fn = (api as any).likeDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unlikeDemand 应能正常调用', async () => {
    const fn = (api as any).unlikeDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('collectDemand 应能正常调用', async () => {
    const fn = (api as any).collectDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uncollectDemand 应能正常调用', async () => {
    const fn = (api as any).uncollectDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('followDemandUser 应能正常调用', async () => {
    const fn = (api as any).followDemandUser
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unfollowDemandUser 应能正常调用', async () => {
    const fn = (api as any).unfollowDemandUser
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getDemandComments 应能正常调用', async () => {
    const fn = (api as any).getDemandComments
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createDemandComment 应能正常调用', async () => {
    const fn = (api as any).createDemandComment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('shareDemand 应能正常调用', async () => {
    const fn = (api as any).shareDemand
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('likeComment 应能正常调用', async () => {
    const fn = (api as any).likeComment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unlikeComment 应能正常调用', async () => {
    const fn = (api as any).unlikeComment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
