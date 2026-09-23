// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 覆盖 2026-09-07 重构:头部次要功能按钮(扫码登录/批量导入/批量验证)收进"开发者"
 * 下拉菜单,并新增"账号分组"平滑滚动入口。此前该页零测试覆盖,此文件锁定:
 * 1. 头部不再有独立的批量导入/批量验证/扫码登录按钮(全部只在菜单里出现一次);
 * 2. 空账号态批量验证与账号分组菜单项禁用;
 * 3. 菜单项正确触发对应弹窗/动作;
 * 4. 账号分组入口滚动到 #account-groups 锚点。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AccountsPage from '../page'
import type { PublishAccount } from '@/hooks/use-publish-accounts'

// 批量端点与两个逐账号端点的调用监视(vi.hoisted:mock 工厂会被提前求值)
const { healthSummaryMock, cookieHealthSpy, accountRiskSpy } = vi.hoisted(() => ({
  healthSummaryMock: vi.fn(),
  cookieHealthSpy: vi.fn(),
  accountRiskSpy: vi.fn(),
}))

// next-intl mock(键名直出,便于断言)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// lucide-react mock(任意图标渲染为占位 span;vitest 对 mock 模块有 ESM 严格校验,
// 必须显式列出 page.tsx 导入的全部图标,Proxy 兜底不生效)
vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    Plus: Icon,
    Pencil: Icon,
    Trash2: Icon,
    Loader2: Icon,
    CheckCircle2: Icon,
    AlertCircle: Icon,
    QrCode: Icon,
    Upload: Icon,
    ShieldCheck: Icon,
    Wrench: Icon,
    ChevronDown: Icon,
    FolderKanban: Icon,
    KeyRound: Icon,
    CloudUpload: Icon,
  }
})

// @ihui/ui-react mock(简单透传元素)
vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...rest}>{children}</button>
  ),
  Card: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <label>{children}</label>
  ),
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  Select: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  Tooltip: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
}))

// Dropdown mock:触发器 + 平铺菜单按钮(便于 fireEvent 直击 onSelect/disabled)
vi.mock('@/components/feedback', () => ({
  Dropdown: ({
    trigger,
    items,
  }: {
    trigger: React.ReactElement
    items: Array<{
      key: string
      label?: React.ReactNode
      disabled?: boolean
      divider?: boolean
      onSelect?: () => void
    }>
  }) => (
    <div>
      {trigger}
      <div data-testid="dropdown-items">
        {items.map((it) =>
          it.divider ? (
            <hr key={it.key} data-testid={`divider-${it.key}`} />
          ) : (
            <button
              key={it.key}
              data-testid={`menu-${it.key}`}
              disabled={!!it.disabled}
              onClick={it.onSelect}
            >
              {it.label}
            </button>
          ),
        )}
      </div>
    </div>
  ),
}))

vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(() => Promise.resolve({ success: true, data: null })),
}))
// 只替换这三个端点,其余导出保持真实(整模块替换会打断间接依赖方的 import)
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ihui/api-client')>()
  const stub = (spy: (id: number) => void) => (accountId: number) => {
    spy(accountId)
    return Promise.resolve({ success: true, data: null })
  }
  return {
    ...actual,
    getAccountsHealthSummary: () => healthSummaryMock(),
    getCookieHealth: stub(cookieHealthSpy),
    getAccountRisk: stub(accountRiskSpy),
  }
})
vi.mock('@/components/publish/CredentialGuide', () => ({
  CredentialGuide: () => <div data-testid="credential-guide" />,
}))
vi.mock('@/components/publish/RiskBadge', () => ({
  RiskBadge: ({ level }: { level?: string }) => (
    <span data-testid="risk-badge">{level ?? 'none'}</span>
  ),
}))
vi.mock('@/components/publish/CookieHealthIndicator', () => ({
  CookieHealthIndicator: () => <span data-testid="cookie-health" />,
}))
vi.mock('@/components/publish/BatchImportDialog', () => ({
  BatchImportDialog: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="batch-dialog" /> : null,
}))
vi.mock('../ScanLoginDialog', () => ({
  ScanLoginDialog: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="scan-dialog" /> : null,
}))
vi.mock('../BatchScanLoginDialog', () => ({
  BatchScanLoginDialog: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="batch-scan-dialog" /> : null,
}))
vi.mock('@/components/publish/AccountGroupManager', () => ({
  AccountGroupManager: () => <div data-testid="group-manager" />,
}))

const batchVerifyMock = vi.fn(async () => true)
let currentAccounts: PublishAccount[] = []

vi.mock('@/hooks/use-publish-accounts', () => ({
  usePublishAccounts: () => ({
    accounts: currentAccounts,
    loading: false,
    saving: false,
    verifyingId: null,
    batchVerifying: false,
    create: vi.fn(async () => true),
    update: vi.fn(async () => true),
    verify: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    batchVerify: batchVerifyMock,
    reload: vi.fn(),
  }),
}))

const ACCOUNT: PublishAccount = {
  id: 1,
  platform: 'wordpress',
  displayName: '测试账号',
  status: 'active',
  lastVerifiedAt: null,
  credentials: {},
}

beforeEach(() => {
  currentAccounts = []
  batchVerifyMock.mockClear()
  healthSummaryMock.mockReset().mockResolvedValue({
    success: true,
    data: { items: [], count: 0 },
  })
  cookieHealthSpy.mockClear()
  accountRiskSpy.mockClear()
  if (!Element.prototype.scrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: () => {},
    })
  }
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('账户管理页"开发者"下拉(2026-09-07 收纳重构)', () => {
  it('扫码登录/手动配置/批量导入/批量验证/账号分组全部只在菜单中出现一次,头部无独立按钮', () => {
    render(<AccountsPage />)
    for (const key of ['scanLogin', 'manualAdd', 'batchImport', 'batchVerify', 'manageGroups']) {
      expect(screen.getByTestId(`menu-${key}`)).toBeTruthy()
    }
    // 每个功能文案全页只出现一次 = 只存在于下拉菜单(头部无独立按钮)
    expect(screen.getAllByText('accounts.scanLogin')).toHaveLength(1)
    expect(screen.getAllByText('accounts.batchImport')).toHaveLength(1)
    expect(screen.getAllByText('accounts.batchVerify')).toHaveLength(1)
    expect(screen.getAllByText('accounts.developer')).toHaveLength(1)
    // 功能菜单与"添加账号"之间有分隔线
    expect(screen.getByTestId('divider-groups-divider')).toBeTruthy()
    // 头部保留主操作"添加账号"(空态提示与弹窗标题也复用该文案,断言存在即可)
    expect(screen.getAllByText('accounts.add').length).toBeGreaterThan(0)
  })

  it('空账号态:批量验证与账号分组菜单项禁用,批量导入可用', () => {
    render(<AccountsPage />)
    expect((screen.getByTestId('menu-batchVerify') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('menu-manageGroups') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('menu-batchImport') as HTMLButtonElement).disabled).toBe(false)
  })

  it('头部"添加账号"直达扫码登录,菜单"手动配置"打开凭证表单,批量验证调用 batchVerify', () => {
    currentAccounts = [ACCOUNT]
    render(<AccountsPage />)
    // 2026-09-07:"添加账号"按钮以扫码登录为主(普通用户不应面对专业凭证配置)
    const addBtn = screen.getAllByText('accounts.add')[0]?.closest('button')
    expect(addBtn).toBeTruthy()
    fireEvent.click(addBtn as HTMLElement)
    expect(screen.getByTestId('scan-dialog')).toBeTruthy()
    // 专业凭证配置作为高级入口保留在"开发者"下拉的"手动配置"项
    fireEvent.click(screen.getByTestId('menu-manualAdd'))
    expect(screen.getByTestId('dialog-root')).toBeTruthy()
    fireEvent.click(screen.getByTestId('menu-batchImport'))
    expect(screen.getByTestId('batch-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('menu-scanLogin'))
    expect(screen.getByTestId('scan-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('menu-batchVerify'))
    expect(batchVerifyMock).toHaveBeenCalledTimes(1)
  })

  it('有账号时:分组管理器渲染在 #account-groups 锚点内,菜单项滚动到锚点', () => {
    currentAccounts = [ACCOUNT]
    render(<AccountsPage />)
    const anchor = document.getElementById('account-groups')
    expect(anchor).toBeTruthy()
    expect(anchor?.querySelector('[data-testid="group-manager"]')).toBeTruthy()
    expect((screen.getByTestId('menu-manageGroups') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('menu-manageGroups'))
    const spy = Element.prototype.scrollIntoView as unknown as { mock: { calls: unknown[][] } }
    expect(spy.mock.calls.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// 请求预算回归(2026-09-23 IP 封禁事故)
// ============================================================================

describe('账户管理页请求预算', () => {
  it('19 个账号只发 1 次批量请求,不再逐账号扇出 risk', async () => {
    currentAccounts = Array.from({ length: 19 }, (_, i) => ({
      ...ACCOUNT,
      id: i + 1,
      displayName: `账号${i + 1}`,
    }))
    render(<AccountsPage />)
    await waitFor(() => expect(healthSummaryMock).toHaveBeenCalledTimes(1))
    // 逐账号 risk 扇出(19 次/屏,叠加 cookie-health 与轮询即 ~163 次/分钟)正是当初
    // 越过服务端 200 次/分钟封禁阈值的主因,回升即回归。
    expect(accountRiskSpy).not.toHaveBeenCalled()
    // CookieHealthIndicator 在本文件被 mock 成裸 span;它自身"有供数就不请求"的行为
    // 由 components/publish/__tests__/CookieHealthIndicator.test.tsx 单独钉。
    expect(cookieHealthSpy).not.toHaveBeenCalled()
  })

  it('账号列表为空时不发批量请求', () => {
    currentAccounts = []
    render(<AccountsPage />)
    expect(healthSummaryMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
