// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockReLaunch, mockSwitchTab, mockGetCurrentPages } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockReLaunch: vi.fn(),
  mockSwitchTab: vi.fn(),
  mockGetCurrentPages: vi.fn((): unknown[] => []),
}))

vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: (opts: { url: string }) => mockReLaunch(opts),
  // 登录页已删(2026-10-23)⇒ 去登录界面改用 switchTab 到「我的」tab,并要读页栈判"是否已在"
  switchTab: (opts: { url: string }) => mockSwitchTab(opts),
  getCurrentPages: () => mockGetCurrentPages(),
  default: {
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    setStorageSync: (key: string, val: unknown) => {
      taroStorage[key] = val
    },
    removeStorageSync: (key: string) => {
      delete taroStorage[key]
    },
    reLaunch: (opts: { url: string }) => mockReLaunch(opts),
    switchTab: (opts: { url: string }) => mockSwitchTab(opts),
    getCurrentPages: () => mockGetCurrentPages(),
  },
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
  type UserInfo,
} from '../src/utils/auth'
import { ACCOUNT_SCOPED_CONTENT_KEYS, THEME_KEY } from '../src/constants/storage'

describe('miniapp-taro 认证工具函数', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
    clearAuth()
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
      expect(mockSwitchTab).toHaveBeenCalledWith({ url: '/pages/user/index' })
    })

    it('默认参数不跳转', () => {
      const result = checkLoginStatus()
      expect(result).toBe(false)
      expect(mockReLaunch).not.toHaveBeenCalled()
    })
  })

  /**
   * 登出必须让"属于某个账号的本地内容缓存"整体失效。
   * 立因:这些键不含 userId,而登出过去只清凭据 ⇒ 同一台手机上 A 退出、B 登录后,
   * AI 对话页与生图/成片历史里显示的是 A 的提问与生成结果(跨账号内容泄漏)。
   * 清单唯一源 = `constants/storage.ts` 的 `ACCOUNT_SCOPED_CONTENT_KEYS`,兑现点 =
   * `utils/auth.ts` 的 `onClearAll`。这一对曾被 9fdbc207ba2e("清理功能回退残留")连根删掉
   * 而无人察觉 —— 直到消费者 `pkg-ai/ai/chat.tsx` 断链被 tsc 抓到。所以两头都钉:
   * 清单在册(删了就红) ∧ 登出真清(只留清单不兑现也红)。
   */
  describe('登出清库(跨账号内容泄漏回归)', () => {
    it('ACCOUNT_SCOPED_CONTENT_KEYS 在册且不少于 5 条(清单被整删即红)', () => {
      expect(Array.isArray(ACCOUNT_SCOPED_CONTENT_KEYS)).toBe(true)
      expect(ACCOUNT_SCOPED_CONTENT_KEYS.length).toBeGreaterThanOrEqual(5)
    })

    it('clearAuth 之后账号作用域的每条内容缓存都不再留存', () => {
      for (const k of ACCOUNT_SCOPED_CONTENT_KEYS) taroStorage[k] = 'A 的旧内容'
      taroStorage[THEME_KEY] = 'dark' // 反向对照:非账号作用域的偏好不许被顺手清掉
      setToken('t')
      clearAuth()
      for (const k of ACCOUNT_SCOPED_CONTENT_KEYS)
        expect(taroStorage[k], `登出没清 ${String(k)} ⇒ 下一账号会看到上一账号的内容`).toBeUndefined()
      expect(taroStorage[THEME_KEY]).toBe('dark')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
