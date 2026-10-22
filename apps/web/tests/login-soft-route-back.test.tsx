// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

/**
 * /login 软路由的「回前一页 vs 降级」契约(2026-10-22 立)。
 *
 * 立因:摘掉 /login→/sso/login 的 308 后,这条软路由才第一次真被访问到。实测(playwright
 * 直连本机 dev)新标签直链与站内点进 **window.history.length 都是 2**(about:blank 也占一格),
 * 所以旧判据 `history.length > 1` 在直链场景同样成立 → router.back() 把用户退回 about:blank
 * = 白屏,登录弹窗随页面卸载一起消失。直链必须走降级分支。
 *
 * mock 说明:QR 分支组件(QrTab/QrCodeLogin)与 QR_PLATFORMS 与本判据无关,但真实 import 会
 * 牵进整棵登录表单依赖树;导航/store 是被观察的副作用出口,必须 mock 才量得到"没调用"。
 */
const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  search: { value: '' },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mocks.back, replace: mocks.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.search.value),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: { getState: () => ({ open: mocks.open }) },
}))

vi.mock('@ihui/ui-react', () => ({ QrTab: () => null }))
vi.mock('@/components/login/QrCodeLogin', () => ({ QrCodeLogin: () => null }))
vi.mock('@/components/login/LoginFormContent', () => ({
  QR_PLATFORMS: [{ key: 'app' }, { key: 'wechat' }],
}))

import LoginPageClient from '../app/login/PageClient'

function setBrowserNavContext(historyLength: number, referrer: string) {
  Object.defineProperty(window.history, 'length', { configurable: true, value: historyLength })
  Object.defineProperty(document, 'referrer', { configurable: true, get: () => referrer })
}

describe('/login 软路由导航决策', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search.value = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('新标签直链(有 about:blank 占位、无 referrer):不回退,降级到首页且弹窗打开', async () => {
    setBrowserNavContext(2, '')

    render(<LoginPageClient />)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
    expect(mocks.back).not.toHaveBeenCalled()
    expect(mocks.replace.mock.calls[0][0]).toBe('/')
    expect(mocks.open).toHaveBeenCalledWith('login', undefined)
  })

  it('站内 SPA 点到 /login(history=3、referrer 空):必须回前一页,不许被踢回首页', async () => {
    // 2026-10-22 生产实测:document.referrer 在站内全程为空(n=20 直链与 n=20 站内都是 ''),
    // 而 history.length 两档完全可分(直链恒 2、站内恒 ≥3)。⇒ 判"有没有前一页"只能看长度,
    // 用 referrer 当条件会把"在 /topics 点登录"的用户也送回首页,丢掉他正在看的页面。
    setBrowserNavContext(3, '')

    render(<LoginPageClient />)

    await waitFor(() => expect(mocks.back).toHaveBeenCalled())
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.open).toHaveBeenCalledWith('login', undefined)
  })

  it('从外站整页点进来(history=2、referrer 非空):仍降级到本站,不把用户 back 回外站', async () => {
    setBrowserNavContext(2, 'https://example.com/referrer-page')

    render(<LoginPageClient />)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
    expect(mocks.back).not.toHaveBeenCalled()
    expect(mocks.open).toHaveBeenCalledWith('login', undefined)
  })

  it('直链带 ?redirect=/edu/courses:落点是该目标,不是 about:blank', async () => {
    setBrowserNavContext(2, '')
    mocks.search.value = 'redirect=%2Fedu%2Fcourses'

    render(<LoginPageClient />)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
    expect(mocks.back).not.toHaveBeenCalled()
    expect(mocks.replace.mock.calls[0][0]).toBe('/edu/courses')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
