// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 大屏两块「使用数据」面板的渲染取证(2026-10-26 立)。
 *
 * 钉的是数据绑定而不是像素:给定 overview 里的 `traffic.pageTop` / `traffic.scopeSplit` /
 * `engagement`,屏上必须真的出现页面排行、前台/后台/登录页读数与事件分布 —— 这三格是
 * 「多少人用了多少次 / 点了什么 / 停了多久」在监控面的唯一出口,静默消失就等于监控失明。
 *
 * 只 mock 网络与图表画布:ECharts 走 canvas,jsdom 里没有绘图上下文。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('next-intl', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const file = path.resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json')
  const messages = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    admin: { wallboard: Record<string, string> }
  }
  const ns = messages.admin.wallboard
  return {
    useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
      const raw = ns[key] ?? key
      return vars ? raw.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? '')) : raw
    },
    useLocale: () => 'zh-CN',
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/components/charts/EChart', () => ({ EChart: () => null }))

vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '@/lib/api'
import { WallboardView } from '../page'

const overview = {
  generatedAt: '2026-10-26T00:00:00.000Z',
  prometheusUrl: 'http://127.0.0.1:8815',
  sources: { prometheus: 'up', alertmanager: 'up', database: 'up', edge: 'up' },
  host: null,
  services: null,
  http: null,
  redis: null,
  pg: null,
  bridge: null,
  business: {
    usersTotal: 12,
    usersTodayNew: 1,
    usersActive: 3,
    ordersTodayPaid: 2,
    ordersTodayAmountCents: 9900,
    ordersYesterdayPaid: 1,
    apiCallsToday: 1200,
    apiErrRate: 0.4,
    apiAvgLatencyMs: 85,
    topEndpoints: [{ path: '/api/chat/send', method: 'POST', calls: 300 }],
    llmCallsToday: 40,
    llmTokensToday: 120000,
    llmCostCentsToday: 320,
    llmErrRate: 1.2,
    llmP95LatencyMs: 2400,
    llmTopModels: [{ model: 'gpt-4o-mini', calls: 25 }],
    signIn: {
      todayUsers: 3,
      todayRewardPoints: 30,
      maxStreakDays: 5,
      unsignedActiveUsers: 1,
      last7d: [{ date: '2026-10-25', users: 3 }],
    },
    userGrowth: [{ date: '2026-10-25', count: 1 }],
    usersVip: 2,
    usersTrader: 0,
    usersInvited: 1,
    usersInvited7d: 0,
    usersByLevel: [10, 1, 1, 0],
    activeUsers7d: 4,
  },
  alerts: { promActiveCount: 1, promActive: [], firingTotal: 1, firingNames: ['disk'], recent: [] },
  events: [],
  traffic: {
    pv24h: 4321,
    uv24h: 321,
    pv1h: 120,
    uv1h: 45,
    humanPv24h: 3800,
    botPv24h: 521,
    families: [{ family: 'chrome', pv: 2000 }],
    aggregationAgeSec: 2,
    truncated: false,
    pageTop: [
      { url: '/ecosystem', scope: 'public', pv: 90, uv: 60 },
      { url: '/admin/monitor/wallboard', scope: 'admin', pv: 12, uv: 2 },
      { url: '/login', scope: 'auth', pv: 8, uv: 8 },
    ],
    scopeSplit: [
      { scope: 'public', pv: 4200, uv: 300 },
      { scope: 'admin', pv: 101, uv: 2 },
      { scope: 'auth', pv: 20, uv: 18 },
    ],
    platformSplit: [
      { platform: 'web', pv: 4000, uv: 280, pv90d: 9200, lastSeenAt: '2026-10-26T00:00:00Z' },
      { platform: 'rn', pv: 120, uv: 20, pv90d: 300, lastSeenAt: '2026-10-26T00:00:00Z' },
      // 小程序:90 日内一条都没有 ⇒ 该端"未上报",而不是"今天没人用"
      { platform: 'mp', pv: 0, uv: 0, pv90d: 0, lastSeenAt: null },
      // 插件:近 90 日有量、今日 0 ⇒ "今日静默"
      { platform: 'ex', pv: 0, uv: 0, pv90d: 5, lastSeenAt: '2026-10-20T00:00:00Z' },
    ],
    online5m: 3,
    pv5m: 12,
  },
  engagement: {
    events: [
      { event: 'page_view', n: 652 },
      { event: 'click', n: 245 },
    ],
    clickTop: [{ label: '打开设置', n: 40 }],
    avgPageTimeSec: 47.5,
    totalEvents: 897,
    computedAtMs: 0,
  },
  audience: {
    newUv: 28,
    returningUv: 11,
    activeUv: 39,
    returningRate: 0.2821,
    computedAtMs: 0,
  },
  relayPool: null,
  edge: null,
}

const trend = {
  startEpochMs: 0,
  endEpochMs: 0,
  stepSeconds: 30,
  minutes: 90,
  qps: [],
  errRate: [],
  cpuPct: [],
  memPct: [],
  p95Ms: [],
  hourlyCalls: [],
}

function renderWallboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <WallboardView headerExtra={null} />
    </QueryClientProvider>,
  )
}

describe('WallboardView 使用数据面板', () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockImplementation((async (url: string) =>
      String(url).includes('/trend')
        ? { success: true, data: trend }
        : { success: true, data: overview }) as never)
  })

  it('渲染页面访问热度:排行 URL 与前台/后台/登录页分桶都在屏上', async () => {
    renderWallboard()
    await waitFor(() => expect(screen.getAllByText('页面访问热度').length).toBeGreaterThan(0))
    expect(screen.getAllByText('热门页面(近24h)').length).toBeGreaterThan(0)
    // 标题是静态的,数据要等 query 落地 —— 这里等的是「数据真的绑上屏」。
    await waitFor(() => expect(screen.getByText('/ecosystem')).toBeTruthy())
    // 每行同时给「多少次 / 多少人」:fixture 里 /ecosystem = PV 90 / UV 60
    expect(document.body.textContent).toContain('90 / 60')
    // 实时在线(近 5 分钟去重会话)在面板头
    expect(screen.getAllByText(/在线/).length).toBeGreaterThan(0)
    expect(screen.getByText('/admin/monitor/wallboard')).toBeTruthy()
    expect(screen.getAllByText('前台').length).toBeGreaterThan(0)
    expect(screen.getAllByText('后台').length).toBeGreaterThan(0)
    expect(screen.getAllByText('登录页').length).toBeGreaterThan(0)
  })

  it('渲染交互热度:事件分布、热门点击与平均停留', async () => {
    renderWallboard()
    await waitFor(() => expect(screen.getAllByText('交互热度').length).toBeGreaterThan(0))
    expect(screen.getByText('page_view')).toBeTruthy()
    expect(screen.getByText('打开设置')).toBeTruthy()
    expect(screen.getByText(/平均停留/)).toBeTruthy()
  })

  it('渲染各端使用量:网站/移动端/小程序/浏览器插件四行都按接口字段绑定', async () => {
    renderWallboard()
    await waitFor(() => expect(screen.getAllByText('各端使用量').length).toBeGreaterThan(0))
    expect(screen.getAllByText('网站').length).toBeGreaterThan(0)
    expect(screen.getAllByText('移动端').length).toBeGreaterThan(0)
    expect(screen.getAllByText('小程序').length).toBeGreaterThan(0)
    // 插件端行(2026-10-26 补):新增一端时必须在这里被点名,漏挂一行就是漏统计一整端
    expect(screen.getAllByText('浏览器插件').length).toBeGreaterThan(0)
    // web 行读数 PV 4000 / UV 280(读数走 fmtInt,千分位)
    await waitFor(() => expect(document.body.textContent).toContain('4,000'))
    expect(document.body.textContent).toContain('/ 280')
  })

  it('渲染访客构成:新访客/回访/回访率三行按接口字段绑定', async () => {
    renderWallboard()
    await waitFor(() => expect(screen.getAllByText('访客构成').length).toBeGreaterThan(0))
    expect(screen.getAllByText('新访客').length).toBeGreaterThan(0)
    expect(screen.getAllByText('回访访客').length).toBeGreaterThan(0)
    expect(screen.getAllByText('回访率').length).toBeGreaterThan(0)
    // 逐行绑值:11 / 39 = 28.21% ⇒ 界面读 28%;面板头给出窗口访客总数 39
    expect(screen.getAllByText('新访客')[0]?.parentElement?.textContent).toBe('新访客28')
    expect(screen.getAllByText('回访访客')[0]?.parentElement?.textContent).toBe('回访访客11')
    expect(screen.getAllByText('回访率')[0]?.parentElement?.textContent).toBe('回访率28%')
    await waitFor(() => expect(document.body.textContent).toContain('窗口访客 39'))
  })

  it('访客构成这条腿取不到时读数落“—”,不得兜成 0', async () => {
    vi.mocked(fetchApi).mockImplementation((async (url: string) =>
      String(url).includes('/trend')
        ? { success: true, data: trend }
        : { success: true, data: { ...overview, audience: null } }) as never)
    // 本仓 RTL 不自动 cleanup ⇒ 前一例的 DOM 仍在 body 里,必须按本次 container 取范围
    const view = renderWallboard()
    await waitFor(() =>
      expect(within(view.container).getAllByText('访客构成').length).toBeGreaterThan(0),
    )
    // 按行断言(整屏 textContent 会被别处的百分比干扰)
    expect(within(view.container).getAllByText('回访率')[0]?.parentElement?.textContent).toBe(
      '回访率—',
    )
    expect(within(view.container).getAllByText('新访客')[0]?.parentElement?.textContent).toBe(
      '新访客—',
    )
  })

  it('各端零量时分"今日静默"与"90日未上报"两种说法(不把未接入读成没人用)', async () => {
    const { container } = renderWallboard()
    // 面板标题与四行是静态铺出来的(traffic 未到也画)⇒ 必须等真读数上屏再判标记
    await waitFor(() => expect(within(container).getByText(/4,000/)).toBeTruthy())
    const exRow = within(container).getAllByText('浏览器插件')[0]?.parentElement?.textContent ?? ''
    expect(exRow).toContain('今日静默')
    const mpRow = within(container).getAllByText('小程序')[0]?.parentElement?.textContent ?? ''
    expect(mpRow).toContain('90日未上报')
    // 有量的端不打状态标记:标记只属于"这一行零量"的情况
    const webRow = within(container).getAllByText('网站')[0]?.parentElement?.textContent ?? ''
    expect(webRow).not.toContain('今日静默')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
