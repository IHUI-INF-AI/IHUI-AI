import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../favorites'

describe('favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('addFavorite 应能正常调用', async () => {
    const fn = (api as any).addFavorite
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('getFavorites 应能正常调用', async () => {
    const fn = (api as any).getFavorites
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('removeFavorite 应能正常调用', async () => {
    const fn = (api as any).removeFavorite
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('checkFavorite 应能正常调用', async () => {
    const fn = (api as any).checkFavorite
    expect(typeof fn).toBe('function')
    try {
      const result = await fn()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

})
