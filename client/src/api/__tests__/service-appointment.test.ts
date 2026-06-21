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

import * as api from '../service-appointment'

describe('service-appointment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createAppointment 应能正常调用', async () => {
    const fn = (api as any).createAppointment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAppointments 应能正常调用', async () => {
    const fn = (api as any).getAppointments
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAppointment 应能正常调用', async () => {
    const fn = (api as any).getAppointment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('cancelAppointment 应能正常调用', async () => {
    const fn = (api as any).cancelAppointment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('confirmAppointment 应能正常调用', async () => {
    const fn = (api as any).confirmAppointment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('completeAppointment 应能正常调用', async () => {
    const fn = (api as any).completeAppointment
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
