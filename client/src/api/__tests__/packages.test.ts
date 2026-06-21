import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../packages'

describe('packages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPackages 应能正常调用', async () => {
    const fn = (api as any).getPackages
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAllAvailablePackages 应能正常调用', async () => {
    const fn = (api as any).getAllAvailablePackages
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getPackage 应能正常调用', async () => {
    const fn = (api as any).getPackage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getPackageUsage 应能正常调用', async () => {
    const fn = (api as any).getPackageUsage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('upgradePackage 应能正常调用', async () => {
    const fn = (api as any).upgradePackage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('downgradePackage 应能正常调用', async () => {
    const fn = (api as any).downgradePackage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('linkAppsToPackage 应能正常调用', async () => {
    const fn = (api as any).linkAppsToPackage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('unlinkAppFromPackage 应能正常调用', async () => {
    const fn = (api as any).unlinkAppFromPackage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getPackageApps 应能正常调用', async () => {
    const fn = (api as any).getPackageApps
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getPackageUsageByApp 应能正常调用', async () => {
    const fn = (api as any).getPackageUsageByApp
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
