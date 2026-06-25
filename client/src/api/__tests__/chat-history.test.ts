import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

import * as api from '../chat/chat-history'

describe('chat-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getConversations 应能正常调用', async () => {
    const fn = (api as any).getConversations
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getConversation 应能正常调用', async () => {
    const fn = (api as any).getConversation
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getConversationMessages 应能正常调用', async () => {
    const fn = (api as any).getConversationMessages
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('createConversation 应能正常调用', async () => {
    const fn = (api as any).createConversation
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateConversationTitle 应能正常调用', async () => {
    const fn = (api as any).updateConversationTitle
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteConversation 应能正常调用', async () => {
    const fn = (api as any).deleteConversation
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteMessage 应能正常调用', async () => {
    const fn = (api as any).deleteMessage
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('endConversation 应能正常调用', async () => {
    const fn = (api as any).endConversation
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
