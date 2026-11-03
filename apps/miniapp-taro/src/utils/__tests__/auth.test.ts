// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权工具单元测试
 * 验证 token / userInfo / clearAuth / isLoggedIn 行为
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockSwitchTab, mockGetCurrentPages } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
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
  // 2026-10-23 登录页已删 ⇒ 去登录界面的手段从 reLaunch 换成 switchTab(宿主是 tabBar 页)
  switchTab: (opts: { url: string }) => mockSwitchTab(opts),
  getCurrentPages: () => mockGetCurrentPages(),
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
import { LOGIN_INTENT_TTL_MS, consumeLoginIntent, requestLogin } from '../../stores/login-intent'

describe('miniapp-taro auth 工具', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    mockSwitchTab.mockClear()
    clearAuth()
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
    expect(mockSwitchTab).not.toHaveBeenCalled()
  })

  it('checkLoginStatus 未登录 + redirect=true:切到登录宿主 tab,并留下一张待开弹窗的条子', () => {
    const ok = checkLoginStatus(true)
    expect(ok).toBe(false)
    expect(mockSwitchTab).toHaveBeenCalledWith({ url: '/pages/user/index' })
    // 光切过去不够 —— 条子必须在,否则「我的」页不会把弹窗打开,用户到了一个没登录入口的页面
    expect(consumeLoginIntent()).toBe(true)
  })

  it('已经在登录宿主那一页时不重复切 tab(切 tab 会重走 onLoad 白闪),但条子照留', () => {
    mockGetCurrentPages.mockReturnValue([{ route: 'pages/user/index' }])
    checkLoginStatus(true)
    expect(mockSwitchTab).not.toHaveBeenCalled()
    expect(consumeLoginIntent()).toBe(true)
  })

  it('条子有死亡机制:过期后 consume 返回 false,不会几分钟后凭空弹登录框', () => {
    requestLogin()
    expect(consumeLoginIntent(Date.now() + LOGIN_INTENT_TTL_MS + 1)).toBe(false)
    // 过期同时也把戳记清了 —— 再问一次仍是 false,不会"下一次突然算数"
    expect(consumeLoginIntent()).toBe(false)
  })

  it('checkLoginStatus 已登录不跳转', () => {
    setToken('tk-1')
    const ok = checkLoginStatus(true)
    expect(ok).toBe(true)
    expect(mockSwitchTab).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
