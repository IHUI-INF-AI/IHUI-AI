// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 设备管理页(G1 跨设备互联 · 用户面)核心逻辑回归(2026-10-30 立)。
 *
 * 覆盖:
 *   1. 设备列表渲染(名称/在线徽标/撤销按钮在册)
 *   2. 配对码生成流程(mock issuePairCode:成功出码 + 429 限速提示)
 *   3. 撤销确认(confirmDialog 确认 → revokeDevice + 重拉列表;取消 → 不发请求)
 *   4. 会话委派(选择会话+设备 → delegateSession 入参正确,成功提示)
 *   5. 任务列表(选设备 → getDeviceTasks,状态徽标渲染)
 *
 * 翻译 mock 取「键名恒等」策略(与 settings/notifications auth-gate 测试同型):
 * 断言直接比对 i18n 键名,词包本身由 dev-docs-i18n-keys 等键位契约测试兜底。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// t 函数必须跨渲染稳定:页面把 t 放进 useCallback/useEffect 依赖,
// 每次渲染新建函数会触发「effect→setState→重渲染」死循环。
const { tMock } = vi.hoisted(() => ({ tMock: (key: string) => key }))
vi.mock('next-intl', () => ({
  useTranslations: () => tMock,
}))

const api = vi.hoisted(() => ({
  listDevices: vi.fn(),
  revokeDevice: vi.fn(),
  issuePairCode: vi.fn(),
  delegateSession: vi.fn(),
  getDeviceTasks: vi.fn(),
  fetchApi: vi.fn(),
}))
vi.mock('@ihui/api-client', () => api)

vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ ready: true, allow: true }),
}))

const confirmDialog = vi.hoisted(() => vi.fn())
vi.mock('@/components/feedback', () => ({
  Alert: ({ title }: { title?: string }) => <div data-testid="alert">{title}</div>,
  confirmDialog,
}))

vi.mock('@/components/common', () => ({
  BackButton: () => <div />,
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))

// UI 基元替身:保持 DOM 形状足够断言,避免 Radix portal 进测试环境
vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    'data-testid'?: string
  }) => (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children, 'data-testid': testId }: { children?: React.ReactNode; 'data-testid'?: string }) => (
    <tr data-testid={testId}>{children}</tr>
  ),
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}))

vi.mock('lucide-react', () => ({
  Loader2: () => <svg />,
  Monitor: () => <svg />,
  RefreshCw: () => <svg />,
  ShieldCheck: () => <svg />,
}))

import DevicesPage from '../page'

const DEVICE_ONLINE = {
  id: 'dev-1',
  userId: 'u-1',
  name: '工作台式机',
  os: 'Windows 11',
  capabilities: { roles: ['desktop', 'cli'] },
  lastSeenAt: new Date(Date.now() - 5_000).toISOString(),
  createdAt: '2026-10-01T00:00:00.000Z',
  revokedAt: null,
  online: true,
}
const DEVICE_OFFLINE = {
  id: 'dev-2',
  userId: 'u-1',
  name: '客厅迷你主机',
  os: null,
  capabilities: null,
  lastSeenAt: new Date(Date.now() - 3_600_000).toISOString(),
  createdAt: '2026-10-02T00:00:00.000Z',
  revokedAt: null,
  online: false,
}

function ok<T>(data: T) {
  return { success: true as const, data, status: 200 }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listDevices.mockResolvedValue(ok([DEVICE_ONLINE, DEVICE_OFFLINE]))
  api.fetchApi.mockResolvedValue(
    ok({ conversations: [{ id: 'conv-1', title: '重构方案讨论' }], total: 1, page: 1, pageSize: 20 }),
  )
  api.revokeDevice.mockResolvedValue(ok({ id: 'dev-1', revoked: true }))
  api.issuePairCode.mockResolvedValue({
    success: true,
    data: { code: '246810', expires_at: new Date(Date.now() + 5 * 60_000).toISOString() },
    status: 200,
  })
  api.delegateSession.mockResolvedValue(ok({ task_id: 'task-9', status: 'queued' }))
  api.getDeviceTasks.mockResolvedValue(ok([]))
  confirmDialog.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
})

describe('设备管理页', () => {
  it('设备列表渲染:名称、在线/离线徽标与撤销按钮在册', async () => {
    render(<DevicesPage />)
    await waitFor(() => expect(api.listDevices).toHaveBeenCalled())

    // 设备名在表格与两处下拉中重复出现,按行 testid 断言(避免 findByText 多命中)
    const row1 = await screen.findByTestId('device-row-dev-1')
    expect(row1.textContent).toContain('工作台式机')
    const row2 = screen.getByTestId('device-row-dev-2')
    expect(row2.textContent).toContain('客厅迷你主机')
    expect(screen.getAllByText('devices.online').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('devices.offline').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('revoke-device-dev-1')).toBeTruthy()
    expect(screen.getByTestId('revoke-device-dev-2')).toBeTruthy()
    // 能力摘要:roles 数组优先
    expect(screen.getByText('desktop, cli')).toBeTruthy()
  })

  it('配对码生成:点击出码并显示倒计时;429 时显示限速提示', async () => {
    render(<DevicesPage />)

    fireEvent.click(await screen.findByTestId('pair-code-generate'))
    await waitFor(() => expect(api.issuePairCode).toHaveBeenCalled())

    expect((await screen.findByTestId('pair-code-display')).textContent).toContain('246810')
    expect(screen.getByTestId('pair-code-countdown').textContent).toBe('devices.pairExpiresIn')

    // 重新生成撞到限速(429)
    api.issuePairCode.mockResolvedValue({ success: false, error: 'too many', status: 429 })
    fireEvent.click(screen.getByTestId('pair-code-regenerate'))
    await waitFor(() => expect(api.issuePairCode).toHaveBeenCalledTimes(2))
    const alerts = await screen.findAllByTestId('alert')
    expect(alerts.some((a) => a.textContent === 'devices.pairRateLimited')).toBe(true)
  })

  it('撤销设备:confirmDialog 确认后调 revokeDevice 并重拉列表;取消则不发请求', async () => {
    render(<DevicesPage />)
    await screen.findByTestId('device-row-dev-1')
    expect(api.listDevices).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('revoke-device-dev-1'))
    await waitFor(() => expect(confirmDialog).toHaveBeenCalled())
    await waitFor(() => expect(api.revokeDevice).toHaveBeenCalledWith('dev-1'))
    await waitFor(() => expect(api.listDevices).toHaveBeenCalledTimes(2))

    // 取消路径:confirmDialog 返回 false ⇒ 不调撤销接口
    confirmDialog.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByTestId('revoke-device-dev-2'))
    await waitFor(() => expect(confirmDialog).toHaveBeenCalledTimes(2))
    expect(api.revokeDevice).toHaveBeenCalledTimes(1)
  })

  it('会话委派:选择会话与设备后 delegateSession 入参正确并显示成功提示', async () => {
    render(<DevicesPage />)
    // 等会话列表异步落进 select(选项存在才能 change 到 conv-1)
    await screen.findByText('重构方案讨论')
    const sessionSelect = screen.getByTestId('delegate-session-select')
    const deviceSelect = screen.getByTestId('delegate-device-select')

    fireEvent.change(sessionSelect, { target: { value: 'conv-1' } })
    fireEvent.change(deviceSelect, { target: { value: 'dev-1' } })
    fireEvent.click(screen.getByTestId('delegate-submit'))

    await waitFor(() =>
      expect(api.delegateSession).toHaveBeenCalledWith('conv-1', 'dev-1'),
    )
    const alerts = await screen.findAllByTestId('alert')
    expect(alerts.some((a) => a.textContent === 'devices.delegateSuccess')).toBe(true)
  })

  it('委派遇 503(功能开关关闭)显示未开放提示', async () => {
    api.delegateSession.mockResolvedValue({
      success: false,
      error: '跨设备委托未启用',
      status: 503,
      errorCode: 'DEVICE_DELEGATION_DISABLED',
    })
    render(<DevicesPage />)
    await screen.findByText('重构方案讨论')
    const sessionSelect = screen.getByTestId('delegate-session-select')
    fireEvent.change(sessionSelect, { target: { value: 'conv-1' } })
    fireEvent.change(screen.getByTestId('delegate-device-select'), { target: { value: 'dev-1' } })
    fireEvent.click(screen.getByTestId('delegate-submit'))

    const alerts = await screen.findAllByTestId('alert')
    expect(alerts.some((a) => a.textContent === 'devices.delegateDisabled')).toBe(true)
  })

  it('任务列表:选择设备触发 getDeviceTasks 并渲染状态徽标', async () => {
    api.getDeviceTasks.mockResolvedValue(
      ok([
        {
          id: 'task-1',
          sessionId: 'conv-1',
          targetDeviceId: 'dev-1',
          status: 'running',
          claimedAt: null,
          finishedAt: null,
          error: null,
          resultSummary: null,
          createdAt: new Date(Date.now() - 120_000).toISOString(),
          createdBy: 'u-1',
        },
      ]),
    )
    render(<DevicesPage />)
    await screen.findByTestId('device-row-dev-1')

    fireEvent.change(screen.getByTestId('tasks-device-select'), { target: { value: 'dev-1' } })
    await waitFor(() => expect(api.getDeviceTasks).toHaveBeenCalledWith('dev-1'))

    expect(await screen.findByTestId('task-row-task-1')).toBeTruthy()
    expect(screen.getByText('devices.taskStatus_running')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
