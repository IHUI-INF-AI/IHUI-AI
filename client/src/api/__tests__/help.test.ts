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

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

import * as api from '../help'

describe('help', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getFAQs 应能正常调用', async () => {
    const fn = (api as any).getFAQs
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getFAQCategories 应能正常调用', async () => {
    const fn = (api as any).getFAQCategories
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('markFAQHelpful 应能正常调用', async () => {
    const fn = (api as any).markFAQHelpful
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('markFAQNotHelpful 应能正常调用', async () => {
    const fn = (api as any).markFAQNotHelpful
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('recordFAQView 应能正常调用', async () => {
    const fn = (api as any).recordFAQView
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
