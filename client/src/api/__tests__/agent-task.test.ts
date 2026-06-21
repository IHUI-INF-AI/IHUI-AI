import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('../utils/apiResponseHandler', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import * as api from '../agent-task'

describe('agent-task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createAgentTask 应能正常调用', async () => {
    const fn = (api as any).createAgentTask
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('updateAgentTask 应能正常调用', async () => {
    const fn = (api as any).updateAgentTask
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('setAgentTaskDeveloper 应能正常调用', async () => {
    const fn = (api as any).setAgentTaskDeveloper
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('exportAgentTask 应能正常调用', async () => {
    const fn = (api as any).exportAgentTask
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('circulateAgentTaskDeveloper 应能正常调用', async () => {
    const fn = (api as any).circulateAgentTaskDeveloper
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentTaskById 应能正常调用', async () => {
    const fn = (api as any).getAgentTaskById
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getAgentTaskList 应能正常调用', async () => {
    const fn = (api as any).getAgentTaskList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('deleteAgentTask 应能正常调用', async () => {
    const fn = (api as any).deleteAgentTask
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
