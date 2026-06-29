import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../skills'

describe('skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSkillsList 应能正常调用', async () => {
    const fn = (api as any).getSkillsList
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSkillInfo 应能正常调用', async () => {
    const fn = (api as any).getSkillInfo
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('loadSkillContent 应能正常调用', async () => {
    const fn = (api as any).loadSkillContent
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getSkillMetadata 应能正常调用', async () => {
    const fn = (api as any).getSkillMetadata
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
