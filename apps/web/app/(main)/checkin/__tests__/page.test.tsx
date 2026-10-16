// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手页面核心交互测试(mock @ihui/api-client):
 * 1. 加载态 / 错误态(重试)/ 空账号态;
 * 2. 账号列表渲染(名称/最近签到/积分);
 * 3. 录入表单:合法提交带 device_map 解析结果;非法 JSON 阻断;
 * 4. 启停开关乐观翻转 + 失败回滚;
 * 5. 手动签到按钮调用与 loading 态;
 * 6. 删除确认对话框触发删除;
 * 7. 记录/积分历史表格渲染;
 * 8. 更新 JWT 对话框开/提交 + 成功提示;
 * 9. JWT 过期/临期徽章与冷却徽章;
 * 10. 记录表 message 列与最近签到失败信息;
 * 11. totalCreditsDelta 以 {delta} 参数格式化;
 * 12. 调度状态徽章(运行中/失败静默);
 * 13. 按账号过滤重新拉取 + 记录加载更多追加。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import CheckinPage from '../page'
import { useAuthStore } from '@/stores/auth'

// 门按 useAuthGate 的 allow(ready && isAuthenticated)放行
// ⇒ 既有用例统一以已登录态跑;未登录态另有专例覆盖。
useAuthStore.setState({ token: 'test-access-token', isAuthenticated: true })
import {
  checkinAuditTraeResidual,
  checkinCaptureQoder,
  checkinCaptureJwts,
  checkinCaptureWorkbuddy,
  openEmbeddedBrowser,
  closeEmbeddedBrowser,
  checkinWorkbuddyWebLoginProbe,
  checkinOneClickResetAll,
  checkinGetPublicIp,
  checkinSnapshotList,
  WB_WEB_LOGIN_URL,
  WB_WEB_LOGIN_ORIGIN,
} from '@/lib/tauri-bridge'
import { useTauriIpcReady } from '@/hooks/use-desktop'
import type { CheckinAccount, CheckinRecord, CheckinCreditsHistoryItem } from '@ihui/api-client'

const {
  listAccounts,
  listRecords,
  listCredits,
  createAccount,
  deleteAccount,
  setEnabled,
  manualCheckin,
  updateJwt,
  updateGroup,
  schedulerStatus,
  fetchAiService,
  queryCredits,
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listRecords: vi.fn(),
  listCredits: vi.fn(),
  createAccount: vi.fn(),
  deleteAccount: vi.fn(),
  setEnabled: vi.fn(),
  manualCheckin: vi.fn(),
  queryCredits: vi.fn(async () => ({
    ok: true,
    remaining: 0 as number | null,
    error: null as string | null,
  })),
  updateJwt: vi.fn(),
  updateGroup: vi.fn(),
  schedulerStatus: vi.fn(),
  fetchAiService: vi.fn(),
}))

// 残留审计基线报告(无残留)。vi.hoisted 提前:vi.mock 工厂在 import 期就要用它做默认值。
const { cleanAudit } = vi.hoisted(() => ({
  cleanAudit: {
    ok: true,
    message: '',
    blacklist_size: 12,
    scanned_files: 100,
    scanned_mb: 8.5,
    sites_present: 3,
    hard_hits: 0,
    hard_hit_files: [] as { file: string; count: number; sample: string }[],
    suspect_hits: 0,
    registry: [] as string[],
    hardware: [] as string[],
  },
}))

// 局部 mock(2026-10-14):本页现在经 useAuthGate → @/lib/api 走真实装配链,
// api.ts 在 import 期就调 setTokenProvider / setBaseUrl / setAiServiceBase 等注册口。
// 整表替换的 mock 让这些导出变成 undefined,收集期直接炸;改为铺真实模块再覆盖签到端点。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    listCheckinAccounts: listAccounts,
    listCheckinRecords: listRecords,
    listCheckinCreditsHistory: listCredits,
    listCheckinCreditsDaily: vi.fn(async () => ({
      days: [],
      series: { total: [], gained: [], consumed: [] },
    })),
    createCheckinAccount: createAccount,
    deleteCheckinAccount: deleteAccount,
    setCheckinAccountEnabled: setEnabled,
    manualCheckinAccount: manualCheckin,
    updateCheckinAccountJwt: updateJwt,
    updateCheckinAccountGroup: updateGroup,
    getCheckinSchedulerStatus: schedulerStatus,
    queryCheckinAccountCredits: queryCredits,
    fetchAiServiceJson: fetchAiService,
  }
})

vi.mock('@/components/charts/EChart', () => ({
  EChart: () => <div data-testid="echart" />,
}))

// 登录态门(2026-10-14):门本身由 use-auth-gate 承载,本页只消费 allow;
// 默认置为已登录,让既有用例继续走数据路径;未登录分支单独一例覆盖。
const authGate = vi.hoisted(() => ({ state: { ready: true, allow: true } }))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => authGate.state,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && 'name' in values) return `${key}:${values.name}`
    if (values && 'days' in values) return `${key}:${values.days}`
    if (values && 'time' in values) return `${key}:${values.time}`
    if (values && 'delta' in values) return `${key}:${values.delta}`
    if (values && 'ok' in values) return `${key}:${values.ok}/${values.total}`
    if (values && 'ip' in values) return `${key}:${values.ip}`
    if (values && 'hours' in values) return `${key}:${values.hours}`
    if (values && 'n' in values) return `${key}:${values.n}`
    if (values && 'files' in values) return `${key}:${values.files}/${values.mb}/${values.sites}`
    return key
  },
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    CalendarCheck: Icon,
    CheckCheck: Icon,
    ChevronDown: Icon,
    FolderPen: Icon,
    KeyRound: Icon,
    Laptop: Icon,
    Loader2: Icon,
    LogIn: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    Trash2: Icon,
    Wrench: Icon,
  }
})

// 桌面端通道(WP-C):测试环境无 __TAURI_INTERNALS__,useTauriIpcReady 恒 false;
// 桥接函数 mock 成具名 vi.fn,浏览器路径下不应被调用。
vi.mock('@/hooks/use-desktop', () => ({
  useTauriIpcReady: vi.fn(() => false),
}))
vi.mock('@/lib/tauri-bridge', () => ({
  checkinDetectTraeDir: vi.fn(),
  checkinCaptureJwts: vi.fn(async () => []),
  checkinCaptureQoder: vi.fn(async () => []),
  checkinCaptureMinimax: vi.fn(async () => []),
  checkinCaptureWorkbuddy: vi.fn(async () => []),
  WB_WEB_LOGIN_ORIGIN: 'https://www.workbuddy.cn',
  WB_WEB_LOGIN_URL:
    'https://www.workbuddy.cn/login/?platform=website&state=2&product=workbuddy&redirect_uri=https%3A%2F%2Fwww.workbuddy.cn%2F',
  openEmbeddedBrowser: vi.fn(async () => undefined),
  closeEmbeddedBrowser: vi.fn(async () => undefined),
  checkinWorkbuddyWebLoginProbe: vi.fn(async () => ({ status: 'no_window' }) as never),
  checkinResetDeviceIds: vi.fn(),
  checkinOneClickResetAll: vi.fn(),
  checkinGetPublicIp: vi.fn(),
  checkinAuditTraeResidual: vi.fn(async () => ({ ...cleanAudit })),
  checkinSnapshotBackup: vi.fn(),
  checkinSnapshotRestore: vi.fn(),
  checkinSnapshotList: vi.fn(),
  checkinSnapshotDelete: vi.fn(),
}))

vi.mock('@ihui/ui-react', () => {
  const Passthrough = (tag: string, testId?: string) =>
    function Passthrough({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) {
      return (
        <div data-testid={testId ?? tag} {...rest}>
          {children}
        </div>
      )
    }
  return {
    Button: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...rest}>{children}</button>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Label: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <label {...rest}>{children}</label>
    ),
    Switch: ({
      checked,
      onCheckedChange,
      ...rest
    }: {
      checked?: boolean
      onCheckedChange?: (v: boolean) => void
    } & Record<string, unknown>) => (
      <input
        type="checkbox"
        role="switch"
        checked={checked ?? false}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...rest}
      />
    ),
    Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) =>
      open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: Passthrough('dialog-content'),
    DialogHeader: Passthrough('dialog-header'),
    DialogFooter: Passthrough('dialog-footer'),
    DialogTitle: Passthrough('dialog-title'),
    DialogDescription: Passthrough('dialog-description'),
    Table: Passthrough('table'),
    TableHeader: Passthrough('table-header'),
    TableBody: Passthrough('table-body'),
    TableRow: Passthrough('table-row'),
    TableHead: Passthrough('table-head'),
    TableCell: Passthrough('table-cell'),
    Tabs: Passthrough('tabs'),
    TabsList: Passthrough('tabs-list'),
    TabsTrigger: Passthrough('tabs-trigger'),
    TabsContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div>{children}</div>
    ),
  }
})

const accountFixture: CheckinAccount = {
  id: 1,
  name: '主账号',
  group: '',
  platform: 'trae',
  device_map: {},
  enabled: true,
  jwt_exp: null,
  cooldown_until: null,
  created_at: null,
  updated_at: null,
  last_record: {
    ok: true,
    action: 'checkin',
    message: 'ok',
    credits: 120,
    created_at: '2026-10-03T08:00:00+00:00',
  },
}

function makeAccount(overrides: Partial<CheckinAccount>): CheckinAccount {
  return { ...accountFixture, ...overrides }
}

const recordFixture: CheckinRecord = {
  id: 7,
  account_id: 1,
  ok: true,
  action: 'checkin',
  http_status: 200,
  code: null,
  message: 'ok',
  classified_error: null,
  cooldown_until: null,
  credits: 125,
  credits_delta: 5,
  created_at: '2026-10-03T08:00:00+00:00',
}

const creditFixture: CheckinCreditsHistoryItem = {
  id: 7,
  account_id: 1,
  ok: true,
  action: 'checkin',
  credits: 125,
  credits_delta: 5,
  created_at: '2026-10-03T08:00:00+00:00',
}

function mockLoadSuccess(overrides?: { accounts?: CheckinAccount[]; records?: CheckinRecord[] }) {
  const accounts = overrides?.accounts ?? [accountFixture]
  listAccounts.mockResolvedValue({ accounts, count: accounts.length })
  const records = overrides?.records ?? [recordFixture]
  listRecords.mockResolvedValue({ records, count: records.length })
  listCredits.mockResolvedValue({
    history: [creditFixture],
    count: 1,
    total_credits_delta: 5,
  })
}

describe('签到助手页面 · 加载/错误/空态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createAccount.mockResolvedValue(accountFixture)
    deleteAccount.mockResolvedValue({ ok: true, id: 1 })
    setEnabled.mockResolvedValue({ ok: true, id: 1, enabled: false })
    manualCheckin.mockResolvedValue(recordFixture)
    updateJwt.mockResolvedValue({ ok: true, id: 1, jwt_exp: null })
    updateGroup.mockResolvedValue({ ok: true, id: 1, group: '' })
    schedulerStatus.mockResolvedValue({ enabled: true, started: true, next_run: null })
  })
  afterEach(() => cleanup())

  it('加载中显示 loading 态', async () => {
    listAccounts.mockReturnValue(new Promise(() => {}))
    listRecords.mockReturnValue(new Promise(() => {}))
    listCredits.mockReturnValue(new Promise(() => {}))
    render(<CheckinPage />)
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('加载失败显示错误态与重试按钮,重试重新拉取', async () => {
    listAccounts.mockRejectedValue(new Error('boom'))
    listRecords.mockRejectedValue(new Error('boom'))
    listCredits.mockRejectedValue(new Error('boom'))
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('retry')).toBeTruthy())
    mockLoadSuccess()
    fireEvent.click(screen.getByText('retry'))
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  it('空账号显示空态文案', async () => {
    mockLoadSuccess({ accounts: [], records: [] })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('emptyAccounts')).toBeTruthy())
  })

  it('冷启动竞态:登录态未就绪时不发请求,就绪后自动补拉', async () => {
    mockLoadSuccess()
    authGate.state = { ready: false, allow: false }
    const { rerender } = render(<CheckinPage />)
    expect(listAccounts).not.toHaveBeenCalled()
    authGate.state = { ready: true, allow: true }
    rerender(<CheckinPage />)
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(1))
    authGate.state = { ready: true, allow: true }
  })

  it('未登录不发注定 401 的请求,显示登录引导而非加载失败', async () => {
    mockLoadSuccess()
    authGate.state = { ready: true, allow: false }
    try {
      render(<CheckinPage />)
      // AuthGatePrompt 同文案渲染两处(说明段 + 按钮),与 /business-card/favorites 同形
      await waitFor(() => expect(screen.getAllByText('loginRequired').length).toBeGreaterThan(0))
      expect(listAccounts).not.toHaveBeenCalled()
      expect(screen.queryByText('retry')).toBeNull()
    } finally {
      authGate.state = { ready: true, allow: true }
    }
  })

  it('残留 isAuthenticated=true 但 token 未刷出 ⇒ 照常发请求(恢复路径 = 401 拦截器静默续期),成功则出内容', async () => {
    // 2026-10-15 改判撤掉 hasToken 二型门:该形态的真机复量证实,`ready && isAuthenticated && !token`
    // 正是 bootstrap「transient 刷新失败刻意保留登录态」的收束态,恢复机制 = 首个 401 走
    // 拦截器静默续期 —— 按 token 卡门会永转 spinner 饿死该路径(dev 壳实测)。
    mockLoadSuccess()
    authGate.state = { ready: true, allow: true }
    useAuthStore.setState({ token: null, isAuthenticated: true })
    try {
      render(<CheckinPage />)
      await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.queryByText('loading')).toBeNull())
      expect(screen.queryAllByText('loginRequired').length).toBe(0)
    } finally {
      useAuthStore.setState({ token: 'test-access-token', isAuthenticated: true })
    }
  })
})

describe('签到助手页面 · 账号列表与记录', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSuccess()
    createAccount.mockResolvedValue(accountFixture)
    deleteAccount.mockResolvedValue({ ok: true, id: 1 })
    setEnabled.mockResolvedValue({ ok: true, id: 1, enabled: false })
    manualCheckin.mockResolvedValue(recordFixture)
    updateJwt.mockResolvedValue({ ok: true, id: 1, jwt_exp: null })
    updateGroup.mockResolvedValue({ ok: true, id: 1, group: '' })
    schedulerStatus.mockResolvedValue({ enabled: true, started: true, next_run: null })
  })
  afterEach(() => cleanup())

  it('渲染账号名称/最近签到结果/积分', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    expect(screen.getAllByText('resultOk').length).toBeGreaterThan(0)
    expect(screen.getByText('120')).toBeTruthy()
  })

  it('渲染签到记录(结果/积分变化)与积分历史合计', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('totalCreditsDelta:5')).toBeTruthy())
    expect(screen.getAllByText('resultOk').length).toBeGreaterThan(0)
  })

  it('手动签到:按钮触发端点调用并刷新', async () => {
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('manualCheckin'))
    fireEvent.click(btn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledWith(1))
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  it('启停开关:翻转调用端点;失败回滚', async () => {
    render(<CheckinPage />)
    const toggle = await waitFor(() => screen.getByRole('switch'))
    setEnabled.mockRejectedValueOnce(new Error('deny'))
    fireEvent.click(toggle)
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(1, false))
    await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(true))
    expect(screen.getByRole('alert').textContent).toContain('deny')
  })

  it('删除:确认对话框中确认后调用删除端点', async () => {
    render(<CheckinPage />)
    const delBtn = await waitFor(() => screen.getByRole('button', { name: 'delete' }))
    fireEvent.click(delBtn)
    expect(screen.getByText('deleteTitle')).toBeTruthy()
    expect(screen.getByText('deleteDescription:主账号')).toBeTruthy()
    fireEvent.click(screen.getByText('confirmDelete'))
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(1))
  })

  it('录入:合法提交解析 device_map JSON;非法 JSON 阻断', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    const nameInput = document.getElementById('checkin-name') as HTMLInputElement
    const jwtInput = document.getElementById('checkin-jwt') as HTMLTextAreaElement
    const mapInput = document.getElementById('checkin-device-map') as HTMLTextAreaElement
    fireEvent.change(nameInput, { target: { value: '小号' } })
    fireEvent.change(jwtInput, { target: { value: 'eyJabc' } })
    fireEvent.change(mapInput, { target: { value: '{bad json' } })
    fireEvent.click(screen.getByText('submit'))
    expect(screen.getByText('deviceMapInvalid')).toBeTruthy()
    expect(createAccount).not.toHaveBeenCalled()
    fireEvent.change(mapInput, { target: { value: '{"device_id": "x1"}' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() =>
      expect(createAccount).toHaveBeenCalledWith({
        name: '小号',
        jwt: 'eyJabc',
        device_map: { device_id: 'x1' },
        group: '',
        platform: 'trae',
      }),
    )
  })
})

describe('签到助手页面 · 更新JWT/徽章/调度/过滤/加载更多', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSuccess()
    createAccount.mockResolvedValue(accountFixture)
    deleteAccount.mockResolvedValue({ ok: true, id: 1 })
    setEnabled.mockResolvedValue({ ok: true, id: 1, enabled: false })
    manualCheckin.mockResolvedValue(recordFixture)
    updateJwt.mockResolvedValue({ ok: true, id: 1, jwt_exp: '2027-01-01T00:00:00+00:00' })
    updateGroup.mockResolvedValue({ ok: true, id: 1, group: '主力' })
    schedulerStatus.mockResolvedValue({ enabled: true, started: true, next_run: null })
  })
  afterEach(() => cleanup())

  it('更新 JWT:对话框打开、提交调用端点并提示成功后刷新', async () => {
    render(<CheckinPage />)
    const editBtn = await waitFor(() => screen.getByRole('button', { name: 'editJwt' }))
    fireEvent.click(editBtn)
    expect(screen.getByText('editJwtTitle')).toBeTruthy()
    const textarea = document.getElementById('checkin-jwt-update') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'eyJnew-jwt' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => expect(updateJwt).toHaveBeenCalledWith(1, 'eyJnew-jwt'))
    await waitFor(() => expect(screen.getByText('jwtUpdated')).toBeTruthy())
    expect(screen.queryByText('editJwtTitle')).toBeNull()
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  it('JWT/冷却徽章:过期红色、临期琥珀含剩余天数、正常灰字日期、冷却带时间', async () => {
    const cooldownIso = new Date(Date.now() + 3_600_000).toISOString()
    const normalIso = new Date(Date.now() + 90 * 86_400_000).toISOString()
    const expired = makeAccount({
      id: 1,
      jwt_exp: new Date(Date.now() - 86_400_000).toISOString(),
      cooldown_until: cooldownIso,
    })
    const soon = makeAccount({
      id: 2,
      name: '临期号',
      jwt_exp: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })
    const normal = makeAccount({ id: 3, name: '正常号', jwt_exp: normalIso })
    mockLoadSuccess({ accounts: [expired, soon, normal] })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    expect(screen.getByText('jwtExpired')).toBeTruthy()
    expect(
      screen.getByText(`cooldownUntil:${cooldownIso.slice(5, 16).replace('T', ' ')}`),
    ).toBeTruthy()
    expect(screen.getByText('jwtExpiresSoon:3')).toBeTruthy()
    expect(screen.getByText(normalIso.slice(0, 10))).toBeTruthy()
  })

  it('最近签到失败信息:ok=false 且有 message 时追加小字(TruncatedText 溢出省略,禁原生 title)', async () => {
    const failedMessage = 'y'.repeat(45)
    const failed = makeAccount({
      id: 1,
      last_record: {
        ok: false,
        action: 'checkin',
        message: failedMessage,
        credits: null,
        created_at: '2026-10-03T08:00:00+00:00',
      },
    })
    mockLoadSuccess({ accounts: [failed] })
    render(<CheckinPage />)
    const el = await waitFor(() => screen.getByText(failedMessage))
    expect(el.className).toContain('truncate')
    expect(el.getAttribute('title')).toBeNull()
  })

  it('记录表信息列:colMessage 渲染,长 message 截断 60 并悬浮全文', async () => {
    const longMessage = 'x'.repeat(65)
    mockLoadSuccess({ records: [{ ...recordFixture, message: longMessage }] })
    render(<CheckinPage />)
    // 2026-10-15:信息列改走项目统一 TruncatedText(Radix Tooltip)——
    // 原生 title 属守门 18 违规。断言从"找 title 属性"改为"找截断后的文本",
    // 语义不变(仍验截断 60 + 非原生 title)。
    const cell = await waitFor(() => screen.getByText(`${'x'.repeat(60)}…`))
    expect(screen.getByText('colMessage')).toBeTruthy()
    expect(cell.className).toContain('truncate')
    expect(cell.getAttribute('title')).toBeNull()
  })

  it('积分合计:totalCreditsDelta 以 delta 参数格式化', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('totalCreditsDelta:5')).toBeTruthy())
  })

  it('一键全部签到:仅对 enabled 账号顺序调用并刷新', async () => {
    const disabled = makeAccount({ id: 2, name: '停用号', enabled: false })
    mockLoadSuccess({ accounts: [accountFixture, disabled] })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('checkinAll'))
    fireEvent.click(btn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledTimes(1))
    expect(manualCheckin).toHaveBeenCalledWith(1)
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  it('一键全部签到:跳过今日已签账号并提示,其余照常执行', async () => {
    const checkedToday = makeAccount({
      id: 2,
      name: '今日已签',
      last_record: {
        ok: true,
        action: 'checkin',
        message: 'ok',
        credits: 130,
        created_at: new Date().toISOString(),
      },
    })
    mockLoadSuccess({ accounts: [accountFixture, checkedToday] })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('checkinAll'))
    fireEvent.click(btn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledTimes(1))
    expect(manualCheckin).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.getByText('skippedToday')).toBeTruthy())
  })

  it('一键全部签到:跳过 JWT 已过期账号并提示,不对其调用签到', async () => {
    const expired = makeAccount({
      id: 2,
      name: '过期号',
      jwt_exp: new Date(Date.now() - 60_000).toISOString(),
    })
    const fresh = makeAccount({ id: 3, name: '有效号' })
    mockLoadSuccess({ accounts: [accountFixture, expired, fresh] })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('checkinAll'))
    fireEvent.click(btn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledTimes(2))
    // 过期号(id=2)不被调用,仅有效账号执行
    expect(manualCheckin).toHaveBeenCalledWith(1)
    expect(manualCheckin).toHaveBeenCalledWith(3)
    expect(manualCheckin).not.toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.getByText('skippedExpired')).toBeTruthy())
  })

  it('一键全部签到:跳过冷却中账号并提示,不对其调用签到', async () => {
    const cooling = makeAccount({
      id: 2,
      name: '冷却号',
      cooldown_until: new Date(Date.now() + 3_600_000).toISOString(),
    })
    mockLoadSuccess({ accounts: [accountFixture, cooling] })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('checkinAll'))
    fireEvent.click(btn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledTimes(1))
    expect(manualCheckin).toHaveBeenCalledWith(1)
    expect(manualCheckin).not.toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.getByText('skippedCooldown')).toBeTruthy())
  })

  it('一键全部签到:命中全局限流(429)立即中止整批并提示', async () => {
    const second = makeAccount({ id: 2, name: '二号' })
    mockLoadSuccess({ accounts: [accountFixture, second] })
    manualCheckin.mockRejectedValue(new Error('签到出站限流冷却中(60s)'))
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('checkinAll'))
    fireEvent.click(btn)
    // 中止:仅第一发被调用,第二个账号不再被打
    await waitFor(() => expect(screen.getByText('checkinRateLimited')).toBeTruthy())
    expect(manualCheckin).toHaveBeenCalledTimes(1)
    expect(manualCheckin).not.toHaveBeenCalledWith(2)
    // 后续用例恢复
    manualCheckin.mockResolvedValue(recordFixture)
  })

  it('批量余额刷新:串行错峰,不再 Promise.all 并发', async () => {
    const second = makeAccount({ id: 2, name: '二号' })
    mockLoadSuccess({ accounts: [accountFixture, second] })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('refreshCredits'))
    queryCredits.mockClear()
    fireEvent.click(btn)
    // 串行含 600ms 错峰间隔,等待窗口放宽
    await waitFor(() => expect(queryCredits).toHaveBeenCalledTimes(2), { timeout: 3000 })
    const first = queryCredits.mock.invocationCallOrder[0]!
    const secondCall = queryCredits.mock.invocationCallOrder[1]!
    // 严格串行:第二个调用在第一个 resolve 之后才发出
    expect(secondCall).toBeGreaterThan(first)
  })

  it('勾选批量:勾选单个账号后仅对其调用签到', async () => {
    const second = makeAccount({ id: 2, name: '二号' })
    mockLoadSuccess({ accounts: [accountFixture, second] })
    render(<CheckinPage />)
    const rowCheckboxes = await waitFor(() =>
      // mock 的 t('selectAccount', { name }) 返回 "selectAccount:名字"
      screen.getAllByRole('checkbox', { name: /^selectAccount:/ }),
    )
    // 两行各有勾选框;勾选第一行(账号 1)
    fireEvent.click(rowCheckboxes[0]!)
    const selectedBtn = await waitFor(() => screen.getByText('checkinSelected'))
    fireEvent.click(selectedBtn)
    await waitFor(() => expect(manualCheckin).toHaveBeenCalledTimes(1))
    expect(manualCheckin).toHaveBeenCalledWith(1)
    expect(manualCheckin).not.toHaveBeenCalledWith(2)
  })

  it('积分看板 tab:有数据时渲染排行/趋势面板', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('boardTab')).toBeTruthy())
    // TabsContent mock 直接渲染全部内容,看板数据存在 → 面板标题与图表出现
    await waitFor(() => expect(screen.getByText('boardRankingTitle')).toBeTruthy())
    expect(screen.getAllByTestId('echart').length).toBe(2)
  })

  it('分组对话框:打开(预填现值)、提交调用端点并提示成功', async () => {
    const grouped = makeAccount({ id: 1, group: '主力' })
    mockLoadSuccess({ accounts: [grouped] })
    render(<CheckinPage />)
    const editBtn = await waitFor(() => screen.getByRole('button', { name: 'editGroup' }))
    fireEvent.click(editBtn)
    expect(screen.getByText('editGroupTitle')).toBeTruthy()
    const input = document.getElementById('checkin-group-update') as HTMLInputElement
    expect(input.value).toBe('主力')
    fireEvent.change(input, { target: { value: '备用' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith(1, '备用'))
    await waitFor(() => expect(screen.getByText('groupUpdated')).toBeTruthy())
  })

  it('分组筛选:选择分组后账号表只显示该组账号(下拉 option 不受影响)', async () => {
    mockLoadSuccess({
      accounts: [
        makeAccount({ id: 1, group: '主力' }),
        makeAccount({ id: 2, name: '小号', group: '' }),
      ],
    })
    render(<CheckinPage />)
    const select = (await waitFor(() => screen.getByTestId('group-filter'))) as HTMLSelectElement
    // 账号行 + 记录/积分两个账号下拉的 option = 3 处
    expect(screen.getAllByText('主账号').length).toBe(3)
    expect(screen.getAllByText('小号').length).toBe(3)
    fireEvent.change(select, { target: { value: '主力' } })
    // 过滤后:账号表只剩 主账号,小号只剩两个 option
    expect(screen.getAllByText('主账号').length).toBe(3)
    expect(screen.getAllByText('小号').length).toBe(2)
  })

  it('调度状态徽章:运行中在标题下方显示弱化状态(不显示下次执行时间)', async () => {
    schedulerStatus.mockResolvedValue({
      enabled: true,
      started: true,
      next_run: '2026-10-09T08:00:00+00:00',
      next_run_qoder: '2026-10-09T10:00:00+00:00',
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('schedulerEnabled')).toBeTruthy())
    // 2026-10-12 机主要求:徽章移到标题下方,不再展示下次执行时间
    expect(screen.queryByText(/schedulerNextRun/)).toBeNull()
  })

  it('调度状态拉取失败:静默不显示徽章', async () => {
    schedulerStatus.mockRejectedValue(new Error('nope'))
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    expect(screen.queryByText('schedulerEnabled')).toBeNull()
    expect(screen.queryByText('schedulerDisabled')).toBeNull()
  })

  it('按账号过滤:选择账号后带 account_id 重新拉取', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    const select = screen.getByTestId('record-filter') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '1' } })
    await waitFor(() => expect(listRecords).toHaveBeenLastCalledWith({ accountId: 1, limit: 100 }))
    expect(listAccounts).toHaveBeenCalledTimes(2)
  })

  it('加载更多:记录追加渲染,返回不足请求量时隐藏按钮', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      ...recordFixture,
      id: i + 1,
      message: `msg${i + 1}`,
    }))
    mockLoadSuccess({ records: hundred })
    render(<CheckinPage />)
    const btn = await waitFor(() => screen.getByText('loadMore'))
    const oneFifty = Array.from({ length: 150 }, (_, i) => ({
      ...recordFixture,
      id: i + 1,
      message: `msg${i + 1}`,
    }))
    listRecords.mockResolvedValueOnce({ records: oneFifty, count: 150 })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(listRecords).toHaveBeenLastCalledWith({ accountId: undefined, limit: 200 }),
    )
    await waitFor(() => expect(screen.getByText('msg150')).toBeTruthy())
    expect(screen.queryByText('loadMore')).toBeNull()
  })
})

describe('签到助手页面 · 桌面端专属入口(WP-C)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSuccess()
  })

  it('浏览器环境(IPC 未注入)不渲染本机捕获/维护入口', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    expect(screen.queryByText('captureTitle')).toBeNull()
    expect(screen.queryByText('maintTitle')).toBeNull()
  })
})

// ── 一键解决风控向导(2026-10-10):3 步状态机 + busy 双闸 ──

const wizardLayer = (i: number) => ({ layer: i, name: `L${i}`, ok: true, detail: 'ok' })
/** 全平台聚合报告夹具(2026-10-16):TRAE 14 层 + 三平台摘要(默认空=skipped)。 */
const allReset = (
  layers: ReturnType<typeof wizardLayer>[],
  platforms: {
    platform: 'trae' | 'qoder' | 'workbuddy' | 'minimax'
    executed: boolean
    ok: boolean
    detail: string
  }[] = [],
) => ({
  trae: { layers },
  qoder: null,
  workbuddy: null,
  minimax: null,
  platforms,
})

describe('签到助手页面 · 一键解决风控向导', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // mockReset 清 implementation:防前测的 mockResolvedValueOnce 序列泄漏到后测
    // (useTauriIpcReady 的工厂实现不受 clearAllMocks 影响,无需重置)
    vi.mocked(checkinOneClickResetAll).mockReset()
    vi.mocked(checkinGetPublicIp).mockReset()
    // mockReset 会清掉工厂里的默认实现,必须显式补回默认报告
    vi.mocked(checkinAuditTraeResidual).mockReset()
    vi.mocked(checkinAuditTraeResidual).mockResolvedValue({ ...cleanAudit })
    vi.mocked(checkinSnapshotList).mockResolvedValue([])
    mockLoadSuccess()
  })
  afterEach(() => cleanup())

  async function openMaint() {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('maintTitle'))
    await waitFor(() => expect(screen.getByText('wizardTitle')).toBeTruthy())
  }

  it('全流程:一键重置 → 显示基准 IP → 换网验证通过 → 冷却完成态+重新开始', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue({
      ...allReset(Array.from({ length: 14 }, (_, i) => wizardLayer(i))),
      platforms: [
        { platform: 'qoder', executed: true, ok: true, detail: 'L2 logout_reset ok' },
        { platform: 'workbuddy', executed: true, ok: true, detail: 'L2 logout_reset ok' },
        { platform: 'minimax', executed: true, ok: true, detail: 'L2 logout_reset ok' },
      ],
    })
    vi.mocked(checkinGetPublicIp)
      .mockResolvedValueOnce({ ip: '1.2.3.4', location: '中国 吉林 长春 电信' })
      .mockResolvedValueOnce({ ip: '5.6.7.8', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    // Step2:重置完成报告 + 基准 IP 渲染
    await waitFor(() => expect(screen.getByText(/wizardIpBefore/)).toBeTruthy())
    expect(checkinOneClickResetAll).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/1\.2\.3\.4/)).toBeTruthy()
    expect(screen.getByText(/wizardResetDone/)).toBeTruthy()
    // Step3:换网后 IP 变化 → 完成态
    fireEvent.click(screen.getByText('wizardVerify'))
    await waitFor(() => expect(screen.getByText(/wizardIpChanged/)).toBeTruthy())
    expect(screen.getByText(/5\.6\.7\.8/)).toBeTruthy()
    expect(screen.getByText('wizardRestart')).toBeTruthy()
    // 重新开始:全部归零回到 Step0
    fireEvent.click(screen.getByText('wizardRestart'))
    await waitFor(() => expect(screen.getByText('wizardStart')).toBeTruthy())
    expect(screen.queryByText('wizardRestart')).toBeNull()
  })

  it('IP 未变时不进入完成态,红字提示重拔', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardVerify')).toBeTruthy())
    fireEvent.click(screen.getByText('wizardVerify'))
    await waitFor(() => expect(screen.getByText(/wizardIpUnchanged/)).toBeTruthy())
    expect(screen.queryByText('wizardRestart')).toBeNull()
  })

  it('busy 双闸:向导执行中 wizardStart 与手动 maintReset 同时禁用', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockReturnValue(new Promise(() => {}))
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => {
      expect((screen.getByText('wizardStart') as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByText('maintReset') as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('重置成功后自动跑一次残留审计,并显示"无残留"结论', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardAuditClean')).toBeTruthy())
    expect(checkinAuditTraeResidual).toHaveBeenCalledTimes(1)
    expect(screen.getByText('wizardAuditScope:100/8.5/3')).toBeTruthy()
  })

  it('审计发现残留:显示残留条数并列出命中文件', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    vi.mocked(checkinAuditTraeResidual).mockResolvedValue({
      ...cleanAudit,
      ok: false,
      hard_hits: 3,
      hard_hit_files: [
        { file: 'storage.json', count: 2, sample: 'abc123' },
        { file: 'state.vscdb', count: 1, sample: 'def456' },
      ],
    })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardAuditResidual:3')).toBeTruthy())
    expect(screen.getByText(/storage\.json ×2 abc123/)).toBeTruthy()
    expect(screen.getByText(/state\.vscdb ×1 def456/)).toBeTruthy()
  })

  it('点「重新检测残留」会再跑一次审计(累计 2 次)', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(checkinAuditTraeResidual).toHaveBeenCalledTimes(1))
    const rerun = await waitFor(() => screen.getByText('wizardAuditRerun'))
    expect((rerun as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(rerun)
    await waitFor(() => expect(checkinAuditTraeResidual).toHaveBeenCalledTimes(2))
  })

  // ── 2026-10-11 UX 修正闭环验证 ──

  it('P0-3 非可选层失败时显示告警而非"不影响"', async () => {
    await openMaint()
    // 层 1(machineid,文件级,非可选)失败 ⇒ 必须告警,不得再说"不影响主体"
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(
      allReset([{ layer: 1, name: 'machineid', ok: false, detail: 'boom' }]),
    )
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardVerify')).toBeTruthy())
    expect(screen.getByText('wizardCriticalFailNote')).toBeTruthy()
    expect(screen.queryByText('wizardOptionalNote')).toBeNull()
  })

  it('P0-1 无法换网时「直接完成」旁路可跳过验证进入冷却态', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardVerify')).toBeTruthy())
    fireEvent.click(screen.getByText('wizardSkipIp'))
    await waitFor(() => expect(screen.getByText('wizardCooldown')).toBeTruthy())
    expect(screen.getByText('wizardRestart')).toBeTruthy()
    expect(screen.queryByText('wizardVerify')).toBeNull()
  })

  it('P0-1 IP 连续 3 次未变自动高亮引导"直接完成"', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    // 出口 IP 始终不变 ⇒ 每次验证都计一次失败
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardVerify')).toBeTruthy())
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText('wizardVerify'))
      // 每次验证后向导仍在 Step2(未变),等待按钮恢复可点再点下一次
      await waitFor(() =>
        expect((screen.getByText('wizardVerify') as HTMLButtonElement).disabled).toBe(false),
      )
    }
    await waitFor(() => expect(screen.getByText('wizardIpFailMany')).toBeTruthy())
  })

  it('P1-2 审计发现残留时提供"退出 TRAE 后强制重跑"按钮', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    vi.mocked(checkinAuditTraeResidual).mockResolvedValue({
      ...cleanAudit,
      ok: false,
      hard_hits: 2,
      hard_hit_files: [{ file: 'storage.json', count: 1, sample: 'abc' }],
    })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardResidualReclean')).toBeTruthy())
  })

  it('P2-7 重新开始向导会清空上一轮审计结论', async () => {
    await openMaint()
    vi.mocked(checkinOneClickResetAll).mockResolvedValue(allReset([wizardLayer(0)]))
    vi.mocked(checkinGetPublicIp).mockResolvedValue({ ip: '1.2.3.4', location: '' })
    fireEvent.click(screen.getByText('wizardStart'))
    await waitFor(() => expect(screen.getByText('wizardAuditClean')).toBeTruthy())
    // 先走到 Step3(跳过验证),才有"重新开始"按钮
    fireEvent.click(screen.getByText('wizardSkipIp'))
    const restart = await waitFor(() => screen.getByText('wizardRestart'))
    expect(screen.getByText('wizardAuditTitle')).toBeTruthy()
    fireEvent.click(restart)
    await waitFor(() => expect(screen.queryByText('wizardAuditTitle')).toBeNull())
  })
})

describe('Qoder 平台化(2026-10-10)', () => {
  /** 2026-10-15 捕获入口收敛为下拉:先开「从本机捕获」菜单再点平台项(Radix happy-dom 键盘路径,与 sidebar 同款) */
  function openCaptureMenu() {
    const trigger = screen.getByText('captureTitle')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSuccess()
    schedulerStatus.mockResolvedValue({ enabled: true, started: true, next_run: null })
  })
  afterEach(() => cleanup())

  it('平台徽章:存量账号显示 TRAE,qoder 账号显示 Qoder', async () => {
    mockLoadSuccess({
      accounts: [accountFixture, makeAccount({ id: 2, name: 'Qoder 账号', platform: 'qoder' })],
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('Qoder 账号').length).toBeGreaterThan(0))
    expect(screen.getByText('Qoder', { selector: 'span' })).toBeTruthy()
    expect(screen.getAllByText('TRAE', { selector: 'span' }).length).toBeGreaterThan(0)
  })

  it('平台筛选:qoder 只显示 qoder 账号', async () => {
    mockLoadSuccess({
      accounts: [accountFixture, makeAccount({ id: 2, name: 'Qoder 账号', platform: 'qoder' })],
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('Qoder 账号').length).toBeGreaterThan(0))
    fireEvent.change(screen.getByTestId('platform-filter'), { target: { value: 'qoder' } })
    // 账号名也出现在记录筛选下拉的 option 里(恒在),故用平台徽章断言行级过滤
    expect(screen.queryByText('TRAE', { selector: 'span' })).toBeNull()
    expect(screen.getAllByText('Qoder 账号').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByTestId('platform-filter'), { target: { value: 'all' } })
    expect(screen.getAllByText('TRAE', { selector: 'span' }).length).toBeGreaterThan(0)
  })

  it('录入对话框:platform 选择随提交上送', async () => {
    createAccount.mockResolvedValue({ id: 9 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    fireEvent.change(screen.getByLabelText('name'), { target: { value: '手工 Qoder' } })
    fireEvent.change(screen.getByLabelText('jwt'), { target: { value: 'a.b.c' } })
    fireEvent.change(screen.getByTestId('platform-select'), { target: { value: 'qoder' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1))
    expect(createAccount.mock.calls[0]![0].platform).toBe('qoder')
  })

  it('Qoder 捕获:扫描→入库带 platform=qoder 与 cosy 设备头', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureQoder).mockResolvedValue([
      {
        app_dir: 'C:/x/com.qodercn.app.stable',
        edition: 'cn',
        uid: 'q-1',
        nickname: '18643389808',
        access_token: 'tok-1',
        refreshToken: 'rt-1',
        expires_at: 123,
        jwt_exp: 456,
        machine_id: 'mid',
        machine_os: 'x86_64_windows',
        machine_hostname: 'host',
        version: '1.0.0',
        machine_token: 'mt',
        machine_code: 'mc',
        machine_type: 'PC',
      },
    ])
    createAccount.mockResolvedValue({ id: 9 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('Qoder'))
    fireEvent.click(screen.getByText('captureQoderScan'))
    await waitFor(() => expect(screen.getByText('captureImport')).toBeTruthy())
    fireEvent.click(screen.getByText('captureImport'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1))
    const arg = createAccount.mock.calls[0]![0]
    expect(arg.platform).toBe('qoder')
    expect(arg.jwt).toBe('tok-1')
    // 2026-10-15 李总定档:名称只放展示名(手机优先),平台靠 platform 字段+徽章,不拼进名称
    expect(arg.name).toBe('18643389808')
    expect(arg.name).not.toMatch(/^Qoder-/)
    // 2026-10-12:uid 落 device_map(Qoder token 是 opaque 非 JWT,服务端 uid 只能从这里读)
    expect(arg.device_map.uid).toBe('q-1')
    expect(arg.device_map.refresh_token).toBe('rt-1')
    expect(arg.device_map.expires_at).toBe(123)
    expect(arg.device_map.cosy.machine_id).toBe('mid')
    expect(arg.device_map.cosy.client_type).toBe('10')
  })

  it('录入对话框:平台下拉含 workbuddy 三选项且随提交上送', async () => {
    createAccount.mockResolvedValue({ id: 9 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    const select = screen.getByTestId('platform-select') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['trae', 'workbuddy', 'qoder', 'minimax'])
    fireEvent.change(select, { target: { value: 'workbuddy' } })
    fireEvent.change(screen.getByLabelText('name'), { target: { value: '手工 WB' } })
    fireEvent.change(screen.getByLabelText('jwt'), { target: { value: 'wb-token-1' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1))
    expect(createAccount.mock.calls[0]![0].platform).toBe('workbuddy')
  })

  it('WorkBuddy 捕获:明文行直读入库;加密行粘 token 后入库', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureWorkbuddy).mockResolvedValue([
      {
        auth_file: 'C:/auth/workbuddy-desktop.info',
        uid: 'wb-1',
        nickname: '李总',
        domain: 'www.workbuddy.cn',
        access_token: 'wb-plain-token',
        encrypted: false,
        expires_at: 1794225169,
      },
      {
        auth_file: 'C:/auth/workbuddy-desktop.info',
        uid: 'wb-2',
        nickname: '小号',
        domain: 'www.workbuddy.cn',
        access_token: '',
        encrypted: true,
        expires_at: 1794225169,
      },
    ])
    createAccount.mockResolvedValue({ id: 9 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    fireEvent.click(screen.getByText('captureWbScan'))
    await waitFor(() => expect(screen.getByText('captureImport')).toBeTruthy())
    // 加密行显示「需粘贴 token」徽章
    expect(screen.getByText('captureWbEncrypted')).toBeTruthy()
    fireEvent.click(screen.getByText('captureImport'))
    // 明文行(wb-1)成功入库;加密行(wb-2)token 为空被拦,错误文案出现
    await waitFor(() => expect(screen.getByText(/captureWbTokenRequired/)).toBeTruthy())
    expect(createAccount).toHaveBeenCalledTimes(1)
    expect(createAccount.mock.calls[0]![0].jwt).toBe('wb-plain-token')
    // 取消勾选已入库的明文行,粘贴 token 后重导加密行
    fireEvent.click(screen.getByLabelText('captureWbAccount:wb-1'))
    fireEvent.change(screen.getByTestId('wb-token-input:wb-2'), {
      target: { value: 'wb-pasted-token' },
    })
    fireEvent.click(screen.getByText('captureImport'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(2))
    const second = createAccount.mock.calls[1]![0]
    expect(second.platform).toBe('workbuddy')
    expect(second.jwt).toBe('wb-pasted-token')
    expect(second.name).toBe('小号')
    expect(second.device_map.uid).toBe('wb-2')
    expect(second.device_map.domain).toBe('www.workbuddy.cn')
    expect(second.device_map.expires_at).toBe(1794225169)
  })

  it('WorkBuddy 网页登录:探测 ok 自动入库(login_type=web,jwt 字段=Cookie)', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(openEmbeddedBrowser).mockResolvedValue(null)
    vi.mocked(checkinWorkbuddyWebLoginProbe).mockResolvedValue({
      status: 'ok',
      cookie: 'session_id=abc123; wb_uid=u-9',
      accounts: [{ uid: '14f939c3-889b', nickname: '李总' }],
    })
    createAccount.mockResolvedValue({ id: 11 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    // 首轮探测立即执行:未等轮询即导入
    fireEvent.click(screen.getByText('captureWbWebOpen'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1))
    const payload = createAccount.mock.calls[0]![0]
    expect(payload.platform).toBe('workbuddy')
    expect(payload.jwt).toBe('session_id=abc123; wb_uid=u-9')
    expect(payload.device_map.login_type).toBe('web')
    expect(payload.device_map.uid).toBe('14f939c3-889b')
    expect(payload.device_map.nickname).toBe('李总')
    expect(payload.name).toBe('李总')
    // 导入完成后收尾:关掉内嵌浏览器登录窗(尽力而为)
    await waitFor(() => expect(closeEmbeddedBrowser).toHaveBeenCalled())
    // 对话框自动关闭 + 完成提示
    await waitFor(() => expect(screen.getByText(/captureWbWebDone/)).toBeTruthy())
  })

  it('WorkBuddy 网页登录:打开失败(未装浏览器/内嵌窗不可用)提示且不入库', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(openEmbeddedBrowser).mockResolvedValue('未找到 Google Chrome,请先安装 Chrome 浏览器')
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    fireEvent.click(screen.getByText('captureWbWebOpen'))
    await waitFor(() =>
      expect(screen.getByTestId('wb-web-login-msg').textContent).toContain('未找到 Google Chrome'),
    )
    expect(checkinWorkbuddyWebLoginProbe).not.toHaveBeenCalled()
    expect(createAccount).not.toHaveBeenCalled()
  })

  it('WorkBuddy 网页登录:必须打开真实登录页(内嵌浏览器窗)', async () => {
    // 2026-10-15/16 回归:① 旧实现拿 https://www.workbuddy.cn(产品营销首页,只有下载/
    // 介绍、没有任何登录入口)开窗,用户点「打开浏览器登录」后根本登不了;真实登录页是
    // /login/?platform=website&state=2&product=workbuddy&redirect_uri=...(扫码/账号密码)。
    // ② 2026-10-16 用户拍板回到「项目内嵌浏览器」形态(参照 Trae/Qoder 内嵌浏览器),
    // 窗口升级为完整浏览器(含地址栏/标签栏),由 openEmbeddedBrowser 统一开窗。
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(openEmbeddedBrowser).mockResolvedValue(null)
    vi.mocked(checkinWorkbuddyWebLoginProbe).mockResolvedValue({ status: 'no_cookie' })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    fireEvent.click(screen.getByText('captureWbWebOpen'))
    await waitFor(() => expect(openEmbeddedBrowser).toHaveBeenCalled())
    const [openedUrl] = vi.mocked(openEmbeddedBrowser).mock.calls[0]!
    expect(openedUrl).toBe(WB_WEB_LOGIN_URL)
    expect(openedUrl).toContain('/login/')
    expect(openedUrl).toContain('platform=website')
    expect(openedUrl).toContain('product=workbuddy')
    // 不得退回裸 origin(营销首页):带查询串的登录页地址,裸 origin 只是它的前缀
    expect(openedUrl).not.toBe(WB_WEB_LOGIN_ORIGIN)
  })

  it('WorkBuddy 网页登录:浏览器被关后提示可重试且不入库', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(openEmbeddedBrowser).mockResolvedValue(null)
    // 打开后的首轮立即探测即 no_window(用户已把浏览器窗口关掉)→ 立即提示可重试
    vi.mocked(checkinWorkbuddyWebLoginProbe).mockResolvedValue({ status: 'no_window' })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    fireEvent.click(screen.getByText('captureWbWebOpen'))
    await waitFor(() =>
      expect(screen.getByTestId('wb-web-login-msg').textContent).toContain(
        'captureWbWebWindowClosed',
      ),
    )
    expect(createAccount).not.toHaveBeenCalled()
  })

  it('WorkBuddy 网页登录:等待中可取消(停轮询+关内嵌浏览器登录窗+复位,不入库)', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(openEmbeddedBrowser).mockResolvedValue(null)
    // 迟迟未登录 ⇒ probe 永远 no_cookie(用户还在扫码/或中途放弃)
    vi.mocked(checkinWorkbuddyWebLoginProbe).mockResolvedValue({ status: 'no_cookie' })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    openCaptureMenu()
    fireEvent.click(screen.getByText('WorkBuddy'))
    fireEvent.click(screen.getByText('captureWbWebOpen'))
    // waiting 态:打开按钮换成取消按钮
    await waitFor(() => expect(screen.getByText('captureWbWebCancel')).toBeTruthy())
    fireEvent.click(screen.getByText('captureWbWebCancel'))
    // 取消 ⇒ 内嵌浏览器登录窗被收尾关闭 + 提示已取消 + 打开按钮恢复(可重开)
    await waitFor(() => expect(closeEmbeddedBrowser).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByTestId('wb-web-login-msg').textContent).toContain('captureWbWebCancelled'),
    )
    expect(screen.getByText('captureWbWebOpen')).toBeTruthy()
    expect(createAccount).not.toHaveBeenCalled()
    // 轮询已停:cancel 之后 probe 调用计数不再增长
    const callsAfterCancel = vi.mocked(checkinWorkbuddyWebLoginProbe).mock.calls.length
    await new Promise((r) => setTimeout(r, 300))
    expect(vi.mocked(checkinWorkbuddyWebLoginProbe).mock.calls.length).toBe(callsAfterCancel)
  })

  it('WorkBuddy 平台筛选与徽章', async () => {
    mockLoadSuccess({
      accounts: [accountFixture, makeAccount({ id: 3, name: 'WB 账号', platform: 'workbuddy' })],
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('WB 账号').length).toBeGreaterThan(0))
    expect(screen.getByText('WorkBuddy', { selector: 'span' })).toBeTruthy()
    fireEvent.change(screen.getByTestId('platform-filter'), { target: { value: 'workbuddy' } })
    expect(screen.queryByText('TRAE', { selector: 'span' })).toBeNull()
    expect(screen.getAllByText('WB 账号').length).toBeGreaterThan(0)
  })

  it('智能导入:浏览器环境给出桌面版提示,不自动检测', async () => {
    // 显式 false:桌面注入 mockReturnValue(true) 跨用例泄漏(clearAllMocks 不清实现),
    // 本用例必须显式压回,且放在本区块最前 —— 之后的用例再显式设 true,下游泄漏态不变。
    vi.mocked(useTauriIpcReady).mockReturnValue(false)
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    expect(screen.getByText('addSmartDesktopOnly')).toBeTruthy()
    expect(checkinCaptureJwts).not.toHaveBeenCalled()
  })

  it('智能导入:打开对话框即自动检测,未检测到登录态时给出指引', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureJwts).mockResolvedValue([])
    vi.mocked(checkinCaptureQoder).mockResolvedValue([])
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    // 打开即自动检测,用户零操作
    await waitFor(() => expect(checkinCaptureJwts).toHaveBeenCalled())
    expect(checkinCaptureQoder).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('smart-scan-none')).toBeTruthy())
  })

  it('智能导入(TRAE):自动列出多账号,勾选一键批量入库不接触 token', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureJwts).mockResolvedValue([
      { user_id: 'trae-user-1', jwt: 'eyJtrae.auto', source: 'leveldb:x' },
      { user_id: 'trae-user-2', jwt: 'eyJtrae.auto2', source: 'leveldb:y' },
    ])
    vi.mocked(checkinCaptureQoder).mockResolvedValue([])
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    // 两个账号都列出来(多账号不再只取第 1 个)
    await waitFor(() => expect(screen.getByText('trae-user-1')).toBeTruthy())
    expect(screen.getByText('trae-user-2')).toBeTruthy()
    fireEvent.click(screen.getByText('addSmartImport'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(2))
    expect(createAccount.mock.calls[0]![0].jwt).toBe('eyJtrae.auto')
    expect(createAccount.mock.calls[1]![0].jwt).toBe('eyJtrae.auto2')
    expect(createAccount.mock.calls[0]![0].platform).toBeUndefined()
  })

  it('展示名优先级:手机号优先,平台以独立徽章呈现(2026-10-15)', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureJwts).mockResolvedValue([
      { user_id: 'trae-uid-x', nickname: 'trader@aizhs.top', jwt: 'eyJx', source: 'leveldb:z' },
    ])
    vi.mocked(checkinCaptureQoder).mockResolvedValue([
      {
        app_dir: 'C:/x/com.qodercn.app.stable',
        edition: 'cn',
        uid: 'q-phone',
        nickname: '18643389808',
        access_token: 'tok-phone',
        refreshToken: 'rt',
        expires_at: 0,
        jwt_exp: 0,
        machine_id: 'mid',
        machine_os: 'win',
        machine_hostname: 'h',
        machine_token: 'mt',
        machine_code: 'mc',
        machine_type: 'PC',
        version: '1.0',
      },
    ])
    createAccount.mockResolvedValue({ id: 11 })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    await waitFor(() => expect(screen.getByText('18643389808')).toBeTruthy())
    // 无手机号通道回落账号(邮箱)
    expect(screen.getByText('trader@aizhs.top')).toBeTruthy()
    fireEvent.click(screen.getByText('addSmartImport'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(2))
    const names = createAccount.mock.calls.map((c) => c[0].name).sort()
    expect(names).toEqual(['18643389808', 'trader@aizhs.top'])
  })

  it('智能导入(Qoder):入库带 platform=qoder 与 cosy 设备头 device_map', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(checkinCaptureJwts).mockResolvedValue([])
    vi.mocked(checkinCaptureQoder).mockResolvedValue([
      {
        app_dir: 'C:/qoder',
        edition: 'cn',
        uid: 'qoder-uid-1',
        nickname: '18643389808',
        access_token: 'qoder-opaque-token',
        refreshToken: 'rt-1',
        expires_at: 1794225169,
        jwt_exp: 0,
        machine_id: 'mid-1',
        machine_os: 'win',
        machine_hostname: 'host-1',
        machine_token: 'mt-1',
        machine_code: 'mc-1',
        machine_type: 'mt',
        version: '1.0',
      },
    ])
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('addAccount'))
    await waitFor(() => expect(screen.getByText('18643389808')).toBeTruthy())
    // 平台是独立徽章(不是名称前缀)
    expect(screen.getAllByText('Qoder', { selector: 'span' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('addSmartImport'))
    await waitFor(() => expect(createAccount).toHaveBeenCalledTimes(1))
    const payload = createAccount.mock.calls[0]![0]
    expect(payload.platform).toBe('qoder')
    expect(payload.jwt).toBe('qoder-opaque-token')
    expect(payload.device_map.uid).toBe('qoder-uid-1')
    expect(payload.device_map.refresh_token).toBe('rt-1')
    expect(payload.device_map.expires_at).toBe(1794225169)
    expect(payload.device_map.cosy.machine_id).toBe('mid-1')
  })

  it('官方积分实时查询:手动签到成功后自动查官方余额并显示', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(manualCheckin).mockResolvedValue({ ok: true })
    vi.mocked(queryCredits).mockResolvedValue({ ok: true, remaining: 1250, error: null })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('manualCheckin'))
    await waitFor(() => expect(queryCredits).toHaveBeenCalledWith(accountFixture.id))
    // 积分列显示官方实时余额(而非记录快照)
    await waitFor(() => expect(screen.getByText('1250')).toBeTruthy())
  })

  it('官方积分实时查询:两次查询展示变化量(+/-)', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(queryCredits).mockResolvedValueOnce({ ok: true, remaining: 1000, error: null })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('creditRefreshAll'))
    await waitFor(() => expect(screen.getByText('1000')).toBeTruthy())
    // 余额变化后再次刷新 → 显示 +10
    vi.mocked(queryCredits).mockResolvedValueOnce({ ok: true, remaining: 1010, error: null })
    fireEvent.click(screen.getByText('creditRefreshAll'))
    await waitFor(() => expect(screen.getByText('+10')).toBeTruthy())
  })

  it('官方积分实时查询:工具栏按钮对 enabled 账号并发查询', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    mockLoadSuccess({
      accounts: [accountFixture, makeAccount({ id: 3, name: '停用号', enabled: false })],
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('creditRefreshAll'))
    await waitFor(() => expect(queryCredits).toHaveBeenCalledTimes(1))
    expect(queryCredits).toHaveBeenCalledWith(accountFixture.id)
    expect(queryCredits).not.toHaveBeenCalledWith(3)
  })

  it('官方积分实时查询:查询失败显示失败态而非静默', async () => {
    vi.mocked(useTauriIpcReady).mockReturnValue(true)
    vi.mocked(queryCredits).mockResolvedValue({ ok: false, remaining: null, error: '令牌过期' })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('creditRefreshAll'))
    await waitFor(() => expect(screen.getByText('creditQueryFail')).toBeTruthy())
  })
})

// ── 编辑设备头(device_map 手动编辑;PATCH /accounts/{id}/device_map,2026-10-11)──
// 页面本地封装走 fetchAiServiceJson(mock 于 @ihui/api-client 工厂),422/404 错误文案由
// error 字段(后端 detail 透传)落对话框红字。

describe('签到助手页面 · 编辑设备头对话框', () => {
  const dmDeviceMap = { device_id: 'x1', cosy: { machine_id: 'mid' } }
  const dmAccount = makeAccount({ device_map: dmDeviceMap })

  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSuccess({ accounts: [dmAccount] })
    schedulerStatus.mockResolvedValue({ enabled: true, started: true, next_run: null })
    fetchAiService.mockResolvedValue({
      success: true,
      data: { ok: true, device_map_keys: 2, platform: 'trae' },
      status: 200,
    })
  })
  afterEach(() => cleanup())

  async function openDialog() {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getAllByText('主账号').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'editDeviceMap' }))
    await waitFor(() => expect(screen.getByText('editDeviceMapTitle')).toBeTruthy())
  }

  it('打开对话框:textarea 初值 = 当前 device_map 的 JSON(2 空格缩进)', async () => {
    await openDialog()
    const textarea = document.getElementById('checkin-device-map-update') as HTMLTextAreaElement
    expect(textarea.value).toBe(JSON.stringify(dmDeviceMap, null, 2))
  })

  it('合法 JSON 提交:PATCH 被调用且参数正确,成功后关对话框+提示+刷新', async () => {
    await openDialog()
    const textarea = document.getElementById('checkin-device-map-update') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{"device_id":"x2"}' } })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() =>
      expect(fetchAiService).toHaveBeenCalledWith('/api/checkin/accounts/1/device_map', {
        method: 'PATCH',
        body: JSON.stringify({ device_map: { device_id: 'x2' } }),
      }),
    )
    await waitFor(() => expect(screen.queryByText('editDeviceMapTitle')).toBeNull())
    expect(screen.getByText('deviceMapUpdated')).toBeTruthy()
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2))
  })

  it('非法 JSON:对话框内红字提示,不发起请求', async () => {
    await openDialog()
    const textarea = document.getElementById('checkin-device-map-update') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{bad json' } })
    fireEvent.click(screen.getByText('submit'))
    expect(screen.getByText('deviceMapInvalid')).toBeTruthy()
    expect(fetchAiService).not.toHaveBeenCalled()
  })

  it('JSON 数组也拒绝(device_map 必须是 plain object)', async () => {
    await openDialog()
    const textarea = document.getElementById('checkin-device-map-update') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '[1,2]' } })
    fireEvent.click(screen.getByText('submit'))
    expect(screen.getByText('deviceMapInvalid')).toBeTruthy()
    expect(fetchAiService).not.toHaveBeenCalled()
  })

  it('404:红字显示后端 detail,对话框保持打开且不刷新', async () => {
    fetchAiService.mockResolvedValue({ success: false, error: '账号不存在', status: 404 })
    await openDialog()
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => expect(screen.getByText('账号不存在')).toBeTruthy())
    expect(screen.getByText('editDeviceMapTitle')).toBeTruthy()
    expect(listAccounts).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
