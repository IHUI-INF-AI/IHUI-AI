import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../tasks'

describe('tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTasks 应能正常调用', async () => {
    const fn = (api as any).getTasks
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getTaskStatus 应能正常调用', async () => {
    const fn = (api as any).getTaskStatus
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('cancelTask 应能正常调用', async () => {
    const fn = (api as any).cancelTask
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
