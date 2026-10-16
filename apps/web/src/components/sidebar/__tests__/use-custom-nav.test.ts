// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCustomNav } from '../use-custom-nav'
import { ALL_NAV_HREFS } from '../nav-data'

/**
 * 「自定义」栏数据层回归(2026-10-16 立)
 *
 * 钉四件容易在后续迭代中被悄悄改坏的事:
 *  ① 按用户 id 隔离 —— 换账号不串号,各自读写各自的 key
 *  ② 载入时过滤失效项 —— 已删/改路由的 href 被剔除,不留死链
 *  ③ addHref 幂等 / removeHref 精确移除 / isCustom 与列表一致
 *  ④ 未登录不写 localStorage —— 不给游客残留任何自定义数据
 *
 * 只 mock auth store(把 userId 变成可操控变量),nav-data / localStorage 全用真的。
 */

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) => selector(authState),
}))

function login(id: string | null) {
  authState.user = id === null ? null : { id }
}

const STORAGE_PREFIX = 'sidebar-custom-nav-'

beforeEach(() => {
  window.localStorage.clear()
  login(null)
})

describe('useCustomNav', () => {
  it('未登录:列表为空、已水合、且不写 localStorage', () => {
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.userId).toBeNull()
    expect(result.current.hydrated).toBe(true)
    expect(result.current.customHrefs).toEqual([])
    expect(window.localStorage.length).toBe(0)
  })

  it('载入时过滤失效项:只保留仍是合法导航项的 href', () => {
    const valid = ALL_NAV_HREFS[0]
    window.localStorage.setItem(
      `${STORAGE_PREFIX}u1`,
      JSON.stringify([valid, '/route-deleted-last-week', '/also-gone']),
    )
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.customHrefs).toEqual([valid])
  })

  it('按用户 id 隔离:两个账号互不看到对方的收藏', () => {
    login('u1')
    const first = renderHook(() => useCustomNav())
    act(() => first.result.current.addHref('/models'))
    expect(first.result.current.customHrefs).toEqual(['/models'])
    first.unmount()

    login('u2')
    const second = renderHook(() => useCustomNav())
    expect(second.result.current.customHrefs).toEqual([])
    act(() => second.result.current.addHref('/agents'))
    expect(second.result.current.customHrefs).toEqual(['/agents'])
    second.unmount()

    // 回到 u1:自己的收藏仍在,没被 u2 污染
    login('u1')
    const third = renderHook(() => useCustomNav())
    expect(third.result.current.customHrefs).toEqual(['/models'])
    third.unmount()
  })

  it('addHref 幂等;removeHref 精确移除;isCustom 与列表一致', () => {
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))
    act(() => result.current.addHref('/models'))
    expect(result.current.customHrefs).toEqual(['/models'])

    act(() => result.current.addHref('/agents'))
    act(() => result.current.removeHref('/models'))
    expect(result.current.customHrefs).toEqual(['/agents'])
    expect(result.current.isCustom('/models')).toBe(false)
    expect(result.current.isCustom('/agents')).toBe(true)
  })

  it('挂载期间切换账号:重新载入对应用户的收藏(不串号)', () => {
    login('u1')
    const { result, rerender } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))

    login('u2')
    act(() => rerender())
    expect(result.current.customHrefs).toEqual([])

    act(() => result.current.addHref('/voices'))
    expect(result.current.customHrefs).toEqual(['/voices'])
  })

  it('localStorage 不可用时静默降级为内存态(不抛错)', () => {
    login('u1')
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))
    expect(result.current.customHrefs).toEqual(['/models'])
    spy.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
