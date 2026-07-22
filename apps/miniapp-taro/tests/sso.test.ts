import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockFetch } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockFetch: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  removeStorageSync: (key: string) => { delete taroStorage[key] },
  setStorageSync: (key: string, val: unknown) => { taroStorage[key] = val },
  reLaunch: vi.fn(),
  default: {
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    removeStorageSync: (key: string) => { delete taroStorage[key] },
    setStorageSync: (key: string, val: unknown) => { taroStorage[key] = val },
    reLaunch: vi.fn(),
  },
}))

vi.stubGlobal('fetch', mockFetch)

import {
  getStoredSsoCode,
  clearSsoCode,
  getSsoLoginUrl,
  exchangeSsoCode,
  validateToken,
  ssoLogout,
} from '../src/utils/sso'

describe('miniapp-taro SSO 流程', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  describe('getStoredSsoCode / clearSsoCode', () => {
    it('getStoredSsoCode 空存储返回空字符串', () => {
      expect(getStoredSsoCode()).toBe('')
    })

    it('getStoredSsoCode 有值时返回存储的 code', () => {
      taroStorage['ihui_sso_code'] = 'sso-code-123'
      expect(getStoredSsoCode()).toBe('sso-code-123')
    })

    it('clearSsoCode 清除存储的 code', () => {
      taroStorage['ihui_sso_code'] = 'sso-code-123'
      clearSsoCode()
      expect(getStoredSsoCode()).toBe('')
    })
  })

  describe('getSsoLoginUrl', () => {
    it('生成正确的 SSO 登录 URL', () => {
      const url = getSsoLoginUrl('/pages/index/index')
      expect(url).toContain('/sso/login?')
      expect(url).toContain('redirect=%2Fpages%2Findex%2Findex')
      expect(url).toContain('client_id=miniapp-taro')
    })

    it('使用默认 webBase', () => {
      const url = getSsoLoginUrl('/pages/test')
      expect(url).toContain('http://localhost:8801/sso/login?')
    })
  })

  describe('exchangeSsoCode', () => {
    const mockTokenData = {
      accessToken: 'at-001',
      refreshToken: 'rt-001',
      expiresIn: 7200,
      refreshExpiresIn: 2592000,
      user: {
        id: 'u-001', phone: '13800138000', email: 'test@test.com',
        nickname: 'Test', avatar: 'https://avatar.png',
        roleId: 1, status: 1,
      },
    }

    it('成功返回 token 数据', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 200, data: mockTokenData }),
      })
      const result = await exchangeSsoCode('valid-code')
      expect(result).toEqual(mockTokenData)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/sso/exchange',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'valid-code', clientId: 'miniapp-taro' }),
        }),
      )
    })

    it('HTTP 错误返回 null', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })
      const result = await exchangeSsoCode('bad-code')
      expect(result).toBeNull()
    })

    it('code 非 200 返回 null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 400, message: 'invalid code' }),
      })
      const result = await exchangeSsoCode('expired-code')
      expect(result).toBeNull()
    })

    it('无 data 字段返回 null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 200 }),
      })
      const result = await exchangeSsoCode('code-no-data')
      expect(result).toBeNull()
    })

    it('网络异常返回 null', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'))
      const result = await exchangeSsoCode('any-code')
      expect(result).toBeNull()
    })
  })

  describe('validateToken', () => {
    it('有效 token 返回 true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 200, data: { valid: true } }),
      })
      const result = await validateToken('valid-token')
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8801/api/auth/sso/validate',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      )
    })

    it('无效 token 返回 false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 200, data: { valid: false } }),
      })
      const result = await validateToken('invalid-token')
      expect(result).toBe(false)
    })

    it('HTTP 错误返回 false', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
      const result = await validateToken('expired-token')
      expect(result).toBe(false)
    })

    it('code 非 200 返回 false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 401, data: { valid: true } }),
      })
      const result = await validateToken('token')
      expect(result).toBe(false)
    })

    it('网络异常返回 false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network'))
      const result = await validateToken('token')
      expect(result).toBe(false)
    })
  })

  describe('ssoLogout', () => {
    it('成功返回 true', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const result = await ssoLogout('valid-token')
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/sso/logout',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token' },
        }),
      )
    })

    it('HTTP 错误返回 false', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      const result = await ssoLogout('token')
      expect(result).toBe(false)
    })

    it('网络异常返回 false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network'))
      const result = await ssoLogout('token')
      expect(result).toBe(false)
    })
  })
})
