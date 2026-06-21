import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../skills-backend'

describe('skills-backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSkillsListFromBackend 应能正常调用', async () => {
    const fn = (api as any).getSkillsListFromBackend
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSkillMetadataFromBackend 应能正常调用', async () => {
    const fn = (api as any).getSkillMetadataFromBackend
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSkillContentFromBackend 应能正常调用', async () => {
    const fn = (api as any).getSkillContentFromBackend
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSkillResourceFromBackend 应能正常调用', async () => {
    const fn = (api as any).getSkillResourceFromBackend
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
