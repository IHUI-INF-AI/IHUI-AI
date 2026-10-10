// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 一键重置页核心交互测试(mock @/lib/tauri-bridge):
 * 1. 非桌面端提示 + 不触发探针;
 * 2. 桌面端自动探针:root/可回收体量/条目分档渲染;
 * 3. 维护清理:killRunning 默认 true 传参 + 结果层渲染;
 * 4. 登出重置:勾选 device-id 后传参 includeDeviceId=true;
 * 5. 出厂重置:两次确认才执行;
 * 6. 边界披露文案常驻。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import QoderResetPage from '../page'
import {
  qoderResetProbe,
  qoderResetPlan,
  qoderResetMaintenance,
  qoderResetLogout,
  qoderResetFactory,
  qoderQuarantineRestore,
  qoderQuarantineDelete,
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
      { path: 'plugins', tier: 'user_asset', size_mb: 427.0 },
      { path: 'projects', tier: 'user_asset', size_mb: 1100.0 },
      { path: 'binaries', tier: 'user_asset', size_mb: 610.0 },
      { path: 'sessions', tier: 'user_asset', size_mb: 12.0 },
      { path: 'memory', tier: 'user_asset', size_mb: 3.0 },
      { path: 'agents', tier: 'user_asset', size_mb: 2.0 },
      { path: 'skills', tier: 'user_asset', size_mb: 1.0 },
      { path: 'connectors', tier: 'user_asset', size_mb: 8.0 },
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
    Archive: Icon,
    Eraser: Icon,
    Factory: Icon,
    History: Icon,
    Loader2: Icon,
    LogOut: Icon,
    RefreshCw: Icon,
    ShieldAlert: Icon,
    Trash2: Icon,
    TriangleAlert: Icon,
    Undo2: Icon,
  }
})

vi.mock('@/hooks/use-desktop', () => ({
  useTauriIpcReady: vi.fn(() => false),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  qoderResetProbe: vi.fn(async () => JSON.parse(JSON.stringify(probeReport))),
  qoderResetMaintenance: vi.fn(async (_kill: boolean, onProgress?: (ev: unknown) => void) => {
    onProgress?.({ layer: 1, done: 1, total: 2, item: 'logs/20261010/main.log' })
    return {
      layers: [
        { layer: 0, name: 'kill_workbuddy_processes', ok: true, detail: '已强杀 5 个 WorkBuddy 进程' },
        { layer: 1, name: 'maintenance_clean', ok: true, detail: '已清理 9 项' },
      ],
    }
  }),
  qoderResetLogout: vi.fn(async () => ({
    layers: [{ layer: 2, name: 'logout_reset', ok: true, detail: '已搬移 1 项; 隔离区=D:/q' }],
  })),
  qoderResetFactory: vi.fn(async () => ({
    layers: [{ layer: 3, name: 'factory_reset', ok: true, detail: '已搬移 36 项; 隔离区=D:/q' }],
  })),
  qoderResetPlan: vi.fn(async () => ({
    mode: 'maintenance',
    include_device_id: false,
    actions: [],
    total_mb: 0,
  })),
  qoderQuarantineList: vi.fn(async () => [
    {
      name: '.workbuddy-quarantine-1728500000',
      path: 'C:/q',
      created_unix: 1728500000,
      mode: 'factory',
      original_root: 'C:/u/.workbuddy',
      entries: 3,
      size_mb: 1024.5,
    },
  ]),
  qoderQuarantineRestore: vi.fn(async () => ({
    layers: [{ layer: 4, name: 'quarantine_restore', ok: true, detail: '已恢复 3 项' }],
  })),
  qoderQuarantineDelete: vi.fn(async () => ({
    layers: [{ layer: 5, name: 'quarantine_delete', ok: true, detail: '已删除隔离区' }],
  })),
  qoderResetHistory: vi.fn(async () => [
    {
      file: '1728500000-factory.json',
      ts_unix: 1728500000,
      mode: 'factory',
      ok: true,
      summary: 'L3 factory_reset ok',
    },
  ]),
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

describe('Qoder 一键重置页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(false)
    cleanup()
  })

  it('非桌面端只显示提示且不触发探针', () => {
    render(<QoderResetPage />)
    expect(screen.getByText('nonDesktop')).toBeTruthy()
    expect(qoderResetProbe).not.toHaveBeenCalled()
  })

  it('桌面端自动探针:root/可回收体量/条目分档渲染', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await waitFor(() => expect(qoderResetProbe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getAllByText(/\.workbuddy/).length).toBeGreaterThan(0))
    expect(screen.getByText(/probeReclaimable/)).toBeTruthy()
    expect(screen.getByText(/wbRunning/)).toBeTruthy()
    // 分档标签在列(日志=可再生缓存,session=登录态,workspace/MEMORY.md=用户资产)
    expect(screen.getByText('tierMaintenance')).toBeTruthy()
    expect(screen.getByText('tierWebviewLogout')).toBeTruthy()
    expect(screen.getByText('tierDeviceIdentity')).toBeTruthy()
    expect(screen.getAllByText('tierUserAsset').length).toBe(9)
  })

  it('维护清理:killRunning 默认 true,结果层渲染 ok', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await waitFor(() => expect(screen.getByText('maintCta')).toBeTruthy())
    fireEvent.click(screen.getByText('maintCta'))
    await waitFor(() => expect(qoderResetMaintenance).toHaveBeenCalledTimes(1))
    expect(qoderResetMaintenance).toHaveBeenCalledWith(true, expect.any(Function))
    await waitFor(() => expect(screen.getByText('resultTitle')).toBeTruthy())
    expect(screen.getByText('maintenance_clean')).toBeTruthy()
    expect(screen.getAllByText('resultOk').length).toBeGreaterThan(0)
  })

  it('登出重置:勾选 device-id 后传参 includeDeviceId=true', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy())
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('logoutCta'))
    await waitFor(() => expect(qoderResetLogout).toHaveBeenCalledTimes(1))
    expect(qoderResetLogout).toHaveBeenCalledWith(true, true, expect.any(Function))
  })

  it('出厂重置:两次确认才执行', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await waitFor(() => expect(screen.getByText('factoryCta')).toBeTruthy())
    fireEvent.click(screen.getByText('factoryCta'))
    expect(qoderResetFactory).not.toHaveBeenCalled()
    expect(screen.getByText('factoryConfirm')).toBeTruthy()
    fireEvent.click(screen.getByText('factoryConfirmYes'))
    await waitFor(() => expect(qoderResetFactory).toHaveBeenCalledTimes(1))
    expect(qoderResetFactory).toHaveBeenCalledWith(true, expect.any(Function))
    await waitFor(() => expect(screen.getByText(/隔离区/)).toBeTruthy())
  })

  it('计划预览:操作卡展开判据清单且不执行', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    vi.mocked(qoderResetPlan).mockImplementationOnce(async (mode) => ({
      mode,
      include_device_id: false,
      total_mb: 8090.4,
      actions: [
        { path: 'logs/20261010', action: 'delete_dir', size_mb: 8089.4 },
        { path: 'app/CodeCache', action: 'delete_dir', size_mb: 1.0 },
      ],
    }))
    render(<QoderResetPage />)
    await screen.findByText('maintCta')
    fireEvent.click(screen.getAllByText('planPreview')[0]!)
    expect(await screen.findByText('planTitle')).toBeTruthy()
    expect(screen.getByText('logs/20261010')).toBeTruthy()
    expect(screen.getAllByText(/planActDeleteDir/).length).toBe(2)
    // 计划绝不执行:探针/清理桥未被额外调用
    expect(qoderResetMaintenance).not.toHaveBeenCalled()
    // 再点收起
    fireEvent.click(screen.getAllByText('planPreview')[0]!)
    await waitFor(() => expect(screen.queryByText('planTitle')).toBeNull())
  })

  it('探针条目:超 12 条折叠,展开后全量可见', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await screen.findByText(/probeReclaimable/)
    expect(screen.queryByText('connectors')).toBeNull()
    fireEvent.click(screen.getByText('entriesShowAll'))
    expect(screen.getByText('connectors')).toBeTruthy()
    expect(screen.getByText('plugins')).toBeTruthy()
    fireEvent.click(screen.getByText('entriesShowLess'))
    expect(screen.queryByText('connectors')).toBeNull()
  })

  it('执行进度条:逐条目回传渲染当前条目与计数', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    let push: ((ev: { layer: number; done: number; total: number; item: string }) => void) | undefined
    vi.mocked(qoderResetMaintenance).mockImplementationOnce(async (_k, onP) => {
      push = onP as typeof push
      await new Promise((r) => setTimeout(r, 30))
      return { layers: [{ layer: 1, name: 'maintenance_clean', ok: true, detail: 'x' }] }
    })
    render(<QoderResetPage />)
    fireEvent.click(await screen.findByText('maintCta'))
    await waitFor(() => expect(push).toBeTruthy())
    act(() => push!({ layer: 1, done: 1, total: 2, item: 'logs/20261010/main.log' }))
    expect(screen.getByText('progressLabel')).toBeTruthy()
    expect(screen.getByText('logs/20261010/main.log')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    // 完成后进度卡撤下
    await waitFor(() => expect(screen.queryByText('progressLabel')).toBeNull())
  })

  it('隔离区管理卡:列表渲染 + 一键恢复调用', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    expect(await screen.findByText('quarantineTitle')).toBeTruthy()
    expect(screen.getByText('.workbuddy-quarantine-1728500000')).toBeTruthy()
    expect(screen.getAllByText('factory').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('qRestore'))
    await waitFor(() => expect(qoderQuarantineRestore).toHaveBeenCalledWith('C:/q'))
    await waitFor(() => expect(screen.getByText('qRestored')).toBeTruthy())
  })

  it('隔离区删除:两段确认才执行', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    fireEvent.click(await screen.findByText('qDelete'))
    expect(qoderQuarantineDelete).not.toHaveBeenCalled()
    expect(screen.getByText('qDeleteConfirm')).toBeTruthy()
    fireEvent.click(screen.getByText('qDelete'))
    await waitFor(() => expect(qoderQuarantineDelete).toHaveBeenCalledWith('C:/q'))
  })

  it('历史台账卡:模式与摘要渲染', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    expect(await screen.findByText('historyTitle')).toBeTruthy()
    expect(screen.getAllByText('factory').length).toBeGreaterThan(0)
    expect(screen.getByText(/L3 factory_reset ok/)).toBeTruthy()
  })

  it('边界披露与关闭宿主提示常驻', async () => {
    ;(useTauriIpcReady as ReturnType<typeof vi.fn>).mockReturnValue(true)
    render(<QoderResetPage />)
    await waitFor(() => expect(screen.getByText('boundaryNote')).toBeTruthy())
    expect(screen.getByText('killNote')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
