// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 一键重置页核心交互测试(mock @/lib/tauri-bridge):
 * 1. 非桌面端提示 + 不触发探针;
 * 2. 桌面端自动探针:root/可回收体量/条目分档渲染;
 * 3. 维护清理:killRunning 默认 true 传参 + 结果层渲染;
 * 4. 登出重置:勾选 device-id 后传参 includeDeviceId=true;
 * 5. 出厂重置:两次确认才执行;
 * 6. 边界披露文案常驻。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import WorkbuddyResetPage from '../page'
import {
  workbuddyResetProbe,
  workbuddyResetMaintenance,
  workbuddyResetLogout,
  workbuddyResetFactory,
} from '@/lib/tauri-bridge'
import { useTauriIpcReady } from '@/hooks/use-desktop'

const { probeReport } = vi.hoisted(() => ({
  probeReport: {
    root: 'C:/Users/Administrator/.workbuddy',
    workbuddy_running: true,
    total_mb: 19456.0,
    reclaimable_mb: 12690.0,
    entries: [
      { path: 'logs', tier: 'maintenance', size_mb: 8089.4 },
      { path: 'app/session', tier: 'webview_logout', size_mb: 120.5 },
      { path: 'device-id', tier: 'device_identity', size_mb: 0.001 },
      { path: 'workspace', tier: 'user_asset', size_mb: 2969.6 },
      { path: 'MEMORY.md', tier: 'user_asset', size_mb: 0.05 },
    ],
  },
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string) =>
      key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    Eraser: Icon,
    Factory: Icon,
    Loader2: Icon,
    LogOut: Icon,
    RefreshCw: Icon,
    ShieldAlert: Icon,
    TriangleAlert: Icon,
  }
})

vi.mock('@/hooks/use-desktop', () => ({
  useTauriIpcReady: vi.fn(() => false),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  workbuddyResetProbe: vi.fn(async () => JSON.parse(JSON.stringify(probeReport))),
  workbuddyResetMaintenance: vi.fn(async () => ({
    layers: [
      { layer: 0, name: 'kill_workbuddy_processes', ok: true, detail: '已强杀 5 个 WorkBuddy 进程' },
      { layer: 1, name: 'maintenance_clean', ok: true, detail: '已清理 9 项' },
    ],
  })),
  workbuddyResetLogout: vi.fn(async () => ({
    layers: [{ layer: 2, name: 'logout_reset', ok: true, detail: '已清除 1 项' }],
  })),
  workbuddyResetFactory: vi.fn(async () => ({
    layers: [{ layer: 3, name: 'factory_reset', ok: true, detail: '已搬移 36 项; 隔离区=D:/q' }],
  })),
}))

vi.mock('@ihui/ui-react', () => {
  const Passthrough = (tag: string) =>
    function Passthrough({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) {
      return <div data-testid={tag} {...rest}>{children}</div>
    }
  return {
    Button: function Button({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) {
      return <button {...rest}>{children}</button>
    },
    Badge: Passthrough('badge'),
    Card: Passthrough('card'),
    CardContent: Passthrough('card-content'),
    CardDescription: Passthrough('card-description'),
    CardHeader: Passthrough('card-header'),
    CardTitle: Passthrough('card-title'),
    Checkbox: ({
      checked,
      onCheckedChange,
      ...rest
    }: {
      checked?: boolean
      onCheckedChange?: (v: boolean) => void
    } & Record<string, unknown>) => (
      <input
        type="checkbox"
        role="checkbox"
        checked={checked ?? false}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...rest}
      />
    ),
    Label: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <label {...rest}>{children}</label>
    ),
  }
})

describe('WorkBuddy 一键重置页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(false)
    cleanup()
  })

  it('非桌面端只显示提示且不触发探针', () => {
    render(<WorkbuddyResetPage />)
    expect(screen.getByText('nonDesktop')).toBeTruthy()
    expect(workbuddyResetProbe).not.toHaveBeenCalled()
  })

  it('桌面端自动探针:root/可回收体量/条目分档渲染', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<WorkbuddyResetPage />)
    await waitFor(() => expect(workbuddyResetProbe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/\.workbuddy/)).toBeTruthy())
    expect(screen.getByText(/probeReclaimable/)).toBeTruthy()
    expect(screen.getByText(/wbRunning/)).toBeTruthy()
    // 分档标签在列(日志=可再生缓存,session=登录态,workspace/MEMORY.md=用户资产)
    expect(screen.getByText('tierMaintenance')).toBeTruthy()
    expect(screen.getByText('tierWebviewLogout')).toBeTruthy()
    expect(screen.getByText('tierDeviceIdentity')).toBeTruthy()
    expect(screen.getAllByText('tierUserAsset').length).toBe(2)
  })

  it('维护清理:killRunning 默认 true,结果层渲染 ok', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<WorkbuddyResetPage />)
    await waitFor(() => expect(screen.getByText('maintCta')).toBeTruthy())
    fireEvent.click(screen.getByText('maintCta'))
    await waitFor(() => expect(workbuddyResetMaintenance).toHaveBeenCalledTimes(1))
    expect(workbuddyResetMaintenance).toHaveBeenCalledWith(true)
    await waitFor(() => expect(screen.getByText('resultTitle')).toBeTruthy())
    expect(screen.getByText('maintenance_clean')).toBeTruthy()
    expect(screen.getAllByText('resultOk').length).toBeGreaterThan(0)
  })

  it('登出重置:勾选 device-id 后传参 includeDeviceId=true', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<WorkbuddyResetPage />)
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy())
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('logoutCta'))
    await waitFor(() => expect(workbuddyResetLogout).toHaveBeenCalledTimes(1))
    expect(workbuddyResetLogout).toHaveBeenCalledWith(true, true)
  })

  it('出厂重置:两次确认才执行', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<WorkbuddyResetPage />)
    await waitFor(() => expect(screen.getByText('factoryCta')).toBeTruthy())
    fireEvent.click(screen.getByText('factoryCta'))
    expect(workbuddyResetFactory).not.toHaveBeenCalled()
    expect(screen.getByText('factoryConfirm')).toBeTruthy()
    fireEvent.click(screen.getByText('factoryConfirmYes'))
    await waitFor(() => expect(workbuddyResetFactory).toHaveBeenCalledTimes(1))
    expect(workbuddyResetFactory).toHaveBeenCalledWith(true)
    await waitFor(() => expect(screen.getByText(/隔离区/)).toBeTruthy())
  })

  it('边界披露与关闭宿主提示常驻', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<WorkbuddyResetPage />)
    await waitFor(() => expect(screen.getByText('boundaryNote')).toBeTruthy())
    expect(screen.getByText('killNote')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
