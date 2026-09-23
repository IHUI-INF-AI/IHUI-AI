// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CookieHealthIndicator 的请求预算测试(2026-09-23 IP 封禁事故回归)。
 *
 * 该组件原先"挂载即拉一次 cookie-health",而账号页每张卡片挂两份
 * (variant='button' 的刷新钮 + variant='badge' 的徽章),19 个账号即 38 次/屏。
 * 三条不得请求的路径都在这里钉住:
 * - managed(页面批量供数)—— 含**批量尚未返回的首帧**,这是最容易漏的一种:
 *   若此时回退成自己拉一次,19 张卡片照样各发一发,扇出只是被延后而非消除;
 * - variant='button' 不渲染徽章,健康度数据无处可用;
 * - 非托管但已有 health。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import {
  CookieHealthIndicator,
  type CookieHealthIndicatorProps,
} from '@/components/publish/CookieHealthIndicator'
import type { CookieHealthInfo } from '@ihui/api-client'

const { getCookieHealthMock, refreshCookieMock } = vi.hoisted(() => ({
  getCookieHealthMock: vi.fn(),
  refreshCookieMock: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { RefreshCw: Icon, Loader2: Icon }
})

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@ihui/api-client', () => ({
  getCookieHealth: (accountId: number) => getCookieHealthMock(accountId),
  refreshAccountCookie: (accountId: number) => refreshCookieMock(accountId),
}))

function health(overrides: Partial<CookieHealthInfo> = {}): CookieHealthInfo {
  return {
    account_id: 7,
    platform: 'juejin',
    level: 'expiring',
    days_since_verified: 9,
    last_verified_at: '2026-09-14T12:00:00+00:00',
    predicted_expiry: '2026-09-28T12:00:00+00:00',
    last_verify_msg: 'ok',
    status: 'active',
    ...overrides,
  }
}

function renderWith(props: Partial<CookieHealthIndicatorProps> = {}) {
  return render(<CookieHealthIndicator accountId={7} compact={false} {...props} />)
}

const ANY_LEVEL_TEXT = /cookieHealth\.(healthy|expiring|expired)/

beforeEach(() => {
  getCookieHealthMock.mockReset().mockResolvedValue({ success: true, data: health() })
  refreshCookieMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('CookieHealthIndicator 请求预算', () => {
  it('managed + 已有批量数据:渲染该档位,零请求', () => {
    renderWith({ variant: 'badge', managed: true, health: health({ level: 'expiring' }) })
    expect(getCookieHealthMock).not.toHaveBeenCalled()
    expect(screen.getByText('cookieHealth.expiring')).toBeTruthy()
  })

  it('managed + 批量尚未返回的首帧:零请求,且不渲染徽章(不得回退成逐账号自拉)', async () => {
    const { container } = renderWith({ variant: 'badge', managed: true, health: undefined })
    await waitFor(() => expect(container).toBeTruthy())
    expect(getCookieHealthMock).not.toHaveBeenCalled()
    expect(screen.queryByText(ANY_LEVEL_TEXT)).toBeNull()
  })

  it('managed 首帧不渲染徽章,是为了避免先闪一帧红色"已过期"', () => {
    renderWith({ variant: 'badge', managed: true, health: null, initialLevel: 'healthy' })
    expect(screen.queryByText(ANY_LEVEL_TEXT)).toBeNull()
  })

  it('variant=button:不渲染徽章,因此完全不请求健康度', () => {
    renderWith({ variant: 'button' })
    expect(getCookieHealthMock).not.toHaveBeenCalled()
    expect(screen.queryByText(ANY_LEVEL_TEXT)).toBeNull()
  })

  it('非托管但已供数:不请求', () => {
    renderWith({ variant: 'badge', health: health({ level: 'healthy' }) })
    expect(getCookieHealthMock).not.toHaveBeenCalled()
    expect(screen.getByText('cookieHealth.healthy')).toBeTruthy()
  })

  it('非托管且无供数(组件被独立使用)时才自己拉一次', async () => {
    getCookieHealthMock.mockResolvedValue({ success: true, data: health({ level: 'healthy' }) })
    renderWith({ variant: 'badge' })
    await waitFor(() => expect(getCookieHealthMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('cookieHealth.healthy')).toBeTruthy())
  })

  it('非托管时 initialLevel 作为首帧兜底,不闪红', () => {
    getCookieHealthMock.mockReturnValue(new Promise(() => {})) // 永挂起,只看首帧
    renderWith({ variant: 'badge', initialLevel: 'healthy' })
    expect(screen.getByText('cookieHealth.healthy')).toBeTruthy()
  })

  it('managed 下刷新成功后不逐账号补拉,交给页面 reload()', async () => {
    refreshCookieMock.mockResolvedValue({
      success: true,
      data: { account_id: 7, platform: 'juejin', success: true, message: '' },
    })
    const onRefreshed = vi.fn()
    renderWith({
      variant: 'badge+button',
      managed: true,
      health: health({ level: 'expiring' }),
      onRefreshed,
    })
    fireEvent.click(screen.getByLabelText('cookieHealth.refresh'))
    await waitFor(() => expect(refreshCookieMock).toHaveBeenCalledWith(7))
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(1))
    expect(getCookieHealthMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
