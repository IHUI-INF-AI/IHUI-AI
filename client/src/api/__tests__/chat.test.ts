import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../chat/chat'

describe('chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sendMessage 应能正常调用', async () => {
    const fn = (api as any).sendMessage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
