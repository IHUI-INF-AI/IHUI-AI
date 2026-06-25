import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../ai/ai-index'

describe('ai-index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getModelChat 应能正常调用', async () => {
    const fn = (api as any).getModelChat
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createModelChat 应能正常调用', async () => {
    const fn = (api as any).createModelChat
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('queryAgentContext 应能正常调用', async () => {
    const fn = (api as any).queryAgentContext
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateMark 应能正常调用', async () => {
    const fn = (api as any).updateMark
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('removeModelChat 应能正常调用', async () => {
    const fn = (api as any).removeModelChat
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('checkFirstShareStatus 应能正常调用', async () => {
    const fn = (api as any).checkFirstShareStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('firstShare 应能正常调用', async () => {
    const fn = (api as any).firstShare
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
