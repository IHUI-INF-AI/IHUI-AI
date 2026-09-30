// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CookieAutoRefreshChip 测试(2026-09-29)。
 * 钉住:开启态渲染状态行;关闭态/请求失败/请求中整行不渲染(不得假装开启);
 * last_run_at 为空时回落"首轮保活进行中"。组件只读 stats,不发任何写操作。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CookieAutoRefreshChip } from '@/components/publish/CookieAutoRefreshChip'
import type { CookieRefreshStats } from '@ihui/api-client'

const { getCookieRefreshStatsMock } = vi.hoisted(() => ({
  getCookieRefreshStatsMock: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { RefreshCw: Icon }
})

vi.mock('@ihui/api-client', () => ({
  getCookieRefreshStats: () => getCookieRefreshStatsMock(),
}))

function stats(overrides: Partial<CookieRefreshStats> = {}): CookieRefreshStats {
  return {
    total: 19,
    success: 18,
    failed: 1,
    skipped: 0,
    last_run_at: '2026-09-29T10:00:00+00:00',
    running: false,
    interval_hours: 6,
    auto_enabled: true,
    ...overrides,
  }
}

describe('CookieAutoRefreshChip', () => {
  beforeEach(() => {
    getCookieRefreshStatsMock.mockReset()
  })
  afterEach(() => cleanup())

  it('auto_enabled=true 时渲染状态行(on + lastRun)', async () => {
    getCookieRefreshStatsMock.mockResolvedValue({ success: true, data: stats() })
    const { container } = render(<CookieAutoRefreshChip />)
    await waitFor(() => {
      expect(screen.getByTestId('cookie-auto-refresh-chip')).toBeTruthy()
    })
    expect(screen.getByText('on')).toBeTruthy()
    expect(screen.getByText('lastRun')).toBeTruthy()
    expect(container.textContent).not.toContain('pending')
  })

  it('auto_enabled=false 时整行不渲染', async () => {
    getCookieRefreshStatsMock.mockResolvedValue({
      success: true,
      data: stats({ auto_enabled: false }),
    })
    const { container } = render(<CookieAutoRefreshChip />)
    await waitFor(() => expect(getCookieRefreshStatsMock).toHaveBeenCalled())
    expect(screen.queryByTestId('cookie-auto-refresh-chip')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('last_run_at 为空回落 pending(首轮保活进行中)', async () => {
    getCookieRefreshStatsMock.mockResolvedValue({
      success: true,
      data: stats({ last_run_at: null }),
    })
    render(<CookieAutoRefreshChip />)
    await waitFor(() => {
      expect(screen.getByText('pending')).toBeTruthy()
    })
    expect(screen.queryByText('lastRun')).toBeNull()
  })

  it('stats 请求失败时静默不渲染(不得白屏/抛错)', async () => {
    getCookieRefreshStatsMock.mockRejectedValue(new Error('network down'))
    const { container } = render(<CookieAutoRefreshChip />)
    await waitFor(() => expect(getCookieRefreshStatsMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
