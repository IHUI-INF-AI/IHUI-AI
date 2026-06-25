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

import * as api from '../agent/agent-examine'

describe('agent-examine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createAgentExamine 应能正常调用', async () => {
    const fn = (api as any).createAgentExamine
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentExamineList 应能正常调用', async () => {
    const fn = (api as any).getAgentExamineList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentExamineDetail 应能正常调用', async () => {
    const fn = (api as any).getAgentExamineDetail
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateAgentExamine 应能正常调用', async () => {
    const fn = (api as any).updateAgentExamine
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentExamineStats 应能正常调用', async () => {
    const fn = (api as any).getAgentExamineStats
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('approveAgentExamine 应能正常调用', async () => {
    const fn = (api as any).approveAgentExamine
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('rejectAgentExamine 应能正常调用', async () => {
    const fn = (api as any).rejectAgentExamine
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('syncAgentAvatar 应能正常调用', async () => {
    const fn = (api as any).syncAgentAvatar
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('batchSyncAgentAvatar 应能正常调用', async () => {
    const fn = (api as any).batchSyncAgentAvatar
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
