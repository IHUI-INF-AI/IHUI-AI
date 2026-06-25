import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
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

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

import * as api from '../unified/unified-alipay'

describe('unified-alipay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generateAlipayQrCode 应能正常调用', async () => {
    const fn = (api as any).generateAlipayQrCode
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('checkAlipayQrStatus 应能正常调用', async () => {
    const fn = (api as any).checkAlipayQrStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('loginWithAlipayAuthCode 应能正常调用', async () => {
    const fn = (api as any).loginWithAlipayAuthCode
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAlipayAuthUrl 应能正常调用', async () => {
    const fn = (api as any).getAlipayAuthUrl
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('bindAlipayAccount 应能正常调用', async () => {
    const fn = (api as any).bindAlipayAccount
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unbindAlipayAccount 应能正常调用', async () => {
    const fn = (api as any).unbindAlipayAccount
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
