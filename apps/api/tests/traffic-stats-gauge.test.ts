// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访客 PV/UV 聚合面取证(2026-10-23 立)。
 *
 * 钉死四件事,缺一不算修好:
 * - **gauge 语义**:没测过时只能有 0 基线,不许出现任何"看起来像数据"的值;
 *   "本进程从未聚合成功"另有显式出口(`ihui_traffic_aggregation_last_success_timestamp_seconds`
 *   = 0),不由 UV=0 冒充(AGENTS §0.3「没判」绝不写成「判过」)。
 * - **判据复用**:族分解用的就是 `utils/bot-detection.ts` 的 `classifyClientFamily`,
 *   测试里不抄第二份族表(AGENTS §22c)。
 * - **标签必须有界**:窗口 / 来源表 / 客户端族三维全部来自封闭枚举,枚举外的键必须被丢弃
 *   且不得多出任何序列(UV 本身是开放集 ⇒ 它只能当值,永远不能当标签)。
 * - **代价护栏**:每条查询都必须经过限窗 `where`,族分解的输出行数必须钉在预算内。
 *
 * 测试纪律:db 全程 mock(可链式 + 可 await),零连接 —— 不碰 PG 8810 / Redis 8811
 * (AGENTS §5 测试隔离铁律);枚举清单一律从源文件取。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 可链式 + 可 await 的 db 桩:每 await 一条查询就消费队列里的一批行。 */
const h = vi.hoisted(() => {
  const state: {
    queue: unknown[][]
    calls: number
    chainCalls: Array<[string, unknown[]]>
    reject: boolean
  } = { queue: [], calls: 0, chainCalls: [], reject: false }
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'having', 'on']) {
    chain[m] = (...args: unknown[]) => {
      state.chainCalls.push([m, args])
      return chain
    }
  }
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected: (e: unknown) => unknown,
  ): Promise<unknown> => {
    state.calls++
    if (state.reject) {
      return Promise.reject(new Error('模拟数据库不可用')).then(onFulfilled, onRejected)
    }
    const rows = state.queue.shift() ?? []
    return Promise.resolve(rows).then(onFulfilled, onRejected)
  }
  const db = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    execute: vi.fn(() => {
      state.calls++
      return Promise.resolve(state.queue.shift() ?? [])
    }),
    query: {},
  }
  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db: h.db, dbRead: h.db }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import businessMetricsPlugin, { __test__ as BM } from '../src/plugins/business-metrics.js'
import { classifyClientFamily } from '../src/utils/bot-detection.js'
import {
  foldUaKindsToFamily,
  refreshTrafficGauges,
  queryTrafficUaKinds,
  TRAFFIC_UA_KIND_BUDGET,
  TRAFFIC_WINDOW_HOURS,
  type TrafficUaKindRow,
} from '../src/services/traffic-stats-service.js'

let server: FastifyInstance | undefined

const WINDOWS = BM.TRAFFIC_WINDOWS as readonly string[]
const SOURCES = BM.TRAFFIC_SOURCES as readonly string[]
const FAMILIES = BM.CLIENT_FAMILIES as readonly string[]

async function render(): Promise<string> {
  if (!server) {
    const app = Fastify({ logger: false })
    await app.register(businessMetricsPlugin)
    await app.ready()
    server = app
  }
  const res = await server.inject({ method: 'GET', url: '/business-metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

function sampleLines(text: string, name: string): string[] {
  return text.split('\n').filter((l) => l.startsWith(`${name}{`))
}

function valueOf(text: string, name: string, labels: Record<string, string>): string | undefined {
  const labelSet = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  const escaped = labelSet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`^${name}\\{${escaped}\\} (\\S+)$`, 'm').exec(text)
  return hit?.[1]
}

function gaugeValue(text: string, name: string): string | undefined {
  return new RegExp(`^${name} (\\S+)$`, 'm').exec(text)?.[1]
}

/** 2026-10-23 从 api_logs 现读的真实 UA(含真人形态、AI 爬虫、脚本与无 UA 四型)。 */
const UA_FIXTURES: TrafficUaKindRow[] = [
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    pv: 40,
    uv: 21,
  },
  { userAgent: 'Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai/)', pv: 7, uv: 5 },
  { userAgent: 'python-requests/2.34.2', pv: 3, uv: 2 },
  { userAgent: null, pv: 2, uv: 2 },
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 QoderCN/0.4.8 Chrome/150.0.78',
    pv: 11,
    uv: 1,
  },
]

beforeEach(() => {
  BM.resetIhuiState()
  h.state.queue = []
  h.state.calls = 0
  h.state.chainCalls = []
  h.state.reject = false
})

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
})

describe('G) PV/UV 聚合 gauge:语义 + 有界标签 + 判据复用 + 代价护栏', () => {
  it('G1 还没聚合过时:每个有界组合各一条 0,除此之外不得有任何值', async () => {
    const text = await render()
    const expectations: Array<[string, number]> = [
      ['ihui_traffic_page_views', WINDOWS.length * SOURCES.length],
      ['ihui_traffic_unique_visitors', WINDOWS.length * SOURCES.length],
      ['ihui_traffic_family_breakdown_truncated', WINDOWS.length * SOURCES.length],
      ['ihui_traffic_family_page_views', WINDOWS.length * SOURCES.length * FAMILIES.length],
      ['ihui_traffic_family_unique_visitors', WINDOWS.length * SOURCES.length * FAMILIES.length],
    ]
    for (const [name, count] of expectations) {
      const lines = sampleLines(text, name)
      expect(lines.length, `${name} 序列数应与有界枚举乘积一致`).toBe(count)
      for (const line of lines) {
        expect(line.endsWith(' 0'), `未聚合却出现非 0 值:${line}`).toBe(true)
      }
    }
    // UV=0 是"还没测"的唯一合法形状;新鲜度戳为 0 才是那句"从没测过"的显式出口
    expect(
      valueOf(text, 'ihui_traffic_unique_visitors', { window: '24h', source: 'api_logs' }),
    ).toBe('0')
    expect(gaugeValue(text, 'ihui_traffic_aggregation_last_success_timestamp_seconds')).toBe('0')
  })

  it('G2 族分解的判据就是 classifyClientFamily(§22c:测试不抄第二份族表)', () => {
    const folded = foldUaKindsToFamily(UA_FIXTURES)
    let pvTotal = 0
    for (const row of UA_FIXTURES) {
      // 期望值直接由判据算出:该行的 PV 必须落进判据给出的那一族
      const family = classifyClientFamily(row.userAgent)
      pvTotal += row.pv
      expect(FAMILIES).toContain(family)
      expect(folded.familyPageViews[family] ?? 0).toBeGreaterThanOrEqual(row.pv)
    }
    // 不截断时不丢数:族求和 == 总 PV
    const sumPv = Object.values(folded.familyPageViews).reduce<number>((a, b) => a + (b ?? 0), 0)
    expect(sumPv).toBe(pvTotal)
    expect(folded.truncated).toBe(false)
    expect(folded.uaKindsObserved).toBe(UA_FIXTURES.length)
    // 自述口径:伪装形态照它自称记账,判据不在这层越权判真伪
    expect(folded.familyPageViews[classifyClientFamily(UA_FIXTURES[1]!.userAgent)]).toBe(7)
    expect(folded.familyPageViews['no-ua']).toBe(2)
  })

  it('G3 有界清单自相对账:窗口与来源表的说明键集必须与枚举逐字相同', () => {
    expect(Object.keys(BM.TRAFFIC_SOURCE_UV_LABEL).sort()).toEqual([...SOURCES].sort())
    expect(Object.keys(TRAFFIC_WINDOW_HOURS).sort()).toEqual([...WINDOWS].sort())
    for (const w of WINDOWS) {
      const hours = TRAFFIC_WINDOW_HOURS[w]
      expect(Number.isInteger(hours)).toBe(true)
      // 限窗上界:任何窗口都不许超过 24 小时(api_logs 无二级索引 ⇒ 窗口就是价格护栏)
      expect(hours).toBeGreaterThan(0)
      expect(hours).toBeLessThanOrEqual(24)
    }
  })

  it('G4 UA 种类数撞预算时必须显式标记截断,族值只算留下的那批(不许悄悄少报)', async () => {
    const rows: TrafficUaKindRow[] = [
      { userAgent: 'curl/8.21.0', pv: 100, uv: 10 },
      { userAgent: 'python-requests/2.34.2', pv: 90, uv: 9 },
      { userAgent: 'Mozilla/5.0 (compatible; GrokBot/1.0)', pv: 1, uv: 1 },
    ]
    const folded = foldUaKindsToFamily(rows, 2)
    expect(folded.truncated).toBe(true)
    expect(folded.uaKindsObserved).toBe(3)
    const sumPv = Object.values(folded.familyPageViews).reduce<number>((a, b) => a + (b ?? 0), 0)
    expect(sumPv).toBe(190)
    expect(sumPv).toBeLessThan(191)

    BM.setTrafficGaugeSample({
      window: '1h',
      source: 'api_logs',
      pageViews: 191,
      uniqueVisitors: 20,
      familyPageViews: folded.familyPageViews,
      familyBreakdownTruncated: folded.truncated,
    })
    const text = await render()
    expect(valueOf(text, 'ihui_traffic_page_views', { window: '1h', source: 'api_logs' })).toBe(
      '191',
    )
    expect(
      valueOf(text, 'ihui_traffic_family_breakdown_truncated', {
        window: '1h',
        source: 'api_logs',
      }),
      'PV 是精确总数,族分解截断必须单独可见',
    ).toBe('1')
  })

  it('G5 set 语义:同格二次写入覆盖而非累加,上一轮的族值必须归 0', async () => {
    BM.setTrafficGaugeSample({
      window: '24h',
      source: 'visit_logs',
      pageViews: 100,
      uniqueVisitors: 10,
      familyPageViews: { 'human-browser': 60, 'no-ua': 40 },
      familyUniqueVisitors: { 'human-browser': 6, 'no-ua': 4 },
    })
    BM.setTrafficGaugeSample({
      window: '24h',
      source: 'visit_logs',
      pageViews: 30,
      uniqueVisitors: 3,
      familyPageViews: { cli: 30 },
    })
    const text = await render()
    const labels = { window: '24h', source: 'visit_logs' }
    expect(valueOf(text, 'ihui_traffic_page_views', labels)).toBe('30')
    expect(valueOf(text, 'ihui_traffic_unique_visitors', labels)).toBe('3')
    expect(
      valueOf(text, 'ihui_traffic_family_page_views', { ...labels, client_family: 'cli' }),
    ).toBe('30')
    // 缺省族归 0:面板上不许挂着上一小时的 60 让人以为"现在还有真人"
    expect(
      valueOf(text, 'ihui_traffic_family_page_views', {
        ...labels,
        client_family: 'human-browser',
      }),
    ).toBe('0')
    expect(
      valueOf(text, 'ihui_traffic_family_unique_visitors', {
        ...labels,
        client_family: 'no-ua',
      }),
    ).toBe('0')
  })

  it('G6 标签集有界:枚举外的窗口/来源/族一律丢弃,不得多开序列', async () => {
    const before = await render()
    const beforeLines = sampleLines(before, 'ihui_traffic_family_page_views').length
    // 运行期脏输入(SQL 返回值被污染 / 调用方手滑):类型挡不住,只能在这里收口
    BM.setTrafficGaugeSample({
      window: '9999h' as never,
      source: 'evil_logs' as never,
      pageViews: 5,
      uniqueVisitors: 5,
    })
    BM.setTrafficGaugeSample({
      window: '1h',
      source: 'api_logs',
      pageViews: 5,
      uniqueVisitors: 5,
      familyPageViews: { 'evil"label': 9, 'inject\nseries': 9 } as never,
    })
    const text = await render()
    expect(text).not.toContain('evil')
    expect(text).not.toContain('9999h')
    expect(text).not.toContain('inject')
    expect(sampleLines(text, 'ihui_traffic_family_page_views').length).toBe(beforeLines)
    expect(valueOf(text, 'ihui_traffic_page_views', { window: '1h', source: 'api_logs' })).toBe('5')
    for (const line of sampleLines(text, 'ihui_traffic_page_views')) {
      const w = /window="([^"]*)"/.exec(line)?.[1] ?? ''
      const s = /source="([^"]*)"/.exec(line)?.[1] ?? ''
      expect(WINDOWS).toContain(w)
      expect(SOURCES).toContain(s)
    }
  })

  it('G7 端到端刷新:窗口 × 来源逐格聚合后写进 gauge,并推进新鲜度戳', async () => {
    // 队列顺序 = refreshTrafficGauges 的遍历顺序(窗口在外层、来源在内层,每格 2 条查询)
    h.state.queue = [
      [{ pv: 1234, uv: 56 }],
      [{ userAgent: 'curl/8.21.0', pv: 2, uv: 1 }],
      [{ pv: 9, uv: 4 }],
      [{ userAgent: null, pv: 9, uv: 4 }],
      [{ pv: 50000, uv: 900 }],
      [
        {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
          pv: 40000,
          uv: 800,
        },
      ],
      [{ pv: 77, uv: 12 }],
      [{ userAgent: 'python-requests/2.34.2', pv: 77, uv: 12 }],
    ]
    const before = Math.floor(Date.now() / 1000)
    const result = await refreshTrafficGauges()
    expect(result.cells).toBe(WINDOWS.length * SOURCES.length)
    expect(result.failures).toEqual([])
    expect(result.refreshed.length).toBe(result.cells)
    expect(h.state.calls).toBe(result.cells * 2)
    expect(h.state.queue.length, '查询次数与队列表对不上 ⇒ 遍历顺序漂了').toBe(0)

    const text = await render()
    expect(valueOf(text, 'ihui_traffic_page_views', { window: '1h', source: 'api_logs' })).toBe(
      '1234',
    )
    expect(
      valueOf(text, 'ihui_traffic_unique_visitors', { window: '1h', source: 'api_logs' }),
    ).toBe('56')
    expect(
      valueOf(text, 'ihui_traffic_family_page_views', {
        window: '24h',
        source: 'api_logs',
        client_family: 'human-browser',
      }),
    ).toBe('40000')
    expect(
      valueOf(text, 'ihui_traffic_family_page_views', {
        window: '24h',
        source: 'visit_logs',
        client_family: 'sdk',
      }),
    ).toBe('77')
    expect(
      valueOf(text, 'ihui_traffic_family_page_views', {
        window: '1h',
        source: 'visit_logs',
        client_family: 'no-ua',
      }),
    ).toBe('9')
    const ts = Number(gaugeValue(text, 'ihui_traffic_aggregation_last_success_timestamp_seconds'))
    expect(ts).toBeGreaterThanOrEqual(before)
  })

  it('G8 代价护栏:每条查询都有限窗 where,族分解的输出行数钉在预算内', async () => {
    h.state.queue = [[{ userAgent: 'curl/8.21.0', pv: 1, uv: 1 }]]
    const kinds = await queryTrafficUaKinds('api_logs', '1h')
    expect(kinds).toEqual([{ userAgent: 'curl/8.21.0', pv: 1, uv: 1 }])
    const methods = h.state.chainCalls.map(([m]) => m)
    expect(methods).toContain('where')
    expect(methods).toContain('groupBy')
    expect(methods).toContain('limit')
    const limitArg = h.state.chainCalls.find(([m]) => m === 'limit')?.[1][0]
    expect(limitArg).toBe(TRAFFIC_UA_KIND_BUDGET + 1)
    // 预算必须显著小于指标基数上限(400 种 UA 折进 12 族,族那侧天然有界)
    expect(TRAFFIC_UA_KIND_BUDGET).toBeLessThan(BM.IHUI_SERIES_CAP)
  })

  it('G9 查询失败不许写 0:该格保持上次的值,新鲜度戳不推进', async () => {
    BM.setTrafficGaugeSample({
      window: '24h',
      source: 'api_logs',
      pageViews: 42,
      uniqueVisitors: 7,
      familyPageViews: { 'human-browser': 42 },
      aggregatedAtMs: 1_000,
    })
    h.state.reject = true
    const result = await refreshTrafficGauges()
    expect(result.refreshed).toEqual([])
    expect(result.failures.length).toBe(result.cells)
    expect(result.failures[0]?.reason).toContain('模拟数据库不可用')

    const text = await render()
    expect(valueOf(text, 'ihui_traffic_page_views', { window: '24h', source: 'api_logs' })).toBe(
      '42',
    )
    expect(
      valueOf(text, 'ihui_traffic_unique_visitors', { window: '24h', source: 'api_logs' }),
    ).toBe('7')
    // 新鲜度戳停在 1 ⇒ 面板上"距今"会一路涨红,这就是"没测到"的可见证据
    expect(gaugeValue(text, 'ihui_traffic_aggregation_last_success_timestamp_seconds')).toBe('1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
