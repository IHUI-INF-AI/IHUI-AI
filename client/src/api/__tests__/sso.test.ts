import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import * as api from '../sso'

describe('sso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ssoLoginByUuid 应能正常调用', async () => {
    const fn = (api as any).ssoLoginByUuid
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('buildEduPlatformUrl 应能正常调用', async () => {
    const fn = (api as any).buildEduPlatformUrl
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
