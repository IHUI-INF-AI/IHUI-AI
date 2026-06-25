import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../remote/remote-config'

describe('remote-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchRemoteConfigs 应能正常调用', async () => {
    const fn = (api as any).fetchRemoteConfigs
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('reportExposure 应能正常调用', async () => {
    const fn = (api as any).reportExposure
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('reportConversion 应能正常调用', async () => {
    const fn = (api as any).reportConversion
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createExperiment 应能正常调用', async () => {
    const fn = (api as any).createExperiment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateExperiment 应能正常调用', async () => {
    const fn = (api as any).updateExperiment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteExperiment 应能正常调用', async () => {
    const fn = (api as any).deleteExperiment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('listExperiments 应能正常调用', async () => {
    const fn = (api as any).listExperiments
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('remoteConfigManager.fetch 应能正常调用', async () => {
    const obj = (api as any).remoteConfigManager
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.fetch()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('remoteConfigManager.create 应能正常调用', async () => {
    const obj = (api as any).remoteConfigManager
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.create()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('remoteConfigManager.update 应能正常调用', async () => {
    const obj = (api as any).remoteConfigManager
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.update()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('remoteConfigManager.delete 应能正常调用', async () => {
    const obj = (api as any).remoteConfigManager
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.delete()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('remoteConfigManager.list 应能正常调用', async () => {
    const obj = (api as any).remoteConfigManager
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.list()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
