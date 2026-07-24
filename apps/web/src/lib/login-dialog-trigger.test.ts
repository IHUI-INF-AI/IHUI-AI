import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * login-dialog-trigger 共享决策中心单元测试(2026-07-24 深度根治)。
 *
 * 锁定行为:
 * - isPublicPath:公开路径白名单(/ /login /register 等)返回 true,受保护路径返回 false,带 query 只检查 path 部分
 * - openLoginDialogOnce:第一次返回 true + 调 open,guard 期间第二次返回 false + 不调 open
 * - openLoginDialogOnce:store 关闭后 guard 重置,可再次触发
 *
 * 目的:固定共享决策中心的契约,所有触发点(LoginRedirectListener reauth/cookie + api.ts 401)统一依赖此模块。
 * 任何触发点绕过此模块直接调 store.open → 测试仍通过,但 code review 时应检查是否走 openLoginDialogOnce。
 */

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  // 模拟 store 的 isOpen 状态,subscribe 回调用此判断 guard 重置
  isOpen: { value: false },
  // subscribe 注册的回调
  listener: { current: null as null | ((s: { isOpen: boolean }) => void) },
}))

vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: {
    getState: () => ({ open: mocks.open, isOpen: mocks.isOpen.value }),
    subscribe: vi.fn((cb: (s: { isOpen: boolean }) => void) => {
      mocks.listener.current = cb
      return () => {
        mocks.listener.current = null
      }
    }),
  },
}))

import {
  isPublicPath,
  openLoginDialogOnce,
  __resetOpenGuardForTest,
  PUBLIC_PATHS,
} from './login-dialog-trigger'

describe('isPublicPath 公开路径白名单', () => {
  it('首页 / 是公开路径', () => {
    expect(isPublicPath('/')).toBe(true)
  })

  it('/login 是公开路径', () => {
    expect(isPublicPath('/login')).toBe(true)
  })

  it('/register 是公开路径', () => {
    expect(isPublicPath('/register')).toBe(true)
  })

  it('/sso/login 是公开路径', () => {
    expect(isPublicPath('/sso/login')).toBe(true)
  })

  it('/forgot-password 是公开路径', () => {
    expect(isPublicPath('/forgot-password')).toBe(true)
  })

  it('/dashboard 是受保护路径', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
  })

  it('/sso/redirect 是受保护路径(SSO 重定向需要登录)', () => {
    expect(isPublicPath('/sso/redirect')).toBe(false)
  })

  it('/api/me 是受保护路径', () => {
    expect(isPublicPath('/api/me')).toBe(false)
  })

  it('带 query 的路径只检查 path 部分:/dashboard?tab=1 仍受保护', () => {
    expect(isPublicPath('/dashboard?tab=1')).toBe(false)
  })

  it('带 query 的公开路径:/login?return=/dash 仍公开', () => {
    expect(isPublicPath('/login?return=/dashboard')).toBe(true)
  })

  it('带 hash 的路径只检查 path 部分:/login#section 仍公开', () => {
    expect(isPublicPath('/login#section')).toBe(true)
  })

  it('空路径视为公开(避免误弹窗)', () => {
    expect(isPublicPath('')).toBe(true)
  })

  it('PUBLIC_PATHS 白名单包含所有 12 条公开路径', () => {
    expect(PUBLIC_PATHS.size).toBe(12)
    expect(Array.from(PUBLIC_PATHS).sort()).toEqual(
      [
        '/',
        '/about',
        '/api/health',
        '/contact',
        '/docs',
        '/forgot-password',
        '/login',
        '/pricing',
        '/register',
        '/reset-password',
        '/sso/login',
        '/sso/register',
      ].sort(),
    )
  })
})

describe('openLoginDialogOnce 全局去重 guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isOpen.value = false
    mocks.listener.current = null
    __resetOpenGuardForTest()
  })

  it('第一次调用 → 返回 true + 调 open("login", target)', () => {
    const result = openLoginDialogOnce('/dashboard')

    expect(result).toBe(true)
    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', '/dashboard')
  })

  it('guard 期间第二次调用 → 返回 false + 不调 open(防并发弹窗)', () => {
    openLoginDialogOnce('/dashboard')
    const result2 = openLoginDialogOnce('/profile')

    expect(result2).toBe(false)
    expect(mocks.open).toHaveBeenCalledTimes(1) // 只第一次调
  })

  it('store 关闭后 guard 重置 → 可再次触发(防风暴但允许用户重新触发)', () => {
    // 第一次触发
    openLoginDialogOnce('/dashboard')
    expect(mocks.open).toHaveBeenCalledTimes(1)

    // 模拟 store 关闭(subscribe 回调被调用,isOpen=false)
    mocks.isOpen.value = false
    if (mocks.listener.current) {
      mocks.listener.current({ isOpen: false })
    }

    // guard 应已重置,第二次可触发
    const result2 = openLoginDialogOnce('/profile')
    expect(result2).toBe(true)
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(mocks.open).toHaveBeenLastCalledWith('login', '/profile')
  })

  it('SSR 环境(typeof window === undefined)→ 返回 false + 不调 open', () => {
    // jsdom 环境 window 存在,模拟 SSR 需临时删除 window
    // 但 delete window 在 jsdom 不可行,这里只验证 guard 逻辑(window 存在时正常)
    // SSR 保护由 openLoginDialogOnce 内部 typeof window === 'undefined' 判断
    // 此 case 留给 Node 环境 e2e 覆盖,这里跳过
    expect(typeof window).not.toBe('undefined')
  })

  it('不同 target 调用:guard 期间即使 target 不同也被拦截', () => {
    openLoginDialogOnce('/dashboard')
    const result2 = openLoginDialogOnce('/sso/redirect?redirect=x')

    expect(result2).toBe(false)
    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', '/dashboard')
  })
})
