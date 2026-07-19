/**
 * 鉴权工具单元测试
 * 验证 token / userInfo / clearAuth / isLoggedIn 行为
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const taroStorage: Record<string, unknown> = {}
const mockReLaunch = vi.fn()
vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: (opts: { url: string }) => mockReLaunch(opts),
}))

import {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  getUserInfo,
  setUserInfo,
  clearAuth,
  isLoggedIn,
  checkLoginStatus,
} from '../auth'

describe('miniapp-taro auth 工具', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    mockReLaunch.mockClear()
  })

  it('setToken + getToken 双向正确', () => {
    setToken('tk-001')
    expect(getToken()).toBe('tk-001')
  })

  it('getToken 默认空字符串', () => {
    expect(getToken()).toBe('')
  })

  it('setRefreshToken + getRefreshToken', () => {
    setRefreshToken('rt-001')
    expect(getRefreshToken()).toBe('rt-001')
  })

  it('setUserInfo + getUserInfo 完整往返', () => {
    setUserInfo({ id: 'u-1', nickname: 'Li Sihan', phone: '13800000000' })
    const info = getUserInfo()
    expect(info).toEqual({ id: 'u-1', nickname: 'Li Sihan', phone: '13800000000' })
  })

  it('clearAuth 清空 token + refreshToken + userInfo', () => {
    setToken('tk-1')
    setRefreshToken('rt-1')
    setUserInfo({ id: 'u-1' })
    clearAuth()
    expect(getToken()).toBe('')
    expect(getRefreshToken()).toBe('')
    expect(getUserInfo()).toBeNull()
  })

  it('isLoggedIn 与 token 状态一致', () => {
    expect(isLoggedIn()).toBe(false)
    setToken('tk-1')
    expect(isLoggedIn()).toBe(true)
    clearAuth()
    expect(isLoggedIn()).toBe(false)
  })

  it('checkLoginStatus 未登录 + redirect=false 不跳转', () => {
    const ok = checkLoginStatus(false)
    expect(ok).toBe(false)
    expect(mockReLaunch).not.toHaveBeenCalled()
  })

  it('checkLoginStatus 未登录 + redirect=true 跳转登录页', () => {
    const ok = checkLoginStatus(true)
    expect(ok).toBe(false)
    expect(mockReLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' })
  })

  it('checkLoginStatus 已登录不跳转', () => {
    setToken('tk-1')
    const ok = checkLoginStatus(true)
    expect(ok).toBe(true)
    expect(mockReLaunch).not.toHaveBeenCalled()
  })
})
