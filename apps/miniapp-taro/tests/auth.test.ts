import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockReLaunch } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockReLaunch: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => { taroStorage[key] = val },
  removeStorageSync: (key: string) => { delete taroStorage[key] },
  reLaunch: (opts: { url: string }) => mockReLaunch(opts),
  default: {
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    setStorageSync: (key: string, val: unknown) => { taroStorage[key] = val },
    removeStorageSync: (key: string) => { delete taroStorage[key] },
    reLaunch: (opts: { url: string }) => mockReLaunch(opts),
  },
}))

import {
  getToken, setToken,
  getRefreshToken, setRefreshToken,
  getUserInfo, setUserInfo,
  clearAuth, isLoggedIn, checkLoginStatus,
  type UserInfo,
} from '../src/utils/auth'

describe('miniapp-taro 认证工具函数', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  describe('token 存取', () => {
    it('setToken / getToken 基本存取', () => {
      expect(getToken()).toBe('')
      setToken('abc123')
      expect(getToken()).toBe('abc123')
    })

    it('getToken 空存储返回空字符串', () => {
      expect(getToken()).toBe('')
    })

    it('setToken 覆盖旧值', () => {
      setToken('old')
      setToken('new')
      expect(getToken()).toBe('new')
    })
  })

  describe('refreshToken 存取', () => {
    it('setRefreshToken / getRefreshToken 基本存取', () => {
      expect(getRefreshToken()).toBe('')
      setRefreshToken('refresh-xyz')
      expect(getRefreshToken()).toBe('refresh-xyz')
    })
  })

  describe('userInfo 存取', () => {
    it('setUserInfo / getUserInfo 基本存取', () => {
      expect(getUserInfo()).toBeNull()
      const user: UserInfo = { id: 'u1', nickname: 'Test', phone: '13800138000' }
      setUserInfo(user)
      expect(getUserInfo()).toEqual(user)
    })

    it('getUserInfo 空存储返回 null', () => {
      expect(getUserInfo()).toBeNull()
    })
  })

  describe('clearAuth', () => {
    it('clearAuth 清除所有登录态', () => {
      setToken('token-1')
      setRefreshToken('refresh-1')
      setUserInfo({ id: 'u1', nickname: 'Test' })
      clearAuth()
      expect(getToken()).toBe('')
      expect(getRefreshToken()).toBe('')
      expect(getUserInfo()).toBeNull()
    })

    it('clearAuth 无数据时不报错', () => {
      expect(() => clearAuth()).not.toThrow()
    })
  })

  describe('isLoggedIn', () => {
    it('有 token 时返回 true', () => {
      setToken('abc123')
      expect(isLoggedIn()).toBe(true)
    })

    it('无 token 时返回 false', () => {
      expect(isLoggedIn()).toBe(false)
    })

    it('token 为空字符串时返回 false', () => {
      setToken('')
      expect(isLoggedIn()).toBe(false)
    })

    it('clearAuth 后返回 false', () => {
      setToken('token')
      clearAuth()
      expect(isLoggedIn()).toBe(false)
    })
  })

  describe('checkLoginStatus', () => {
    it('已登录返回 true 不跳转', () => {
      setToken('token')
      const result = checkLoginStatus()
      expect(result).toBe(true)
      expect(mockReLaunch).not.toHaveBeenCalled()
    })

    it('未登录 redirect=false 返回 false 不跳转', () => {
      const result = checkLoginStatus(false)
      expect(result).toBe(false)
      expect(mockReLaunch).not.toHaveBeenCalled()
    })

    it('未登录 redirect=true 跳转登录页', () => {
      const result = checkLoginStatus(true)
      expect(result).toBe(false)
      expect(mockReLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' })
    })

    it('默认参数不跳转', () => {
      const result = checkLoginStatus()
      expect(result).toBe(false)
      expect(mockReLaunch).not.toHaveBeenCalled()
    })
  })
})
