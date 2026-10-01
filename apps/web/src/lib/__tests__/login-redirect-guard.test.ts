// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-413② —— 主站登录面 `?redirect=` 的两处裸用(2026-10-01 立)。
 *
 * 修复前:`app/login/PageClient.tsx` 是 `router.replace(redirect || '/')`,
 * `src/components/login/LoginDialog.tsx` 是 `router.push(redirectUrl)`,而这两个文件
 * `grep sso-redirect-guard` **零命中** —— 同一个客户端可整写的 `redirect` 参数在 /sso/* 四页
 * 已过唯一出口判据,在主站登录面却直接喂给 router。
 *
 * 刻意**不写**"已确证 Next App Router 的 push/replace 会把 `/\evil.com` 跳到外站" —— 那不是
 * 本文件能证明的事,上一轮也没实测过。这里钉的是可判的那件事:**判据不认的字符串一次都没出现
 * 在 router 的实参里**(参数级 spy),而判据认过的站内值仍逐字送达。这样无论 Next 内部如何归一
 * URL,这两条链的导航目标都由判据决定,不再由调用方决定。
 *
 * 正向对照同样重要:`/learn?x=1` 一类站内路径必须照跳,否则本票只是把登录回跳改坏了。
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const pushMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const backMock = vi.hoisted(() => vi.fn())
const queryRef = vi.hoisted(() => ({ current: '' }))
const captured = vi.hoisted(() => ({ onSuccess: null as null | (() => void) }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: vi.fn(async () => null) }))
vi.mock('@ihui/shared', () => ({
  buildSsoLoginUrl: () => 'https://aizhs.top/sso/login',
  SSO_CLIENT_IDS: { DESKTOP: 'desktop' },
  WEB_BASE: 'https://aizhs.top',
}))
vi.mock('@ihui/ui-react', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  return {
    QrTab: () => null,
    Button: () => null,
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
  }
})
vi.mock('@/components/auth/AuthShell', () => ({
  AuthShell: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@/components/login/QrCodeLogin', () => ({ QrCodeLogin: () => null }))
vi.mock('@/components/login/RegisterFormContent', () => ({ RegisterFormContent: () => null }))
vi.mock('@/components/login/ForgotPasswordForm', () => ({ ForgotPasswordForm: () => null }))
vi.mock('@/components/login/LoginWithTurnstile', () => ({
  LoginWithTurnstile: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
// onSuccess 是"登录成功"的唯一入口,这里把它接出来供用例触发 —— 不在测试里重写一份判据
vi.mock('@/components/login/LoginFormContent', () => ({
  QR_PLATFORMS: [{ key: 'wechat' }, { key: 'alipay' }],
  LoginFormContent: (props: { onSuccess?: () => void }) => {
    captured.onSuccess = props.onSuccess ?? null
    return null
  },
}))
vi.mock('@/lib/tauri-bridge', () => ({ openExternalUrl: vi.fn() }))
vi.mock('@/hooks/use-desktop', () => ({ useDesktop: () => ({ isDesktop: false }) }))
vi.mock('@/hooks/use-media-query', () => ({ useIsMobile: () => false }))

import LoginPageClient from '../../../app/login/PageClient'
import { LoginDialog } from '@/components/login/LoginDialog'
import { useLoginDialogStore } from '@/stores/login-dialog'

/** router 实际收到的每一个实参(push ∪ replace) */
function navigated(): string[] {
  return [...pushMock.mock.calls, ...replaceMock.mock.calls].flat().map(String)
}

const UNSAFE_TARGETS = [
  '/\\evil.com', // 第二字符反斜杠:WHATWG 借本站 base 解析成 https://evil.com(与已修的 /sso/* 同族)
  '//evil.com', // 协议相对
  'javascript:alert(1)', // 在本站源里执行
  'data:text/html;base64,PHNjcmlwdD4=',
  'https://evil.com/x', // 跨站绝对地址:主站登录面**没有**"回跳外站"的设计意图(与 /sso/* 不同)
]

const SAFE_TARGETS = ['/learn?x=1', '/dashboard', '/oauth/authorize']

let restoreRaf: (() => void) | null = null
let restoreHistoryLength: (() => void) | null = null

beforeEach(() => {
  pushMock.mockReset()
  replaceMock.mockReset()
  backMock.mockReset()
  captured.onSuccess = null
  queryRef.current = ''
  useLoginDialogStore.getState().close()

  // rAF 同步化:挂载期导航原在 requestAnimationFrame 里排队,同步执行才能在同一轮断言
  const originalRaf = window.requestAnimationFrame
  const originalCancel = window.cancelAnimationFrame
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0)
    return 1
  }) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame
  restoreRaf = () => {
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancel
  }

  // history.length === 1 ⇒ /login 走 replace 分支(直接输入 / 新标签页打开的形态)
  const originalLength = window.history.length
  Object.defineProperty(window.history, 'length', { configurable: true, value: 1 })
  restoreHistoryLength = () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: originalLength })
  }
})

afterEach(() => {
  cleanup()
  restoreRaf?.()
  restoreHistoryLength?.()
  restoreRaf = null
  restoreHistoryLength = null
  vi.useRealTimers()
})

describe('G-413② /login 的 redirect 落点(router.replace 实参)', () => {
  it.each(UNSAFE_TARGETS)(
    '`redirect=%s` ⇒ replace 收到站内 `/`,原值一次都没进 router',
    (target) => {
      queryRef.current = `redirect=${encodeURIComponent(target)}`
      render(createElement(LoginPageClient))
      expect(navigated()).toContain('/')
      expect(navigated()).not.toContain(target)
    },
  )

  it.each(SAFE_TARGETS)('正向对照:`redirect=%s` 仍逐字跳到该站内路径', (target) => {
    queryRef.current = `redirect=${encodeURIComponent(target)}`
    render(createElement(LoginPageClient))
    expect(navigated()).toContain(target)
  })

  it('有 history 时仍走 back(),本次收紧没有把"回前一页"改坏(正向对照)', () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 })
    queryRef.current = 'redirect=%2Flearn'
    render(createElement(LoginPageClient))
    expect(backMock).toHaveBeenCalledTimes(1)
    expect(navigated()).toHaveLength(0)
  })

  it('无 redirect 参数时 replace 的是 `/` 且不产生回落告警(正常流程不被当攻击)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    queryRef.current = ''
    render(createElement(LoginPageClient))
    expect(replaceMock).toHaveBeenCalledWith('/')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('拒绝不静默:守卫对原值留了一条 warn(与 /sso/* 的处置同形)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    queryRef.current = `redirect=${encodeURIComponent('/\\evil.com')}`
    render(createElement(LoginPageClient))
    expect(warnSpy.mock.calls.flat().map(String).join('|')).toContain('/\\evil.com')
    warnSpy.mockRestore()
  })
})

describe('G-413② 登录弹窗成功后的回跳落点(router.push 实参)', () => {
  /** 把弹窗开到指定 redirectUrl,触发真实 onSuccess 回调,再推进淡出余量那一档定时器 */
  function triggerLoginSuccess(target: string): void {
    vi.useFakeTimers()
    // 当前页刻意不是 '/',否则"回落到 '/'"会被既有的"等于当前页就不跳"语义吃掉,断言就量不到回落
    window.history.pushState(null, '', '/pricing')
    useLoginDialogStore.getState().open('login', target)
    render(createElement(LoginDialog))
    expect(captured.onSuccess).toBeTypeOf('function')
    captured.onSuccess?.()
    vi.advanceTimersByTime(300)
  }

  it.each(UNSAFE_TARGETS)(
    '`redirectUrl=%s` ⇒ push 收到站内 `/`,原值一次都没进 router',
    (target) => {
      triggerLoginSuccess(target)
      expect(navigated()).toContain('/')
      expect(navigated()).not.toContain(target)
    },
  )

  it.each(SAFE_TARGETS)('正向对照:`redirectUrl=%s` 仍逐字 push 到该站内路径', (target) => {
    triggerLoginSuccess(target)
    expect(navigated()).toContain(target)
  })

  it('目标等于当前页时不 push(既有"留在当前页"语义未变,正向对照)', () => {
    vi.useFakeTimers()
    const here = window.location.pathname + window.location.search
    useLoginDialogStore.getState().open('login', here)
    render(createElement(LoginDialog))
    captured.onSuccess?.()
    vi.advanceTimersByTime(300)
    expect(pushMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
