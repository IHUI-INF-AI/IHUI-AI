// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 企业治理控制台(G6)页面回归(2026-10-30 立)。
 *
 * 覆盖:
 *   1. 四区块正常渲染 + byMember / byModel 数据上屏
 *   2. 空数据空态(成员 / 模型 / 留痕)
 *   3. 403 → 整页「需要组织管理员权限」空态(不弹 toast)
 *   4. 策略块回填当前 version / enabled
 *   5. 保存 model_allowlist:PUT body 与逐键契约完全一致
 *   6. 保存成功刷新策略列表(策略 GET 被再次调用)
 *   7. 策略留痕按 updatedAt 倒序
 *
 * 翻译 mock 取「键名恒等」策略(与 settings/billing 页测试同型):断言直接比对 i18n 键名,
 * 词包本身由主线程统一写入,键位契约测试兜底。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// t 函数必须跨渲染稳定:页面把它放进依赖/子组件入参,每次渲染新建函数会触发额外重渲染
const { tMock } = vi.hoisted(() => ({ tMock: (key: string) => key }))
vi.mock('next-intl', () => ({ useTranslations: () => tMock }))

const fetchApiMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ ready: true, allow: true }),
}))

vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))

const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

// UI 基元替身:保持 DOM 形状足够断言,避免真实组件依赖干扰
vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    'data-testid'?: string
  }) => <tr data-testid={testId}>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <svg />
  return {
    Building2: Icon,
    Coins: Icon,
    Database: Icon,
    Layers: Icon,
    ScrollText: Icon,
    ShieldCheck: Icon,
  }
})

import OrgGovernancePage from '../page'

const SUMMARY = {
  orgId: 'org-1',
  period: { from: '2026-09-30T00:00:00.000Z', to: '2026-10-30T23:59:59.999Z' },
  byMember: [
    { userId: 'u-1', cost: '12.5000', tokens: 300, calls: 4 },
    { userId: 'u-2', cost: '3.2500', tokens: 120, calls: 2 },
  ],
  byModel: [{ model: 'gpt-4o', cost: '9.9000', tokens: 250, calls: 3 }],
  byDay: [{ date: '2026-10-29', cost: '1.2000', tokens: 40, calls: 1 }],
  agentBillings: {
    note: 'agent_billings 为 Coze 平台级账单,无组织归属列,按模型汇总仅作参考',
    byModel: [{ modelId: 'coze-a', balance: '-2.0000', tokens: 50, calls: 1 }],
  },
}

/** 策略行工厂:policyValue 为 jsonb(逐键形状对齐后端 zod) */
function policyRow(
  policyKey: string,
  policyValue: unknown,
  version: number,
  enabled: boolean,
  updatedAt: string,
) {
  return {
    id: `p-${policyKey}`,
    orgId: 'org-1',
    policyKey,
    policyValue,
    enabled,
    version,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt,
  }
}

const POLICIES = [
  policyRow(
    'model_allowlist',
    { modelIds: ['gpt-4o'], mode: 'block' },
    3,
    false,
    '2026-10-01T08:00:00.000Z',
  ),
  policyRow('feature_flags', { betaSearch: true }, 1, true, '2026-10-25T08:00:00.000Z'),
  policyRow('spend_budget_daily', { credits: 50 }, 2, true, '2026-10-10T08:00:00.000Z'),
  policyRow('data_retention_days', { days: 30 }, 5, true, '2026-10-20T08:00:00.000Z'),
]

const EMPTY_SUMMARY = {
  orgId: 'org-1',
  period: { from: '2026-09-30T00:00:00.000Z', to: '2026-10-30T23:59:59.999Z' },
  byMember: [],
  byModel: [],
  byDay: [],
  agentBillings: { note: 'agent_billings 为 Coze 平台级账单,无组织归属列,按模型汇总仅作参考', byModel: [] },
}

function ok<T>(data: T) {
  return { success: true as const, data, status: 200 }
}

/** 按 URL 分派 fetchApi 响应(GET summary / GET policies / PUT policies) */
function mockRoutes(overrides: { summary?: unknown; policies?: unknown; put?: unknown } = {}) {
  fetchApiMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/org/billing/summary')) {
      return Promise.resolve(ok(overrides.summary ?? SUMMARY))
    }
    if (url === '/api/org/policies') {
      return Promise.resolve(ok(overrides.policies ?? POLICIES))
    }
    // PUT /api/org/policies/:key
    return Promise.resolve(
      ok(
        overrides.put ??
          policyRow('model_allowlist', {}, 4, true, '2026-10-30T09:00:00.000Z'),
      ),
    )
  })
}

/** 统计某个 URL 的调用次数 */
function callCount(url: string): number {
  return fetchApiMock.mock.calls.filter(([u]) => u === url).length
}

/** 等策略行数据落到界面(加载态里已有同 testid 的占位,不能只等元素出现) */
async function waitForPoliciesLoaded(version = '3') {
  await waitFor(() =>
    expect(screen.getByTestId('policy-model_allowlist-version').textContent).toContain(
      `version: ${version}`,
    ),
  )
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<OrgGovernancePage />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRoutes()
})

afterEach(() => {
  cleanup()
})

describe('企业治理控制台(G6)', () => {
  it('① 四区块渲染 + byMember / byModel / agentBillings 数据上屏', async () => {
    renderPage()

    // 四个区块容器全部在册
    expect(screen.getByTestId('org-overview')).toBeTruthy()
    expect(screen.getByTestId('org-members')).toBeTruthy()
    expect(screen.getByTestId('org-models')).toBeTruthy()
    expect(screen.getByTestId('org-policies')).toBeTruthy()
    expect(screen.getByTestId('org-policy-trail')).toBeTruthy()

    // 组织概览:orgId 与默认最近 30 天周期(加载态有同 testid 占位,须等文本落定)
    await waitFor(() =>
      expect(screen.getByTestId('org-overview-org-id').textContent).toBe('org-1'),
    )
    expect(screen.getByTestId('org-period-from')).toBeTruthy()
    expect(screen.getByTestId('org-period-to')).toBeTruthy()

    // 成员用量:两行 userId / cost / tokens / calls
    const member1 = await screen.findByTestId('org-member-row-u-1')
    expect(member1.textContent).toContain('u-1')
    expect(member1.textContent).toContain('12.5000')
    expect(member1.textContent).toContain('300')
    expect(member1.textContent).toContain('4')
    expect(screen.getByTestId('org-member-row-u-2')).toBeTruthy()

    // 模型用量:byModel 行 + agent_billings 说明与参考小表 + 折叠的 byDay
    const model1 = await screen.findByTestId('org-model-row-gpt-4o')
    expect(model1.textContent).toContain('gpt-4o')
    expect(model1.textContent).toContain('9.9000')
    expect((await screen.findByTestId('org-agent-note')).textContent).toContain('agent_billings 为')
    expect(screen.getByTestId('org-agent-row-coze-a').textContent).toContain('-2.0000')
    expect(screen.getByTestId('org-day-row-2026-10-29').textContent).toContain('1.2000')

    // 四键编辑块齐全
    for (const key of [
      'model_allowlist',
      'feature_flags',
      'spend_budget_daily',
      'data_retention_days',
    ]) {
      expect(await screen.findByTestId(`org-policy-${key}`)).toBeTruthy()
    }
  })

  it('② 空数据:成员 / 模型 / 留痕各显示空态文案', async () => {
    mockRoutes({ summary: EMPTY_SUMMARY, policies: [] })
    renderPage()

    expect((await screen.findByTestId('org-members-empty')).textContent).toBe('emptyMembers')
    expect(screen.getByTestId('org-models-empty').textContent).toBe('emptyModels')
    expect((await screen.findByTestId('org-trail-empty')).textContent).toBe('emptyTrail')
    // 无策略行时四键编辑块仍在(可首次创建)
    expect(screen.getByTestId('org-policy-model_allowlist')).toBeTruthy()
  })

  it('③ 403 → 整页权限空态,不渲染业务区块、不弹 toast', async () => {
    fetchApiMock.mockImplementation(() =>
      Promise.resolve({ success: false, error: '需要组织管理员权限', status: 403 }),
    )
    renderPage()

    expect((await screen.findByTestId('org-forbidden')).textContent).toContain('forbidden')
    expect(screen.queryByTestId('org-overview')).toBeNull()
    expect(screen.queryByTestId('org-policies')).toBeNull()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('④ 策略块回填当前 version / enabled / updatedAt', async () => {
    renderPage()
    await waitForPoliciesLoaded()

    expect(screen.getByTestId('policy-model_allowlist-version').textContent).toContain('version: 3')
    expect(screen.getByTestId('policy-model_allowlist-enabled').textContent).toContain('disabled')
    expect(screen.getByTestId('policy-model_allowlist-updated-at').textContent).toContain(
      '2026-10-01 08:00:00',
    )

    // 文本域按行回填 modelIds,下拉回填 mode
    const input = screen.getByTestId('policy-model_allowlist-input') as HTMLTextAreaElement
    expect(input.value).toBe('gpt-4o')
    expect(
      (screen.getByTestId('policy-model_allowlist-mode') as HTMLSelectElement).value,
    ).toBe('block')

    // feature_flags 文本域按 flag=value 回填
    expect(
      (screen.getByTestId('policy-feature_flags-input') as HTMLTextAreaElement).value,
    ).toBe('betaSearch=true')
  })

  it('⑤ 保存 model_allowlist:PUT body 与逐键契约完全一致', async () => {
    renderPage()
    await waitForPoliciesLoaded()

    fireEvent.change(screen.getByTestId('policy-model_allowlist-input'), {
      target: { value: 'gpt-4o\nclaude-3-5-sonnet\n' },
    })
    fireEvent.change(screen.getByTestId('policy-model_allowlist-mode'), {
      target: { value: 'allow' },
    })
    fireEvent.click(screen.getByTestId('policy-model_allowlist-save'))

    await waitFor(() => expect(callCount('/api/org/policies/model_allowlist')).toBe(1))
    const putCall = fetchApiMock.mock.calls.find(
      ([url]) => url === '/api/org/policies/model_allowlist',
    )
    expect(putCall?.[1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({
      policyValue: { modelIds: ['gpt-4o', 'claude-3-5-sonnet'], mode: 'allow' },
      enabled: false,
    })
  })

  it('⑥ 保存成功 toast 成功并刷新策略列表(PUT 后 GET 再次被调用)', async () => {
    renderPage()
    await waitForPoliciesLoaded()
    expect(callCount('/api/org/policies')).toBe(1)

    fireEvent.click(screen.getByTestId('policy-model_allowlist-save'))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('saveSuccess'))
    await waitFor(() => expect(callCount('/api/org/policies')).toBe(2))
  })

  it('⑦ 策略留痕按 updatedAt 倒序(最新一行在最前)', async () => {
    renderPage()
    await waitForPoliciesLoaded()

    const rows = screen.getAllByTestId(/^trail-row-/)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'trail-row-feature_flags-1', // 2026-10-25
      'trail-row-data_retention_days-5', // 2026-10-20
      'trail-row-spend_budget_daily-2', // 2026-10-10
      'trail-row-model_allowlist-3', // 2026-10-01
    ])
    // 诚实说明在册(无独立审计端点)
    expect(screen.getByTestId('org-trail-note').textContent).toBe('trailNote')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
