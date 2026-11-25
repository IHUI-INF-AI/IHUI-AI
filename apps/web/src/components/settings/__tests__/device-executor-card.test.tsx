// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 本机执行器卡片（桌面端独占，G4）回归。
 *
 * 判据：
 *  1. 浏览器里必须**什么都不渲染**（网页端没有"本机进程"这回事）；
 *  2. 桌面端：未配对要给出可操作的下一步（不是一句"失败"）；
 *  3. 运行中点按钮 = 停止，且状态跟随后端返回（不靠本地猜）；
 *  4. 启动失败必须把原因显示出来，并复读真实状态。
 *
 * 翻译取"键名恒等"策略（同 devices-page.test.tsx）：断言比对键名，词包由键位契约测试兜底。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const { tMock } = vi.hoisted(() => ({ tMock: (key: string) => key }))
vi.mock('next-intl', () => ({ useTranslations: () => tMock }))

const exec = vi.hoisted(() => ({
  isDesktopHost: vi.fn(() => true),
  getDeviceExecutorStatus: vi.fn(),
  startDeviceExecutor: vi.fn(),
  stopDeviceExecutor: vi.fn(),
  getExecutorHostName: vi.fn(),
  adoptDeviceExecutor: vi.fn(),
}))
vi.mock('@/lib/device-executor', () => exec)

const api = vi.hoisted(() => ({
  issueSelfDeviceToken: vi.fn(),
  getBaseUrl: vi.fn(() => 'http://api.test'),
}))
vi.mock('@ihui/api-client', () => api)

vi.mock('@ihui/ui-react', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    'aria-label'?: string
    'data-testid'?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title }: { title?: string }) => <div data-testid="executor-error">{title}</div>,
}))

import { DeviceExecutorCard } from '../device-executor-card'

function status(patch: Partial<Record<string, unknown>> = {}) {
  return {
    supported: true,
    paired: true,
    deviceName: '公司电脑',
    running: false,
    pid: null,
    taskRegistered: false,
    ...patch,
  }
}

beforeEach(() => {
  exec.isDesktopHost.mockReturnValue(true)
  exec.getDeviceExecutorStatus.mockResolvedValue(status())
  exec.startDeviceExecutor.mockResolvedValue(status({ running: true, pid: 4321 }))
  exec.stopDeviceExecutor.mockResolvedValue(status())
  exec.getExecutorHostName.mockResolvedValue('DESKTOP-1')
  exec.adoptDeviceExecutor.mockResolvedValue(status({ paired: true }))
  api.issueSelfDeviceToken.mockResolvedValue({
    success: true,
    data: { device_id: 'd-1', device_token: 'tok-1', name: 'DESKTOP-1 · 桌面端' },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DeviceExecutorCard', () => {
  it('浏览器里什么都不渲染', () => {
    exec.isDesktopHost.mockReturnValue(false)
    const { container } = render(<DeviceExecutorCard />)
    expect(container.textContent).toBe('')
    expect(exec.getDeviceExecutorStatus).not.toHaveBeenCalled()
  })

  it('未配对:给的是「一键启用」而不是让用户去抄配对码', async () => {
    exec.getDeviceExecutorStatus.mockResolvedValue(status({ paired: false, deviceName: null }))
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByTestId('executor-state')).toBeTruthy())
    expect(screen.getByText('devices.executorUnpaired')).toBeTruthy()
    // G5:未配对时主按钮 = 一键启用(登录态即凭据),不给"启动"按钮 —— 那会立刻报未配对
    const enable = screen.getByTestId('executor-enable') as HTMLButtonElement
    expect(enable.disabled).toBe(false)
    expect(screen.queryByTestId('executor-toggle')).toBeNull()
  })

  it('一键启用:签发设备令牌 → 交给桌面端落盘 → 直接启动', async () => {
    exec.getDeviceExecutorStatus.mockResolvedValue(status({ paired: false, deviceName: null }))
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByTestId('executor-enable')).toBeTruthy())
    fireEvent.click(screen.getByTestId('executor-enable'))
    await waitFor(() =>
      expect(api.issueSelfDeviceToken).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'DESKTOP-1 · 桌面端' }),
      ),
    )
    expect(exec.adoptDeviceExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'd-1',
        deviceToken: 'tok-1',
        apiUrl: 'http://api.test',
      }),
    )
    // 落盘成功后立刻启动:用户点一次就到位
    await waitFor(() => expect(exec.startDeviceExecutor).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('devices.executorRunning')).toBeTruthy())
  })

  it('启用失败:显因并复读真实状态(不假装已配对)', async () => {
    exec.getDeviceExecutorStatus.mockResolvedValue(status({ paired: false, deviceName: null }))
    exec.adoptDeviceExecutor.mockRejectedValueOnce(new Error('已取消选择工作区'))
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByTestId('executor-enable')).toBeTruthy())
    fireEvent.click(screen.getByTestId('executor-enable'))
    await waitFor(() => expect(screen.getByTestId('executor-error')).toBeTruthy())
    expect(screen.getByTestId('executor-error').textContent).toContain('已取消选择工作区')
    await waitFor(() => expect(exec.getDeviceExecutorStatus).toHaveBeenCalledTimes(2))
  })

  it('运行中点按钮 = 停止,状态跟随后端返回', async () => {
    exec.getDeviceExecutorStatus.mockResolvedValue(status({ running: true, pid: 4321 }))
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByText('devices.executorRunning')).toBeTruthy())
    expect(screen.getByText('PID 4321')).toBeTruthy()

    exec.stopDeviceExecutor.mockResolvedValue(status({ running: false, pid: null }))
    fireEvent.click(screen.getByTestId('executor-toggle'))
    await waitFor(() => expect(exec.stopDeviceExecutor).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('devices.executorStopped')).toBeTruthy())
  })

  it('启动抛错:显示原因并复读真实状态', async () => {
    exec.startDeviceExecutor.mockRejectedValueOnce(new Error('没找到 ihui 命令'))
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByText('devices.executorStopped')).toBeTruthy())
    fireEvent.click(screen.getByTestId('executor-toggle'))
    await waitFor(() => expect(screen.getByTestId('executor-error')).toBeTruthy())
    expect(screen.getByTestId('executor-error').textContent).toContain('没找到 ihui 命令')
    // 失败后复读一次(状态不留在旧值,也不假装成功)
    await waitFor(() => expect(exec.getDeviceExecutorStatus).toHaveBeenCalledTimes(2))
  })

  it('不支持的平台:说明原因,开关禁用', async () => {
    exec.getDeviceExecutorStatus.mockResolvedValue(
      status({ supported: false, paired: false, deviceName: null }),
    )
    render(<DeviceExecutorCard />)
    await waitFor(() => expect(screen.getByText('devices.executorUnsupported')).toBeTruthy())
    expect((screen.getByTestId('executor-toggle') as HTMLButtonElement).disabled).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
