// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * 「企业应用凭据」页面渲染与无权限态(2026-11-24 立)。
 *
 * 钉三件界面事实:
 *  ① 列表渲染:5 个平台卡片全部出现,4 条 source=tenant 标「本租户独立应用」;
 *  ② 未配置平台展示:wechat_mp(source=none)渲染为「未配置」,不冒充已配置;
 *  ③ 无权限处理:后端 403 / 404 时页面给出明确文案,而不是裸错误或空列表冒充现状。
 *
 * 本档只测页面这一层;入口卡片是否出现由 tenant-apps-visibility.test.ts 的谓词与
 * hook 用例钉住,后端守卫语义不在此重复。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const fetchApiMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/components/feedback', () => ({
  Alert: ({ description }: { description?: React.ReactNode }) => (
    <div role="alert">{description}</div>
  ),
  confirmDialog: vi.fn(async () => false),
}))

import TenantAppsPage from '../app/(main)/settings/tenant-apps/page'

const TENANT_APPS = [
  {
    platform: 'feishu',
    configured: true,
    enabled: true,
    appId: 'cli_a9de15cbb8399bc8',
    appSecretMasked: '••••••',
    extra: {},
    source: 'tenant' as const,
  },
  {
    platform: 'dingtalk',
    configured: true,
    enabled: true,
    appId: 'dingojemqcxfzr2f5xzd',
    appSecretMasked: '••••••',
    extra: {},
    source: 'tenant' as const,
  },
  {
    platform: 'wecom',
    configured: true,
    enabled: true,
    appId: 'ww6b2e8c6e8e3a6812',
    appSecretMasked: '••••••',
    extra: {},
    source: 'tenant' as const,
  },
  {
    platform: 'wechat',
    configured: true,
    enabled: true,
    appId: 'wx3c37d94ee8f70148',
    appSecretMasked: '••••••',
    extra: {},
    source: 'tenant' as const,
  },
  {
    platform: 'wechat_mp',
    configured: false,
    enabled: false,
    appId: '',
    appSecretMasked: '',
    extra: {},
    source: 'none' as const,
  },
]

function renderPage() {
  return render(<TenantAppsPage />)
}

beforeEach(() => {
  cleanup()
  fetchApiMock.mockReset()
})

describe('企业应用凭据 — 列表渲染', () => {
  it('渲染全部 5 个平台卡片,4 条本租户独立应用', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { tenantId: '2306401f-4b6d-4436-8f5c-aa36d25da676', apps: TENANT_APPS },
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('飞书')).toBeTruthy())
    expect(screen.getByText('钉钉')).toBeTruthy()
    expect(screen.getByText('企业微信')).toBeTruthy()
    expect(screen.getByText('微信开放平台')).toBeTruthy()
    expect(screen.getByText('微信公众号')).toBeTruthy()

    // 4 条 source=tenant
    expect(screen.getAllByText('本租户独立应用')).toHaveLength(4)
  })

  it('未配置平台(wechat_mp)展示「未配置」,不冒充已启用', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: { tenantId: '2306401f-4b6d-4436-8f5c-aa36d25da676', apps: TENANT_APPS },
    })

    renderPage()
    await waitFor(() => expect(screen.getByText('微信公众号')).toBeTruthy())

    // 未配置卡片底部状态文案;已配置的四条不得出现「未配置」状态
    const unconfigured = screen.getAllByText('未配置')
    expect(unconfigured.length).toBeGreaterThanOrEqual(1)
    // 已配置平台标「已启用」
    expect(screen.getAllByText('已启用')).toHaveLength(4)
  })
})

describe('企业应用凭据 — 无权限失败态', () => {
  it('403 → 明确提示需要租户管理员权限', async () => {
    fetchApiMock.mockResolvedValue({
      success: false,
      status: 403,
      error: '需要租户管理员权限',
    })

    renderPage()
    await waitFor(() =>
      expect(screen.getByText('需要租户管理员权限才能管理企业应用凭据')).toBeTruthy(),
    )
  })

  it('404 → 明确提示租户不存在或无权访问', async () => {
    fetchApiMock.mockResolvedValue({
      success: false,
      status: 404,
      error: '租户不存在',
    })

    renderPage()
    await waitFor(() =>
      expect(screen.getByText('当前租户不存在，或你无权访问该租户的应用凭据')).toBeTruthy(),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
