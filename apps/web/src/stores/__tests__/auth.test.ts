import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, isAuthenticated: false, user: null })
  })

  it('初始状态未认证', () => {
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.isAuthenticated).toBe(false)
    expect(s.user).toBeNull()
  })

  it('setToken 设置 token 并标记已认证', () => {
    useAuthStore.getState().setToken('abc123')
    const s = useAuthStore.getState()
    expect(s.token).toBe('abc123')
    expect(s.isAuthenticated).toBe(true)
  })

  it('setToken(null) 清除认证', () => {
    useAuthStore.getState().setToken('abc')
    useAuthStore.getState().setToken(null)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('setUser 设置用户', () => {
    const user = { id: '1', nickname: 'test' }
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('logout 清空所有状态', () => {
    useAuthStore.getState().setToken('abc')
    useAuthStore.getState().setUser({ id: '1', nickname: 'test' })
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.isAuthenticated).toBe(false)
    expect(s.user).toBeNull()
  })
})
