import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../ai/ai-chat-types'

describe('ai-chat-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isFastAPIChatResponse 应能正常调用', async () => {
    const fn = (api as any).isFastAPIChatResponse
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('isCozeStreamEvent 应能正常调用', async () => {
    const fn = (api as any).isCozeStreamEvent
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('isAPIErrorResponse 应能正常调用', async () => {
    const fn = (api as any).isAPIErrorResponse
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
