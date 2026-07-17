import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('getToken returns empty string by default', async () => {
    const mod = await import('../src/lib/token')
    expect(mod.getToken()).toBe('')
  })

  it('setToken persists to localStorage and updates cache', async () => {
    const mod = await import('../src/lib/token')
    mod.setToken('abc')
    expect(mod.getToken()).toBe('abc')
    expect(localStorage.getItem('ihui-desktop-token')).toBe('abc')
  })

  it('setToken(null) removes from localStorage and clears cache', async () => {
    const mod = await import('../src/lib/token')
    mod.setToken('abc')
    mod.setToken(null)
    expect(mod.getToken()).toBe('')
    expect(localStorage.getItem('ihui-desktop-token')).toBeNull()
  })

  it('getRefreshToken returns empty string by default', async () => {
    const mod = await import('../src/lib/token')
    expect(mod.getRefreshToken()).toBe('')
  })

  it('setRefreshToken persists to localStorage', async () => {
    const mod = await import('../src/lib/token')
    mod.setRefreshToken('refresh-xyz')
    expect(mod.getRefreshToken()).toBe('refresh-xyz')
    expect(localStorage.getItem('ihui-desktop-refresh-token')).toBe('refresh-xyz')
  })

  it('setRefreshToken(null) removes from localStorage', async () => {
    const mod = await import('../src/lib/token')
    mod.setRefreshToken('r')
    mod.setRefreshToken(null)
    expect(mod.getRefreshToken()).toBe('')
    expect(localStorage.getItem('ihui-desktop-refresh-token')).toBeNull()
  })

  it('clearToken clears both access and refresh tokens', async () => {
    const mod = await import('../src/lib/token')
    mod.setToken('a')
    mod.setRefreshToken('b')
    mod.clearToken()
    expect(mod.getToken()).toBe('')
    expect(mod.getRefreshToken()).toBe('')
    expect(localStorage.getItem('ihui-desktop-token')).toBeNull()
    expect(localStorage.getItem('ihui-desktop-refresh-token')).toBeNull()
  })

  it('reads token from localStorage on module load', async () => {
    localStorage.setItem('ihui-desktop-token', 'persisted')
    localStorage.setItem('ihui-desktop-refresh-token', 'persisted-r')
    const mod = await import('../src/lib/token')
    expect(mod.getToken()).toBe('persisted')
    expect(mod.getRefreshToken()).toBe('persisted-r')
  })
})
