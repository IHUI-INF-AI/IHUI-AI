import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'

/**
 * LoginRedirectListener 懒触发策略契约测试。
 *
 * 锁定行为(2026-07-24 用户要求"刷新进项目不弹窗,刚打开项目不弹窗"):
 * - `?reauth=1&next=<公开路径>` → 不弹窗,清理 URL(回归根因:旧版 reauth 分支无 isPublicPath 检查)
 * - `?reauth=1&next=<受保护路径>` → 弹窗,清理 URL
 * - `login_redirect=<公开路径>` cookie → 不弹窗,清理 cookie
 * - `login_redirect=<受保护路径>` cookie → 弹窗,清理 cookie
 * - 无 reauth 无 cookie → 不弹窗
 *
 * 目的:固定两个分支(reauth + cookie)的懒触发契约,防止后续 agent 误改回"全路径弹窗"。
 * 历史教训:a0bc9e5c5 只修了 cookie 分支,reauth 分支"保持不变"导致刷新 `/?reauth=1&next=/` 仍弹窗。
 */

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  // 当前 URL 查询参数(每次测试前重置)
  search: { value: '' },
  // 当前 cookie 字符串(每次测试前重置)
  cookie: { value: '' },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(mocks.search.value),
}))

vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: Object.assign(() => mocks.open, {
    subscribe: vi.fn(() => () => {}),
  }),
}))

import { LoginRedirectListener } from '../LoginRedirectListener'

describe('LoginRedirectListener 懒触发策略', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search.value = ''
    mocks.cookie.value = ''
    // 重置 jsdom URL + cookie
    window.history.replaceState({}, '', '/')
    Object.defineProperty(window.document, 'cookie', {
      configurable: true,
      get: () => mocks.cookie.value,
      set: (v: string) => {
        // 简化 cookie set:max-age=0 → 删除 login_redirect;否则追加
        if (v.includes('max-age=0')) {
          mocks.cookie.value = mocks.cookie.value
            .split('; ')
            .filter((c) => !c.startsWith('login_redirect='))
            .join('; ')
        } else {
          mocks.cookie.value = (mocks.cookie.value ? mocks.cookie.value + '; ' : '') + v
        }
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('?reauth=1&next=/ (next 是公开路径 /) → 不弹窗 + URL 被清理', () => {
    mocks.search.value = 'reauth=1&next=' + encodeURIComponent('/')
    window.history.replaceState({}, '', '/?reauth=1&next=' + encodeURIComponent('/'))

    render(<LoginRedirectListener />)

    expect(mocks.open).not.toHaveBeenCalled()
    // URL 上的 reauth/next 应被 replaceState 清理
    expect(window.location.search).toBe('')
  })

  it('?reauth=1&next=/login (next 是公开路径 /login) → 不弹窗 + URL 被清理', () => {
    mocks.search.value = 'reauth=1&next=' + encodeURIComponent('/login')
    window.history.replaceState({}, '', '/?reauth=1&next=' + encodeURIComponent('/login'))

    render(<LoginRedirectListener />)

    expect(mocks.open).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('?reauth=1&next=/dashboard (next 是受保护路径) → 弹窗 + URL 被清理', () => {
    mocks.search.value = 'reauth=1&next=' + encodeURIComponent('/dashboard')
    window.history.replaceState({}, '', '/?reauth=1&next=' + encodeURIComponent('/dashboard'))

    render(<LoginRedirectListener />)

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', '/dashboard')
    expect(window.location.search).toBe('')
  })

  it('?reauth=1&next=/sso/redirect?redirect=x (next 是受保护 SSO 路径) → 弹窗', () => {
    const next = '/sso/redirect?redirect=' + encodeURIComponent('https://app.example.com')
    mocks.search.value = 'reauth=1&next=' + encodeURIComponent(next)
    window.history.replaceState({}, '', '/?reauth=1&next=' + encodeURIComponent(next))

    render(<LoginRedirectListener />)

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', next)
  })

  it('login_redirect=/ cookie (target 是公开路径 /) → 不弹窗 + cookie 被清理', () => {
    mocks.cookie.value = 'login_redirect=' + encodeURIComponent('/')

    render(<LoginRedirectListener />)

    expect(mocks.open).not.toHaveBeenCalled()
    // cookie 应被 max-age=0 清理
    expect(mocks.cookie.value).not.toContain('login_redirect=')
  })

  it('login_redirect=/dashboard cookie (target 是受保护路径) → 弹窗 + cookie 被清理', () => {
    mocks.cookie.value = 'login_redirect=' + encodeURIComponent('/dashboard')

    render(<LoginRedirectListener />)

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', '/dashboard')
    expect(mocks.cookie.value).not.toContain('login_redirect=')
  })

  it('无 reauth 无 cookie → 不弹窗', () => {
    render(<LoginRedirectListener />)
    expect(mocks.open).not.toHaveBeenCalled()
  })
})
