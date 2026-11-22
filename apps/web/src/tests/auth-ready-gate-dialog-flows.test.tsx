// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 登录弹窗/跳转副作用的三态门(2026-10-26)——auth-ready-gate 家族第三张。
//
// 覆盖三个"直接弹登录框/踢回首页"的判定面:
//  - app/(main)/oauth/authorize/PageClient.tsx:首帧 `!token` 即 open('login')+replace('/')
//  - app/(main)/chat/page.tsx:只等 mounted 不等 auth ready 就 open('login')
//  - src/components/layout/MobileLoginGate.tsx:移动壳直接按 isAuthenticated 开全屏登录墙
// 冷启动 bootstrap(httpOnly refresh cookie 静默续期)未落定时,以上都把"还没查完"当成
// "确认未登录"执行 —— 用户以为被踢出,实际凭据有效。修复口径:ready=false ⇒ 不弹、不跳、
// 不渲染登录引导;ready=true && 未登录 ⇒ 原有弹窗/引导一分不减(正向对照钉住)。
import * as React from 'react'
import { act, render, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  ready: false,
  isMobile: true,
  replace: vi.fn(),
  push: vi.fn(),
  params: { value: new URLSearchParams('') },
  fetchApi: vi.fn(),
  dialog: {
    isOpen: false,
    redirectUrl: null as string | null | undefined,
    open: vi.fn(),
    close: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, prefetch: vi.fn() }),
  useSearchParams: () => h.params.value,
  usePathname: () => '/chat',
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => ({ ready: h.ready, isAuthenticated: false, error: null }),
}))
vi.mock('@/hooks/use-media-query', () => ({ useIsMobile: () => h.isMobile }))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi, apiOrThrow: vi.fn() }))
vi.mock('@/stores/login-dialog', () => {
  const store: unknown = ((selector?: (s: typeof h.dialog) => unknown) =>
    selector ? selector(h.dialog) : h.dialog) as object
  Object.assign(store as Record<string, unknown>, { getState: () => h.dialog })
  return { useLoginDialogStore: store }
})
// /chat 已登录分支复用 home 首页(重型组件),与本判定无关 ⇒ 桩掉
vi.mock('../../app/(main)/home/page', () => ({ default: () => <div>工作台内容</div> }))

import AuthorizePage from '../../app/(main)/oauth/authorize/PageClient'
import ChatPage from '../../app/(main)/chat/page'
import { MobileLoginGate } from '@/components/layout/MobileLoginGate'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => {
  h.ready = false
  h.isMobile = true
  h.replace.mockReset()
  h.push.mockReset()
  h.fetchApi.mockReset()
  h.dialog.open.mockReset()
  h.dialog.close.mockReset()
  h.dialog.isOpen = false
  h.dialog.redirectUrl = null
  h.params.value = new URLSearchParams(
    'client_id=c1&redirect_uri=https%3A%2F%2Fapp.example%2Fcb&state=st',
  )
  useAuthStore.setState({ isAuthenticated: false, token: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/oauth/authorize 登录态三态', () => {
  it('ready=false 首帧 ⇒ 不弹登录框、不 replace 回首页(校验中保持 loading 占位)', async () => {
    h.ready = false
    render(<AuthorizePage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).not.toHaveBeenCalled()
    expect(h.replace).not.toHaveBeenCalled()
  })

  it('ready=true 且确无 token ⇒ 仍弹登录框并带回跳路径 + replace /(正向对照,判据未放宽)', async () => {
    h.ready = true
    render(<AuthorizePage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).toHaveBeenCalledWith('login', '/oauth/authorize')
    expect(h.replace).toHaveBeenCalledWith('/')
  })
})

describe('/chat 登录态三态', () => {
  it('ready=false ⇒ 不 open 登录框、不渲染「请登录」引导', async () => {
    h.ready = false
    render(<ChatPage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).not.toHaveBeenCalled()
    expect(screen.queryByText('loginRequiredTitle')).toBeNull()
  })

  it('ready=true 且未登录 ⇒ 自动弹登录框 + 显示引导(正向对照)', async () => {
    h.ready = true
    render(<ChatPage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).toHaveBeenCalledWith('login')
    expect(screen.getByText('loginRequiredTitle')).toBeTruthy()
  })

  it('ready=true 且已登录 ⇒ 不弹框,渲染工作台', async () => {
    h.ready = true
    useAuthStore.setState({ isAuthenticated: true, token: 't' })
    render(<ChatPage />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).not.toHaveBeenCalled()
    expect(screen.getByText('工作台内容')).toBeTruthy()
  })
})

describe('MobileLoginGate 登录态三态(移动壳)', () => {
  function mountNativeApp(ui: React.ReactElement) {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true })
    return render(ui)
  }

  it('ready=false ⇒ 不开全屏登录墙、children 也不挂载(校验中不是未登录)', async () => {
    h.ready = false
    mountNativeApp(
      <MobileLoginGate>
        <div>对话工作区</div>
      </MobileLoginGate>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).not.toHaveBeenCalled()
    expect(screen.queryByText('对话工作区')).toBeNull()
  })

  it('ready=true 且未登录 ⇒ 开全屏登录墙、children 不挂载(正向对照)', async () => {
    h.ready = true
    mountNativeApp(
      <MobileLoginGate>
        <div>对话工作区</div>
      </MobileLoginGate>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(h.dialog.open).toHaveBeenCalledWith('login', undefined)
    expect(screen.queryByText('对话工作区')).toBeNull()
  })

  it('ready=true 且已登录 ⇒ children 透出(判据没有把门焊死)', async () => {
    h.ready = true
    useAuthStore.setState({ isAuthenticated: true, token: 't' })
    mountNativeApp(
      <MobileLoginGate>
        <div>对话工作区</div>
      </MobileLoginGate>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('对话工作区')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
