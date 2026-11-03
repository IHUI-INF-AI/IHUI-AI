// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// /admin/error-dashboard 契约锁(2026-10-31)。
// 成因:后端 apps/api/src/routes/admin-error-dashboard.ts 的 /errors 直接投影
// `select * from monitor_alerts` —— 真列名是 severity(前端旧代码读 level,恒 undefined)
// 与 status: firing|suppressed|resolved(前端旧表自造 open|resolved|ignored),
// `LEVEL_STYLE[e.level]` / `STATUS_STYLE[e.status]` 拿到 undefined 再取 .bg ⇒ ≥1 行即崩表;
// 且客户端筛选拿恒 undefined 的 e.level 比较 ⇒ 任何非 all 筛选恒空。
// 词表合法值与展示元数据的唯一真相源 = `@/lib/admin/monitor-alert-vocabulary`
// (它从 packages/types/src/monitor-vocabulary.ts 的 canonical 派生,§0.6)。
// 词表外的脏值(库列是裸 varchar 无 CHECK)显式「未判定」:不崩表,也不冒充任何已知档。
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => {
  return { fetchApi: fetchApiMock, apiOrThrow: vi.fn() }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('@/components/common', () => ({
  BackButton: () => null,
  TruncatedText: ({ value }: { value: React.ReactNode }) => <span>{value}</span>,
}))

import ErrorDashboardPage from '../app/(main)/admin/error-dashboard/page'

// 逐字取自后端行形状:`select * from monitor_alerts`(packages/database/src/schema/monitor.ts
// 列名同名;fastify JSON 序列化后 timestamp 为 ISO 串,message 可为 null)。
const ALERT_ROWS = [
  {
    id: 'a1',
    name: 'api-5xx-rate',
    source: 'prometheus',
    severity: 'critical',
    status: 'firing',
    message: '5xx 比例超阈值',
    firedAt: '2026-10-31T02:00:00.000Z',
    resolvedAt: null,
    createdAt: '2026-10-31T02:00:00.000Z',
  },
  {
    id: 'a2',
    name: 'redis-latency',
    source: 'alertmanager',
    severity: 'warning',
    status: 'suppressed',
    message: '延迟升高',
    firedAt: '2026-10-30T22:10:00.000Z',
    resolvedAt: null,
    createdAt: '2026-10-30T22:10:00.000Z',
  },
  {
    id: 'a3',
    name: 'disk-clean',
    source: 'prometheus',
    severity: 'info',
    status: 'resolved',
    message: null,
    firedAt: '2026-10-29T08:00:00.000Z',
    resolvedAt: '2026-10-29T09:00:00.000Z',
    createdAt: '2026-10-29T08:00:00.000Z',
  },
  // 库里 severity/status 是裸 varchar(无 CHECK):未知值必须显式「未判定」,不得崩
  {
    id: 'a4',
    name: 'weird-alert',
    source: 'manual',
    severity: 'urgent',
    status: 'paused',
    message: '未知枚举',
    firedAt: null,
    resolvedAt: null,
    createdAt: '2026-10-31T00:00:00.000Z',
  },
]

/** 后端按 severity/status 真过滤(不是前端过滤,也不是空转的假筛选)。 */
function stubApi() {
  fetchApiMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/stats')) {
      return { success: true, data: { total: 4, today: 2, critical: 1, resolved: 1 } }
    }
    const u = new URL(url, 'http://localhost')
    const severity = u.searchParams.get('severity')
    const status = u.searchParams.get('status')
    const list = ALERT_ROWS.filter(
      (r) => (!severity || r.severity === severity) && (!status || r.status === status),
    )
    // 后端信封是 success({ list, page, pageSize }),不是裸数组
    return { success: true, data: { list, page: 1, pageSize: 20 } }
  })
}

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ErrorDashboardPage />
    </QueryClientProvider>,
  )
}

async function renderLoaded() {
  stubApi()
  const view = wrap()
  await waitFor(() => expect(screen.getByText('api-5xx-rate')).toBeTruthy())
  return view
}

function tbodyOf(view: { container: HTMLElement }) {
  const tbody = view.container.querySelector('tbody')
  expect(tbody).toBeTruthy()
  return within(tbody as HTMLElement)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/admin/error-dashboard 真列名契约', () => {
  it('喂真列名 fixture ⇒ render 不抛,四行全渲染', async () => {
    stubApi()
    expect(() => wrap()).not.toThrow()
    await waitFor(() => expect(screen.getByText('api-5xx-rate')).toBeTruthy())
    for (const name of ['redis-latency', 'disk-clean', 'weird-alert']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
  })

  it('状态/严重度按 canonical 词表渲染中文文案(info/warning/critical + firing/suppressed/resolved)', async () => {
    const view = await renderLoaded()
    // 徽章文案与下拉选项同名(都出自同一 canonical 词表)⇒ 断言范围收到表格体内
    const rows = tbodyOf(view)
    expect(rows.getByText('严重')).toBeTruthy()
    expect(rows.getByText('触发中')).toBeTruthy()
    expect(rows.getByText('警告')).toBeTruthy()
    expect(rows.getByText('已抑制')).toBeTruthy()
    expect(rows.getByText('信息')).toBeTruthy()
    expect(rows.getByText('已恢复')).toBeTruthy()
  })

  it('message=null 与 firedAt=null 走显式占位,不渲染 undefined/null 字样', async () => {
    const view = await renderLoaded()
    expect(tbodyOf(view).getAllByText('-').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/undefined/)).toBeNull()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('筛选按真列名 severity/status 走到服务端查询,只回该档行', async () => {
    await renderLoaded()
    const [sevSelect, statusSelect] = screen.getAllByRole('combobox')

    fireEvent.change(sevSelect, { target: { value: 'critical' } })
    // 切筛选会先清空表格再回填 ⇒ 等到目标行真的出现,别在空窗期断言
    await waitFor(() => expect(screen.getByText('api-5xx-rate')).toBeTruthy())
    expect(screen.queryByText('redis-latency')).toBeNull()
    expect(
      fetchApiMock.mock.calls.some(([url]) => String(url).includes('/errors?severity=critical')),
    ).toBe(true)

    fireEvent.change(sevSelect, { target: { value: 'all' } })
    await waitFor(() => expect(screen.getByText('redis-latency')).toBeTruthy())

    fireEvent.change(statusSelect, { target: { value: 'suppressed' } })
    await waitFor(() => expect(screen.getByText('redis-latency')).toBeTruthy())
    expect(screen.queryByText('api-5xx-rate')).toBeNull()
    expect(fetchApiMock.mock.calls.some(([url]) => String(url).includes('status=suppressed'))).toBe(
      true,
    )
  })

  it('词表外的值(severity=urgent / status=paused)显式「未判定」,不渲染裸值也不冒充已知档', async () => {
    const view = await renderLoaded()
    const rows = tbodyOf(view)
    // 同一行两格(严重度 + 状态)都落「未判定」
    expect(rows.getAllByText('未判定').length).toBe(2)
    expect(rows.queryByText('urgent')).toBeNull()
    expect(rows.queryByText('paused')).toBeNull()
  })

  it('筛选下拉的选项值只来自 canonical 词表(页面内不得再写一份合法值数组)', async () => {
    await renderLoaded()
    const [sevSelect, statusSelect] = screen.getAllByRole('combobox')
    const sevValues = Array.from((sevSelect as HTMLSelectElement).options).map((o) => o.value)
    const statusValues = Array.from((statusSelect as HTMLSelectElement).options).map((o) => o.value)
    expect(sevValues).toEqual(['all', 'info', 'warning', 'critical'])
    expect(statusValues).toEqual(['all', 'firing', 'suppressed', 'resolved'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
