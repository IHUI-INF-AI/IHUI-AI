// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访客/号池「实时快照」取证(2026-10-23 立,机主要"实时"不要小时级之后)。
 *
 * 钉死四件事:
 * - **实时**:大屏读的是现算快照(`getTrafficLiveSnapshot`),不再读小时级 gauge ⇒
 *   api 重启不会把 PV/UV 打回 0,也不必等下一次 job 才出数。
 * - **缓存有界**:同一 TTL 窗口内 N 个观众只打一次 DB(in-flight 去重);过了 TTL 必重算。
 * - **失败不兜底成 0**:任一条 SQL 抛错就整块上抛,由路由折成 null(大屏渲染"—");
 *   绝不能把"没量到"写成"0 个访客"(AGENTS §0.3)。
 * - **判据只有一份**:真人口径取 `utils/bot-detection.ts` 的 `HUMAN_CLIENT_FAMILIES`,
 *   可调度/异常口径取 `relay-pool-stats-service.ts` 的同一把尺子,测试里不另写词表。
 *
 * 测试纪律:db 全程 mock(可链式 + 可 await),零连接 —— 不碰 PG / Redis(AGENTS §5)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** 可链式 + 可 await 的 db 桩:每 await 一条查询就消费队列里的一批行。 */
const h = vi.hoisted(() => {
  const state: { queue: unknown[][]; calls: number; reject: boolean } = {
    queue: [],
    calls: 0,
    reject: false,
  }
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'having', 'on']) {
    chain[m] = () => chain
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

import {
  computeTrafficLiveSnapshot,
  getTrafficLiveSnapshot,
  __resetTrafficLiveCacheForTest,
} from '../src/services/traffic-stats-service.js'
import {
  computeRelayPoolLiveSnapshot,
  getRelayPoolLiveSnapshot,
  RELAY_POOL_ABNORMAL_MIN_VALUE,
  __resetRelayPoolLiveCacheForTest,
} from '../src/services/relay-pool-stats-service.js'

beforeEach(() => {
  h.state.queue = []
  h.state.calls = 0
  h.state.reject = false
  h.db.select.mockClear()
  __resetTrafficLiveCacheForTest()
  __resetRelayPoolLiveCacheForTest()
})

describe('访客实时快照', () => {
  it('族分解按唯一真人口径折叠,PV/UV 取精确值', async () => {
    // 查询顺序:24h 总计 → 1h 总计 → 24h 按 UA 分组
    h.state.queue = [
      [{ pv: 1000, uv: 42 }],
      [{ pv: 120, uv: 9 }],
      [
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0',
          pv: 300,
          uv: 7,
        },
        { userAgent: 'curl/8.4.0', pv: 700, uv: 30 },
      ],
    ]
    const snap = await computeTrafficLiveSnapshot()
    expect(snap.pv24h).toBe(1000)
    expect(snap.uv24h).toBe(42)
    expect(snap.pv1h).toBe(120)
    expect(snap.uv1h).toBe(9)
    // curl ⇒ cli 族(自动化);Chrome 形态 ⇒ human-browser 族(真人)
    expect(snap.humanPv24h).toBe(300)
    expect(snap.botPv24h).toBe(700)
    expect(snap.families.map((f) => f.family)).toEqual(['cli', 'human-browser'])
    expect(snap.truncated).toBe(false)
    expect(Number.isFinite(snap.computedAtMs)).toBe(true)
  })

  it('查询失败整块上抛,不折成 0(0 会被大屏读成"没人访问")', async () => {
    h.state.reject = true
    await expect(computeTrafficLiveSnapshot()).rejects.toThrow('模拟数据库不可用')
  })

  it('TTL 内多次取快照只打一次 DB;清缓存后重算', async () => {
    h.state.queue = [
      [{ pv: 10, uv: 2 }],
      [{ pv: 1, uv: 1 }],
      [{ userAgent: 'curl/8.4.0', pv: 10, uv: 2 }],
    ]
    const first = await getTrafficLiveSnapshot()
    const callsAfterFirst = h.state.calls
    expect(callsAfterFirst).toBe(3)
    const second = await getTrafficLiveSnapshot()
    expect(h.state.calls).toBe(callsAfterFirst) // 命中缓存,零新查询
    expect(second.pv24h).toBe(first.pv24h)
    expect(second.computedAtMs).toBe(first.computedAtMs)
  })

  it('TTL=0 时强制重算(证明缓存不是"永久")', async () => {
    h.state.queue = [
      [{ pv: 10, uv: 2 }],
      [{ pv: 1, uv: 1 }],
      [{ userAgent: 'curl/8.4.0', pv: 10, uv: 2 }],
    ]
    await getTrafficLiveSnapshot('api_logs', 0)
    const before = h.state.calls
    h.state.queue = [
      [{ pv: 11, uv: 3 }],
      [{ pv: 2, uv: 1 }],
      [{ userAgent: 'curl/8.4.0', pv: 11, uv: 3 }],
    ]
    const again = await getTrafficLiveSnapshot('api_logs', 0)
    expect(h.state.calls).toBe(before + 3)
    expect(again.pv24h).toBe(11)
  })
})

describe('号池实时快照', () => {
  it('可调度 / 异常 / 脏值三处口径与 gauge 侧同一把尺子', async () => {
    h.state.queue = [
      // key 池
      [
        {
          healthStatus: 'healthy',
          isEnabled: true,
          tempUnschedulable: false,
          healthCheckedAt: null,
        },
        {
          healthStatus: 'degraded',
          isEnabled: true,
          tempUnschedulable: false,
          healthCheckedAt: null,
        },
        { healthStatus: 'down', isEnabled: true, tempUnschedulable: false, healthCheckedAt: null },
        {
          healthStatus: 'healthy',
          isEnabled: false,
          tempUnschedulable: false,
          healthCheckedAt: null,
        },
        {
          healthStatus: 'not-a-state',
          isEnabled: true,
          tempUnschedulable: false,
          healthCheckedAt: null,
        },
      ],
      // 账号池
      [
        {
          healthStatus: 'healthy',
          isEnabled: true,
          tempUnschedulable: false,
          consecutiveFailures: 0,
          totalCalls: 5,
          tokenExpiresAt: new Date(Date.now() + 3_600_000),
          lastRefreshAt: new Date(Date.now() - 120_000),
        },
        {
          healthStatus: 'down',
          isEnabled: true,
          tempUnschedulable: true,
          consecutiveFailures: 3,
          totalCalls: 1,
          tokenExpiresAt: new Date(Date.now() - 60_000),
          lastRefreshAt: new Date(Date.now() - 600_000),
        },
      ],
    ]
    const snap = await computeRelayPoolLiveSnapshot()
    expect(snap.keyTotal).toBe(5)
    // 启用的 4 条(含脏值那条,它按"健康态无法判定"只计脏值,不参与可调度/异常)
    expect(snap.keySchedulable).toBe(3)
    expect(snap.keyAbnormal).toBe(2) // degraded + down
    expect(RELAY_POOL_ABNORMAL_MIN_VALUE).toBe(2)
    expect(snap.rowsUnclassified).toBe(1)
    expect(snap.accountsTotal).toBe(2)
    expect(snap.accountsSchedulable).toBe(1) // 第二条被 tempUnschedulable 摘掉
    // 最短临期取的是已过期那条(负值必须原样报出,不能钳 0)
    expect(snap.minTokenExpiresInSeconds).toBeLessThan(0)
    expect(snap.maxRefreshAgeSeconds).toBeGreaterThanOrEqual(590)
  })

  it('查询失败上抛,不返回"空池"', async () => {
    h.state.reject = true
    await expect(computeRelayPoolLiveSnapshot()).rejects.toThrow('模拟数据库不可用')
  })

  it('TTL 内复用同一份快照', async () => {
    h.state.queue = [[], []]
    const a = await getRelayPoolLiveSnapshot()
    const callsAfter = h.state.calls
    const b = await getRelayPoolLiveSnapshot()
    expect(h.state.calls).toBe(callsAfter)
    expect(b.computedAtMs).toBe(a.computedAtMs)
    expect(a.keyTotal).toBe(0)
  })
})
