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
// 词表合法值只认 packages/types/src/monitor-vocabulary.ts 的 canonical 声明(§0.6 单一真相源)。
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.hoisted(() => vi.fn())
const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => {
  return { fetchApi: fetchApiMock, apiOrThrow: apiOrThrowMock }
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
  // 库里 severity/status 是裸 varchar(无 CHECK):未知值必须走兜底显示裸值,不得崩
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

function stubApi() {
  fetchApiMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/stats')) {
      return { success: true, data: { total: 4, today: 2, critical: 1, resolved: 1 } }
    }
    // 后端信封是 success({ list, page, pageSize }),不是裸数组
    return { success: true, data: { list: ALERT_ROWS, page: 1, pageSize: 20 } }
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

  it('状态/严重度按 canonical 词表渲染文案(firing|suppressed|resolved + info|warning|critical)', async () => {
    const view = await renderLoaded()
    // 徽章文案与下拉选项同名(都出自同一 canonical 词表)⇒ 断言范围收到表格体内
    const tbody = view.container.querySelector('tbody')
    expect(tbody).toBeTruthy()
    const rows = within(tbody as HTMLElement)
    expect(rows.getByText('Critical')).toBeTruthy()
    expect(rows.getByText('Firing')).toBeTruthy()
    expect(rows.getByText('Warning')).toBeTruthy()
    expect(rows.getByText('Suppressed')).toBeTruthy()
    expect(rows.getByText('Info')).toBeTruthy()
    expect(rows.getByText('Resolved')).toBeTruthy()
  })

  it('message=null 与 firedAt=null 走显式 —,不渲染 undefined/null 字样', async () => {
    await renderLoaded()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/undefined/)).toBeNull()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('筛选按真列名 severity 生效:选 Critical 只剩 api-5xx-rate;选 Suppressed 只剩 redis-latency', async () => {
    await renderLoaded()
    const [sevSelect, statusSelect] = screen.getAllByRole('combobox')
    expect(sevSelect).toBeTruthy()
    expect(statusSelect).toBeTruthy()

    fireEvent.change(sevSelect, { target: { value: 'critical' } })
    await waitFor(() => expect(screen.queryByText('redis-latency')).toBeNull())
    expect(screen.getByText('api-5xx-rate')).toBeTruthy()

    fireEvent.change(sevSelect, { target: { value: 'all' } })
    await waitFor(() => expect(screen.getByText('redis-latency')).toBeTruthy())

    fireEvent.change(statusSelect, { target: { value: 'suppressed' } })
    await waitFor(() => expect(screen.queryByText('api-5xx-rate')).toBeNull())
    expect(screen.getByText('redis-latency')).toBeTruthy()
  })

  it('未知枚举值走兜底裸值(urgent/paused 原样显示),不折成已知档也不崩', async () => {
    await renderLoaded()
    expect(screen.getByText('urgent')).toBeTruthy()
    expect(screen.getByText('paused')).toBeTruthy()
  })

  it('筛选下拉的选项值只来自 canonical 词表(页面内不得再写一份合法值数组)', async () => {
    await renderLoaded()
    const [sevSelect, statusSelect] = screen.getAllByRole('combobox')
    const sevValues = Array.from(sevSelect.options).map((o) => o.value)
    const statusValues = Array.from(statusSelect.options).map((o) => o.value)
    expect(sevValues).toEqual(['all', 'info', 'warning', 'critical'])
    expect(statusValues).toEqual(['all', 'firing', 'suppressed', 'resolved'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
