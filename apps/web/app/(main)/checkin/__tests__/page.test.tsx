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
 * 7. 记录/积分历史表格渲染。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import CheckinPage from '../page'
import type { CheckinAccount, CheckinRecord, CheckinCreditsHistoryItem } from '@ihui/api-client'

const { listAccounts, listRecords, listCredits, createAccount, deleteAccount, setEnabled, manualCheckin } =
  vi.hoisted(() => ({
    listAccounts: vi.fn(),
    listRecords: vi.fn(),
    listCredits: vi.fn(),
    createAccount: vi.fn(),
    deleteAccount: vi.fn(),
    setEnabled: vi.fn(),
    manualCheckin: vi.fn(),
  }))

vi.mock('@ihui/api-client', () => ({
  listCheckinAccounts: listAccounts,
  listCheckinRecords: listRecords,
  listCheckinCreditsHistory: listCredits,
  createCheckinAccount: createAccount,
  deleteCheckinAccount: deleteAccount,
  setCheckinAccountEnabled: setEnabled,
  manualCheckinAccount: manualCheckin,
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string>) =>
      values && 'name' in values ? `${key}:${values.name}` : key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return { CalendarCheck: Icon, Loader2: Icon, Plus: Icon, RefreshCw: Icon, Trash2: Icon }
})

vi.mock('@ihui/ui-react', () => {
  const Passthrough =
    (tag: string, testId?: string) =>
    ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div data-testid={testId ?? tag} {...rest}>
        {children}
      </div>
    )
  return {
    Button: ({
      children,
      variant,
      size,
      ...rest
    }: React.PropsWithChildren<{ variant?: string; size?: string } & Record<string, unknown>>) => (
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
  device_map: {},
  enabled: true,
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
  })
  afterEach(() => cleanup())

  it('渲染账号名称/最近签到结果/积分', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('主账号')).toBeTruthy())
    expect(screen.getAllByText('resultOk').length).toBeGreaterThan(0)
    expect(screen.getByText('120')).toBeTruthy()
  })

  it('渲染签到记录(结果/积分变化)与积分历史合计', async () => {
    render(<CheckinPage />)
    await waitFor(() => expect(screen.getByText('totalCreditsDelta: 5')).toBeTruthy())
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
    await waitFor(() => expect(screen.getByText('主账号')).toBeTruthy())
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
      }),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
