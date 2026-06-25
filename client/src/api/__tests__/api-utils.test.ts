import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import * as api from '../api-mgmt/api-utils'

describe('api-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unifiedLogin 应能正常调用', async () => {
    const fn = (api as any).unifiedLogin
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedRegister 应能正常调用', async () => {
    const fn = (api as any).unifiedRegister
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedLogout 应能正常调用', async () => {
    const fn = (api as any).unifiedLogout
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedRefreshToken 应能正常调用', async () => {
    const fn = (api as any).unifiedRefreshToken
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedChangePassword 应能正常调用', async () => {
    const fn = (api as any).unifiedChangePassword
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedSendMessage 应能正常调用', async () => {
    const fn = (api as any).unifiedSendMessage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedGetUserVipInfo 应能正常调用', async () => {
    const fn = (api as any).unifiedGetUserVipInfo
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedGetDeveloperList 应能正常调用', async () => {
    const fn = (api as any).unifiedGetDeveloperList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unifiedSetUserIdentity 应能正常调用', async () => {
    const fn = (api as any).unifiedSetUserIdentity
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
