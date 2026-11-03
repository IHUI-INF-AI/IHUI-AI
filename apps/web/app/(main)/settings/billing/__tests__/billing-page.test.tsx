// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 账单与用量页(G4 计费弹性 · 透明化改造)核心逻辑回归(2026-10-30 立)。
 *
 * 覆盖:
 *   1. 计费规则区:listPricingRules 渲染(mode 徽标/基础价/档位系数表/生效版本与区间)
 *   2. 错峰说明:服务端拼好的 timeOfDayDescriptions 直接渲染;无窗口规则显示恒 ×1 提示
 *   3. 透明性文案:公式行 + 版本可追溯表述在册
 *   4. 我的用量区:近 30 天按日积分(90 天桶截尾 30)+ 按模型用量与花费
 *      (fetchApi 直调 /api/v1/ai/usage/stats?days=30)
 *   5. 空态:规则列表为空 → 存量默认口径提示
 *
 * 翻译 mock 取「键名恒等」策略(与 settings/devices 页测试同型):
 * 断言直接比对 i18n 键名,词包本身由键位契约测试兜底。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

// t 函数必须跨渲染稳定:页面把 t 放进 useMemo/useCallback 依赖,
// 每次渲染新建函数会触发「effect→setState→重渲染」死循环。
const { tMock } = vi.hoisted(() => ({ tMock: (key: string) => key }))
vi.mock('next-intl', () => ({
  useTranslations: () => tMock,
  useLocale: () => 'zh-CN',
}))

const api = vi.hoisted(() => ({
  listPricingRules: vi.fn(),
  getDailyCreditsUsage: vi.fn(),
}))
vi.mock('@ihui/api-client', () => api)

const fetchApiMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ ready: true, allow: true }),
}))

vi.mock('@/lib/edu', () => ({
  buildQs: (o: Record<string, string | number>) =>
    '?' + new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString(),
}))

vi.mock('@/components/common', () => ({
  BackButton: () => <div />,
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title }: { title?: string }) => <div data-testid="alert">{title}</div>,
}))

vi.mock('@/components/billing/credits-heatmap-card', () => ({
  CreditsHeatmapCard: () => <div data-testid="heatmap" />,
}))

// 订单/发票两页签不是本票改造面,替身挡住其表格实现(数据装配由原测试面负责)
vi.mock('../OrdersTab', () => ({
  OrdersTab: () => <div data-testid="orders-tab" />,
}))
vi.mock('../InvoicesTab', () => ({
  InvoicesTab: () => <div data-testid="invoices-tab" />,
}))

// UI 基元替身:保持 DOM 形状足够断言,避免 Radix portal 进测试环境
vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Badge: ({
    children,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    'data-testid'?: string
  }) => <span data-testid={testId}>{children}</span>,
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
  TableCell: ({
    children,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    'data-testid'?: string
  }) => <td data-testid={testId}>{children}</td>,
  Tabs: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <svg />
  return { BarChart3: Icon, Receipt: Icon, ScrollText: Icon, ShoppingCart: Icon }
})

import BillingPage from '../page'

const RULE_TOKEN = {
  id: 'r-1',
  ruleKey: 'default-token',
  displayName: '标准 Token 计费',
  currency: 'CNY',
  mode: 'token' as const,
  basePrice: 0.012,
  tierMultipliers: { member: 1, vip: 0.8 },
  timeOfDayFactor: { '00:00-08:00': { factor: 0.5 } },
  timeOfDayDescriptions: ['错峰窗口 00:00-08:00(时区 Asia/Shanghai):单价 × 0.5'],
  version: 3,
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  effectiveTo: null,
}
const RULE_CALL = {
  id: 'r-2',
  ruleKey: 'image-per-call',
  displayName: '按次计费',
  currency: 'CNY',
  mode: 'per_call' as const,
  basePrice: 5,
  tierMultipliers: {},
  timeOfDayFactor: null,
  timeOfDayDescriptions: [],
  version: 1,
  effectiveFrom: '2026-09-01T00:00:00.000Z',
  effectiveTo: '2026-12-31T00:00:00.000Z',
}

const END_DATE = '2026-10-30'
function dayMinus(n: number): string {
  const d = new Date(`${END_DATE}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
/** 90 天逐日补零桶(与 GET /api/credits/usage/daily 同形):只有末日有消耗 */
const BUCKETS_90 = Array.from({ length: 90 }, (_, i) => ({
  date: dayMinus(89 - i),
  count: i === 89 ? 2 : 0,
  points: i === 89 ? 12 : 0,
  sessions: 0,
}))

function ok<T>(data: T) {
  return { success: true as const, data, status: 200 }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<BillingPage />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listPricingRules.mockResolvedValue(ok([RULE_TOKEN, RULE_CALL]))
  api.getDailyCreditsUsage.mockResolvedValue(
    ok({
      days: 90,
      startDate: dayMinus(89),
      endDate: END_DATE,
      timezone: 'UTC',
      buckets: BUCKETS_90,
    }),
  )
  fetchApiMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/ai/usage/stats')) {
      return Promise.resolve(
        ok({
          total_tokens: 1000,
          total_cost: 0.75,
          total_calls: 9,
          daily_breakdown: {},
          model_breakdown: { 'gpt-x': { total_tokens: 1000, cost: 0.75, calls: 9 } },
          provider_breakdown: {},
        }),
      )
    }
    return Promise.resolve(ok({ list: [], total: 0, page: 1, pageSize: 10 }))
  })
})

afterEach(() => {
  cleanup()
})

describe('账单与用量页(G4 透明化)', () => {
  it('计费规则区:mode 徽标/基础价/档位系数/生效版本渲染', async () => {
    renderPage()
    const rule1 = await screen.findByTestId('pricing-rule-r-1')
    expect(rule1.textContent).toContain('标准 Token 计费')
    expect(screen.getByTestId('pricing-rule-mode-r-1').textContent).toBe('billing.mode_token')
    expect(rule1.textContent).toContain('billing.unit_token')
    expect(rule1.textContent).toContain('0.012')
    expect(rule1.textContent).toContain('v3')
    // 档位系数表:vip → ×0.8(member ×1 整数无尾零)
    const factors = within(rule1).getAllByTestId('pricing-tier-factor')
    expect(factors.map((f) => f.textContent)).toEqual(['×1', '×0.8'])

    const rule2 = await screen.findByTestId('pricing-rule-r-2')
    expect(screen.getByTestId('pricing-rule-mode-r-2').textContent).toBe('billing.mode_per_call')
    // 无档位 → 恒 ×1 提示;有截止日 → effectiveTo 键
    expect(rule2.textContent).toContain('billing.tierNone')
    expect(rule2.textContent).toContain('billing.effectiveTo')
  })

  it('错峰说明:服务端人话句子直接渲染;无窗口规则显示恒 ×1', async () => {
    renderPage()
    const offpeak = await screen.findByTestId('pricing-rule-offpeak-r-1')
    expect(offpeak.textContent).toContain('错峰窗口 00:00-08:00(时区 Asia/Shanghai):单价 × 0.5')
    const rule2 = await screen.findByTestId('pricing-rule-r-2')
    expect(rule2.textContent).toContain('billing.offPeakNone')
  })

  it('透明性文案:公式行与版本可追溯表述在册', async () => {
    renderPage()
    expect((await screen.findByTestId('billing-formula')).textContent).toBe('billing.formula')
    expect(screen.getByTestId('billing-version-trace').textContent).toBe('billing.versionTrace')
  })

  it('我的用量区:近 30 天按日积分(90 天桶截尾)+ 按模型用量与花费', async () => {
    renderPage()
    // 末日桶在列(含积分与笔数);第 90 天前(截尾外)的桶不得出现
    const lastRow = await screen.findByTestId(`usage-daily-row-${END_DATE}`)
    expect(lastRow.textContent).toContain('12')
    expect(screen.queryByTestId(`usage-daily-row-${dayMinus(89)}`)).toBeNull()
    expect(screen.getByTestId('billing-credits-total').textContent).toBe('billing.dailyTotal')

    // 按模型:fetchApi 直调 ai-service 端点(不新建 api-client 封装)
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledWith('/api/v1/ai/usage/stats?days=30'))
    const modelRow = await screen.findByTestId('usage-model-row-gpt-x')
    expect(modelRow.textContent).toContain('1000')
    expect(modelRow.textContent).toContain('$0.7500')
  })

  it('空态:无自定义规则时展示存量默认口径提示(不代表不计费)', async () => {
    api.listPricingRules.mockResolvedValue(ok([]))
    renderPage()
    const empty = await screen.findByTestId('billing-rules-empty')
    expect(empty.textContent).toContain('billing.emptyTitle')
    expect(empty.textContent).toContain('billing.emptyHint')
    expect(screen.queryByTestId('pricing-rule-r-1')).toBeNull()
  })
})

// within 辅助(避免整包 import 之外的额外 mock 面)
function within(scope: HTMLElement) {
  return {
    getAllByTestId: (testId: string) =>
      Array.from(scope.querySelectorAll(`[data-testid="${testId}"]`)),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
