// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 大屏「AI 号池」面板读数口径(2026-10-30 立)。
 *
 * 钉的是**数据绑定 + 口径**,不是像素:
 * 1. 「可调度」与调度侧同一把尺子 —— health=down 的号不算可调度(即使还没被 temp 摘除);
 * 2. 分母只算健康态可判定的行,脏值行单独一格;
 * 3. 最短令牌临期只读**可调度账号** —— 停用/摘除的死号过期不再把面板钉成常红;
 * 4. 最久未刷新按空闲保活窗口判色(旧版写死 1 小时阈值,把正常闲置读成故障)。
 *
 * 只 mock 网络与图表画布:ECharts 走 canvas,jsdom 里没有绘图上下文。
 */
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach } from 'vitest'

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

/** 生产 2026-10-30 读数(截屏同源):14 key / 2 异常 / 13 可调度账号 / 1 摘除号且其票已过期。 */
const liveRelayPool = {
  keyTotal: 14,
  keyClassified: 14,
  keySchedulable: 14,
  keyAbnormal: 2,
  keyAbnormalSchedulable: 2,
  keyBalanceLow: 2,
  keyRowsUnclassified: 0,
  accountsTotal: 14,
  accountClassified: 14,
  accountsSchedulable: 13,
  accountsBlocked: 1,
  accountsBlockedExpired: 1,
  accountRowsUnclassified: 0,
  minTokenExpiresInSeconds: 68_400,
  staleAgeSec: 0,
  accountRefreshAgeSec: 2 * 86_400 + 17 * 3_600,
  accountLatestRefreshAgeSec: 5 * 3_600 + 46 * 60,
  keepaliveIdleDays: 7,
  rowsUnclassified: 0,
}

function overviewWith(relayPool: unknown) {
  return {
    generatedAt: '2026-10-30T10:00:00.000Z',
    prometheusUrl: 'http://127.0.0.1:8815',
    sources: { prometheus: 'up', alertmanager: 'up', database: 'up', edge: 'up' },
    host: null,
    services: null,
    http: null,
    redis: null,
    pg: null,
    bridge: null,
    business: null,
    alerts: null,
    events: null,
    traffic: null,
    relayPool,
    edge: null,
  }
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

// 本文件不依赖全局 globals:true ⇒ 手动 cleanup,否则上一个用例的 DOM 会让
// screen 命中两份读数(实测 "Found multiple elements")
afterEach(cleanup)

/** 某读数的整张卡片(label + value + hint 的共同父节点);只在本次渲染的容器里找。 */
function cellOf(container: HTMLElement, label: string): HTMLElement {
  const el = within(container).getByText(label).parentElement
  if (!el) throw new Error(`找不到「${label}」所在的读数卡`)
  return el
}

async function renderWith(relayPool: unknown) {
  vi.mocked(fetchApi).mockImplementation((async (url: string) =>
    String(url).includes('/trend')
      ? { success: true, data: trend }
      : { success: true, data: overviewWith(relayPool) }) as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <WallboardView headerExtra={null} />
    </QueryClientProvider>,
  )
  // 面板标题与"— / —"占位都是静态的(占位里也有斜杠,不能用它当"数据到了"的判据);
  // 等到密钥池的占位符消失 = 数据真的绑上屏
  await waitFor(() => {
    expect(within(cellOf(view.container, '可调度 Key')).queryByText('— / —')).toBeNull()
  })
  return view
}

describe('大屏「AI 号池」读数口径', () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })

  it('可调度 / 异常 / 余额 / 临期 / 停用摘除 / 刷新滞后六格与生产读数一一对应', async () => {
    const view = await renderWith(liveRelayPool)
    const at = (label: string) => cellOf(view.container, label)

    // 密钥池:分母是"健康态可判定行数",不是总行数
    expect(within(at('可调度 Key')).getByText('14 / 14')).toBeTruthy()
    // 可调度 ≠ 健康:两条 degraded 仍未停用,选路照样能选中它们
    expect(within(at('异常 Key')).getByText('2')).toBeTruthy()
    expect(within(at('异常 Key')).getByText('其中 2 条仍可选中')).toBeTruthy()
    // 余额不足是硬故障信号:14 条可调度 key 里有 2 条余额 < 5 元
    expect(within(at('余额不足 Key')).getByText('2')).toBeTruthy()
    expect(within(at('未归类健康态(两池)')).getByText('0')).toBeTruthy()

    // 账号池:13/14 可调度,剩下 1 条是被摘除的死号
    expect(within(at('可调度账号')).getByText('13 / 14')).toBeTruthy()
    // 临期只读可调度号(68,400s = 19 小时);死号的"已过期"不再冒充池子最短临期
    expect(within(at('最短令牌临期')).getByText('19小时')).toBeTruthy()
    expect(within(at('最短令牌临期')).getByText('仅可调度号')).toBeTruthy()
    expect(within(view.container).queryByText('已过期')).toBeNull()
    // 死号仍然可见,但归到"停用·摘除号"这一格
    expect(within(at('停用·摘除号')).getByText('1')).toBeTruthy()
    expect(within(at('停用·摘除号')).getByText('其中已过期 1 条')).toBeTruthy()
    // 最久未刷新 + 最近一次刷新 + 保活窗口上限
    expect(within(at('最久未刷新')).getByText('2天17小时')).toBeTruthy()
    expect(within(at('最久未刷新')).getByText('最近一次 5小时46分前 · 保活上限 7天')).toBeTruthy()

    view.unmount()
  })

  it('最久未刷新越过保活窗口才染 warn;窗口内保持正常色', async () => {
    const inWindow = await renderWith(liveRelayPool)
    expect(
      within(cellOf(inWindow.container, '最久未刷新')).getByText('2天17小时').className,
    ).not.toContain('text-warning-text')
    inWindow.unmount()

    // 8 天 > 7 天窗口 ⇒ 必须有人看
    const overdue = await renderWith({ ...liveRelayPool, accountRefreshAgeSec: 8 * 86_400 })
    expect(within(cellOf(overdue.container, '最久未刷新')).getByText('8天').className).toContain(
      'text-warning-text',
    )
    overdue.unmount()
  })

  it('老后端(无分池字段)回落:分母用总行数、脏值用合计值,不把 undefined 渲成 0', async () => {
    const view = await renderWith({
      keyTotal: 5,
      keySchedulable: 3,
      keyAbnormal: 1,
      accountsTotal: 2,
      accountsSchedulable: 1,
      minTokenExpiresInSeconds: -60,
      staleAgeSec: 1,
      accountRefreshAgeSec: 7_200,
      rowsUnclassified: 1,
    })
    const at = (label: string) => cellOf(view.container, label)

    expect(within(at('可调度 Key')).getByText('3 / 5')).toBeTruthy()
    expect(within(at('可调度账号')).getByText('1 / 2')).toBeTruthy()
    expect(within(at('未归类健康态(两池)')).getByText('1')).toBeTruthy()
    // 老后端给的是全池最短临期(含死号)⇒ 这里如实显示「已过期」
    expect(within(at('最短令牌临期')).getByText('已过期')).toBeTruthy()
    // 新字段取不到 ⇒ 未判定灰,不是 0
    expect(within(at('余额不足 Key')).getByText('—')).toBeTruthy()

    view.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
