// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 端「冷启动不得自动登回」用例(2026-09-27 任务 #29)。
 *
 * 判据本体在跨端共享层 `@ihui/shared/auth/auto-login-policy`(与 RN / 小程序同一份实现),
 * 本文件判的是 web 这一侧的**接线**:标记落在哪、由谁写、由谁清、静默恢复那两条路是否真被拦住。
 *
 * 三档成对(① 登出标记在 ⇒ 不登回 / ② 无标记 ⇒ 登回 / ③ 缺任一条件 ⇒ 不登回):
 * ② 与 ③ 都在这里,而不是只测 ① —— 只测"被拦住"无法区分"判据生效"与"判据永远拦住"。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  canSilentlyReLogin,
  shouldAttemptAutoLogin,
  SESSION_LOGGED_OUT_STORAGE_KEY,
} from '@ihui/shared/auth/auto-login-policy'
import {
  markSessionLoggedOut,
  clearSessionLoggedOutMarker,
  isSessionLoggedOut,
  __resetSessionLoggedOutMirrorForTest,
} from '../session-marker'
import { useAuthStore } from '@/stores/auth'

const USER = { id: 'u1', nickname: 'tester', avatar: '' } as const

beforeEach(() => {
  localStorage.clear()
  __resetSessionLoggedOutMirrorForTest()
  useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null })
})

describe('登出标记的落盘与读取', () => {
  it('标记落在共享层那一个 key 上(端内不得自立 key 名)', () => {
    markSessionLoggedOut()
    expect(localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)).not.toBeNull()
    clearSessionLoggedOutMarker()
    expect(localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)).toBeNull()
  })

  it('取的是盘不是进程内存:抹掉盘上标记 + 重置镜像 ⇒ 判"未登出"', () => {
    markSessionLoggedOut()
    expect(isSessionLoggedOut()).toBe(true)

    localStorage.removeItem(SESSION_LOGGED_OUT_STORAGE_KEY)
    __resetSessionLoggedOutMirrorForTest()

    expect(isSessionLoggedOut()).toBe(false)
  })

  it('读盘抛错时不抑制自动登录(存储抖动不得改变用户可见行为)', () => {
    // spy 打在实例上而不是原型上:happy-dom 的 Storage 把 getItem 定义在实例自身,
    // 打原型会得到 "The property getItem is not defined on the object" —— 那是工具失效,不是判据。
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('quota / private mode')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetSessionLoggedOutMirrorForTest()

    expect(isSessionLoggedOut()).toBe(false)
    expect(warn).toHaveBeenCalled()

    getItem.mockRestore()
    warn.mockRestore()
  })
})

describe('① 用户主动登出 ⇒ 冷启动不得静默登回', () => {
  it('logout() 先落标记:静默刷新路径被判为不登回', () => {
    useAuthStore.getState().setToken('T', 'R')
    useAuthStore.getState().setUser(USER)
    expect(canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })).toBe(true)

    useAuthStore.getState().logout()

    expect(isSessionLoggedOut()).toBe(true)
    // bootstrap 与 401 续期共用的那一条判据:此处必须为 false
    expect(canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })).toBe(false)
  })

  it('凭据被清(setToken(null))与 logout 同处置', () => {
    useAuthStore.getState().setToken('T', 'R')
    useAuthStore.getState().setToken(null)

    expect(isSessionLoggedOut()).toBe(true)
    expect(useAuthStore.getState().token).toBeNull()
    expect(canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })).toBe(false)
  })
})

describe('② 正当登录路径不被误伤', () => {
  it('登出后再手动登录(setToken 写入非空 token)清掉标记 ⇒ 允许登回', () => {
    useAuthStore.getState().logout()
    expect(isSessionLoggedOut()).toBe(true)

    useAuthStore.getState().setToken('T2', 'R2')

    expect(isSessionLoggedOut()).toBe(false)
    expect(localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)).toBeNull()
    expect(canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })).toBe(true)
  })

  it('setTokenWithPrefs(登录页勾了自动登录那条链)同样清除标记', () => {
    markSessionLoggedOut()
    useAuthStore.getState().setTokenWithPrefs('T3', 'R3', true)

    expect(isSessionLoggedOut()).toBe(false)
  })
})

describe('③ 缺任一条件即不登回(账密形状 = RN/web 共用投影)', () => {
  it('未登出但只有"自动登录"勾选、盘上无凭据 ⇒ 不登回', () => {
    expect(
      shouldAttemptAutoLogin({
        sessionLoggedOut: isSessionLoggedOut,
        hasAutoLoginFlag: () => true,
        hasRememberedCredentials: () => false,
      }),
    ).toBe(false)
  })

  it('未登出但有凭据、没勾自动登录 ⇒ 不登回', () => {
    expect(
      shouldAttemptAutoLogin({
        sessionLoggedOut: isSessionLoggedOut,
        hasAutoLoginFlag: () => false,
        hasRememberedCredentials: () => true,
      }),
    ).toBe(false)
  })

  it('两条件齐备且未登出 ⇒ 登回;登出标记压过一切勾选', () => {
    const both = {
      hasAutoLoginFlag: () => true,
      hasRememberedCredentials: () => true,
    }
    expect(shouldAttemptAutoLogin({ sessionLoggedOut: isSessionLoggedOut, ...both })).toBe(true)

    useAuthStore.getState().logout()

    expect(shouldAttemptAutoLogin({ sessionLoggedOut: isSessionLoggedOut, ...both })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
