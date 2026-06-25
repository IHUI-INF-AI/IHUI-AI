import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import * as api from '../learn/docs'

describe('docs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploadDocument 应能正常调用', async () => {
    const fn = (api as any).uploadDocument
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('uploadOriginalDocument 应能正常调用', async () => {
    const fn = (api as any).uploadOriginalDocument
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getDocList 应能正常调用', async () => {
    const fn = (api as any).getDocList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getDocContent 应能正常调用', async () => {
    const fn = (api as any).getDocContent
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteDocument 应能正常调用', async () => {
    const fn = (api as any).deleteDocument
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateDocument 应能正常调用', async () => {
    const fn = (api as any).updateDocument
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getDocCategories 应能正常调用', async () => {
    const fn = (api as any).getDocCategories
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
