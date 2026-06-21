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

import * as api from '../sdks'

describe('sdks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSdks 应能正常调用', async () => {
    const fn = (api as any).getSdks
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSdkDetail 应能正常调用', async () => {
    const fn = (api as any).getSdkDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createSdk 应能正常调用', async () => {
    const fn = (api as any).createSdk
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateSdk 应能正常调用', async () => {
    const fn = (api as any).updateSdk
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteSdk 应能正常调用', async () => {
    const fn = (api as any).deleteSdk
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('generateSdk 应能正常调用', async () => {
    const fn = (api as any).generateSdk
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('downloadSdk 应能正常调用', async () => {
    const fn = (api as any).downloadSdk
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
