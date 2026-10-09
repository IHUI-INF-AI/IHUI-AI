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
import type { CheckinAccount, CheckinRecord, CheckinCreditsHistoryItem } from '@ihui/api-client'

const { listAccounts, listRecords, listCredits, createAccount, deleteAccount, setEnabled, manualCheckin, updateJwt, updateGroup, schedulerStatus } =
  vi.hoisted(() => ({
    listAccounts: vi.fn(),
    listRecords: vi.fn(),
    listCredits: vi.fn(),
    createAccount: vi.fn(),
    deleteAccount: vi.fn(),
    setEnabled: vi.fn(),
    manualCheckin: vi.fn(),
    updateJwt: vi.fn(),
    updateGroup: vi.fn(),
    schedulerStatus: vi.fn(),
  }))

vi.mock('@ihui/api-client', () => ({
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
  queryCheckinAccountCredits: vi.fn(async () => ({ ok: false, remaining: null, error: 'mock' })),
}))

vi.mock('@/components/charts/EChart', () => ({
  EChart: () => <div data-testid="echart" />,
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>) => {
      if (values && 'name' in values) return `${key}:${values.name}`
      if (values && 'days' in values) return `${key}:${values.days}`
      if (values && 'time' in values) return `${key}:${values.time}`
      if (values && 'delta' in values) return `${key}:${values.delta}`
      return key
    },
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    CalendarCheck: Icon,
    CheckCheck: Icon,
    FolderPen: Icon,
    KeyRound: Icon,
    Laptop: Icon,
    Loader2: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    Trash2: Icon,
    Wrench: Icon,
  }
})

// 桌面端通道(WP-C):测试环境无 __TAURI_INTERNALS__,useTauriIpcReady 恒 false;
// 桥接函数 mock 成具名 vi.fn,浏览器路径下不应被调用。
vi.mock('@/hooks/use-desktop', () => ({
  useTauriIpcReady: () => false,
}))
vi.mock('@/lib/tauri-bridge', () => ({
  checkinDetectTraeDir: vi.fn(),
  checkinCaptureJwts: vi.fn(),
  checkinResetDeviceIds: vi.fn(),
  checkinSnapshotBackup: vi.fn(),
  checkinSnapshotRestore: vi.fn(),
  checkinSnapshotList: vi.fn(),
  checkinSnapshotDelete: vi.fn(),
}))

vi.mock('@ihui/ui-react', () => {
  const Passthrough =
    (tag: string, testId?: string) =>
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
    const delBtn = await waitFor(() =>
      screen.getByRole('button', { name: 'delete' }),
    )
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
    expect(screen.getByText(`cooldownUntil:${cooldownIso.slice(5, 16).replace('T', ' ')}`)).toBeTruthy()
    expect(screen.getByText('jwtExpiresSoon:3')).toBeTruthy()
    expect(screen.getByText(normalIso.slice(0, 10))).toBeTruthy()
  })

  it('最近签到失败信息:ok=false 且有 message 时追加小字(截断 40)', async () => {
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
    const el = await waitFor(() => screen.getByTitle(failedMessage))
    expect(el.textContent).toBe(`${'y'.repeat(40)}…`)
  })

  it('记录表信息列:colMessage 渲染,长 message 截断 60 并悬浮全文', async () => {
    const longMessage = 'x'.repeat(65)
    mockLoadSuccess({ records: [{ ...recordFixture, message: longMessage }] })
    render(<CheckinPage />)
    const cell = await waitFor(() => screen.getByTitle(longMessage))
    expect(screen.getByText('colMessage')).toBeTruthy()
    expect(cell.textContent).toBe(`${'x'.repeat(60)}…`)
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
      accounts: [makeAccount({ id: 1, group: '主力' }), makeAccount({ id: 2, name: '小号', group: '' })],
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

  it('调度状态徽章:运行中显示启用与下次执行时间', async () => {
    schedulerStatus.mockResolvedValue({
      enabled: true,
      started: true,
      next_run: '2026-10-09T08:00:00+00:00',
    })
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('schedulerEnabled')).toBeTruthy())
    expect(screen.getByText('schedulerNextRun:10-09 08:00')).toBeTruthy()
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
    await waitFor(() =>
      expect(listRecords).toHaveBeenLastCalledWith({ accountId: 1, limit: 100 }),
    )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠