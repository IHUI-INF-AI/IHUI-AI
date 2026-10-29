// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * KeepaliveCenterPanel 测试(2026-10-26)。
 *
 * 钉住四条渲染路径 —— 这四条各自对应一种"界面骗人"的风险:
 *   ① 未启用:必须**原话透出缺哪个配置键**,不能空白也不能显示"全部健康";
 *   ② 请求失败:整块不渲染(宁可没有面板,也不给假阳性);
 *   ③ 全绿:只留一行汇总,不铺列表;
 *   ④ 有需处理账号:必须能点到"重试",且重试调用带上正确的 ref。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { KeepaliveCenterPanel } from '@/components/publish/KeepaliveCenterPanel'
import type { KeepaliveOverview } from '@ihui/api-client'

const { getKeepaliveOverviewMock, runKeepaliveMock } = vi.hoisted(() => ({
  getKeepaliveOverviewMock: vi.fn(),
  runKeepaliveMock: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    AlertTriangle: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
  }
})

vi.mock('@ihui/api-client', () => ({
  getKeepaliveOverview: () => getKeepaliveOverviewMock(),
  runKeepalive: (params: unknown) => runKeepaliveMock(params),
}))

function account(overrides: Record<string, unknown> = {}) {
  return {
    ref: 'publish_cookie:7',
    source: 'publish_cookie' as const,
    account_id: 7,
    platform: 'zhihu',
    display: '主号',
    health: 'critical' as const,
    consecutive_failures: 3,
    last_ok_at: null,
    last_fail_at: '2026-10-26T10:00:00+00:00',
    next_retry_at: null,
    expires_at: null,
    expiring_soon: false,
    last_error: 'Cookie 已过期',
    last_error_kind: 'expired',
    alerted_at: null,
    updated_at: '2026-10-26T10:00:00+00:00',
    ...overrides,
  }
}

function overview(overrides: Partial<KeepaliveOverview> = {}): KeepaliveOverview {
  return {
    generated_at: '2026-10-26T12:00:00+00:00',
    total: 0,
    counts: { healthy: 0, warning: 0, critical: 0, unknown: 0 },
    by_source: {},
    needs_attention: [],
    expiring_soon: [],
    success_rate_7d: {},
    config: {
      enabled: true,
      enabled_reason: 'KEEPALIVE_ENABLED=true',
      interval_hours: 6,
      alert_webhook_configured: false,
      event_retention_days: 90,
      policy: {
        retry_max: 3,
        retry_base_seconds: 300,
        retry_cap_seconds: 21600,
        alert_after_failures: 3,
        alert_repeat_hours: 24,
        expire_warn_days: 3,
      },
    },
    ...overrides,
  }
}

describe('KeepaliveCenterPanel', () => {
  beforeEach(() => {
    getKeepaliveOverviewMock.mockReset()
    runKeepaliveMock.mockReset()
    runKeepaliveMock.mockResolvedValue({ success: true, data: { triggered: true, ref: null } })
  })
  afterEach(() => cleanup())

  it('未启用时原话透出配置缺失原因,且不渲染健康度', async () => {
    getKeepaliveOverviewMock.mockResolvedValue({
      success: true,
      data: overview({
        total: 5,
        counts: { healthy: 5, warning: 0, critical: 0, unknown: 0 },
        config: {
          ...overview().config,
          enabled: false,
          enabled_reason: '未启用:未设置 KEEPALIVE_ENABLED',
        },
      }),
    })
    render(<KeepaliveCenterPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('keepalive-center-disabled')).toBeTruthy()
    })
    expect(screen.getByText('未启用:未设置 KEEPALIVE_ENABLED')).toBeTruthy()
    expect(screen.queryByTestId('keepalive-center')).toBeNull()
  })

  it('请求失败时整块不渲染(不给假阳性)', async () => {
    getKeepaliveOverviewMock.mockRejectedValue(new Error('network down'))
    const { container } = render(<KeepaliveCenterPanel />)
    await waitFor(() => expect(getKeepaliveOverviewMock).toHaveBeenCalled())
    expect(screen.queryByTestId('keepalive-center')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('全绿时只渲染汇总行,不铺需处理列表', async () => {
    getKeepaliveOverviewMock.mockResolvedValue({
      success: true,
      data: overview({
        total: 3,
        counts: { healthy: 3, warning: 0, critical: 0, unknown: 0 },
      }),
    })
    render(<KeepaliveCenterPanel />)
    await waitFor(() => expect(screen.getByTestId('keepalive-center')).toBeTruthy())
    expect(screen.getByText('allHealthy')).toBeTruthy()
    expect(screen.queryByText('needsAttention')).toBeNull()
    expect(screen.queryByText('expiringSoon')).toBeNull()
  })

  it('有需处理账号时透出失败原因,重试按 ref 触发', async () => {
    getKeepaliveOverviewMock.mockResolvedValue({
      success: true,
      data: overview({
        total: 1,
        counts: { healthy: 0, warning: 0, critical: 1, unknown: 0 },
        needs_attention: [account()],
      }),
    })
    render(<KeepaliveCenterPanel />)
    await waitFor(() => expect(screen.getByTestId('keepalive-center')).toBeTruthy())

    expect(screen.getByText('Cookie 已过期')).toBeTruthy()
    fireEvent.click(screen.getByText('retry'))

    await waitFor(() => {
      expect(runKeepaliveMock).toHaveBeenCalledWith({ ref: 'publish_cookie:7', force: true })
    })
  })

  it('顶部"立即保活"触发全量(不带 ref)', async () => {
    getKeepaliveOverviewMock.mockResolvedValue({ success: true, data: overview() })
    render(<KeepaliveCenterPanel />)
    await waitFor(() => expect(screen.getByTestId('keepalive-center')).toBeTruthy())
    fireEvent.click(screen.getByText('triggerNow'))
    await waitFor(() => {
      expect(runKeepaliveMock).toHaveBeenCalledWith({ ref: undefined, force: true })
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
