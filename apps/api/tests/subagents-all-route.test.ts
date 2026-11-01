// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-G02 2026-11-01
/**
 * G-02① 回归锁:GET /api/subagents/all 的「全量 / 分页 / 租户」口径(2026-11-01,S-G02)。
 *
 * 背景:该路由由 G-299① 首次落地(只有单值 status + 无上界 limit + 无 offset、无租户维度),
 * 本票把口径收口成 routes/subagent-dispatch.ts 文件头的纯函数,并在此钉住:
 *  ① 全量:五态(pending/running/completed/failed/cancelled)全回;`/active` 只回 pending/running
 *     —— 两者的口径必须**真的不同**(客户端改道 active 会把"页面少了历史"写成"已修")。
 *  ② status 过滤:单值 / 逗号多值 / 重复参数三种写法;未知字面量 ⇒ 空(不退化成"不过滤")。
 *  ③ limit 上界:超上界夹到 500(不 400);非法 limit ⇒ 默认页大小。
 *  ④ offset 分页:窗口切在「新→旧」序上,total 是分页前计数。
 *  ⑤ 租户隔离:别人的派遣不出现;无归属记录按「未标注」照旧公开(不隐藏历史)。
 *  ⑥ 归属只从鉴权结果注入:请求体自报 ownerUserId 被 Zod 剥掉,不构成越权。
 *
 * 判据全部引生产源(§22c):状态集/夹取/可见性直接 import 路由文件的具名纯函数,
 * 不在测试里另抄一份。全程不连库不发网络(vi.mock service + auth)。
 * 反向例(实测):把 /all 的实现退回 `listActive()`(只 pending/running)⇒ ① 立即变红,
 * 读数见 .ihui-agent/seats/S-G02.md。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

const { listAllMock, listActiveMock, dispatchMock } = vi.hoisted(() => ({
  listAllMock: vi.fn(),
  listActiveMock: vi.fn(),
  dispatchMock: vi.fn(),
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    listAll: () => listAllMock(),
    listActive: () => listActiveMock(),
    // 列表形状用例不测 metrics:按 buildFleetRow 契约,stats 缺位 ⇒ 行不带 metrics
    getDispatchStats: () => null,
    getDag: () => null,
    dispatch: (input: Record<string, unknown>) => dispatchMock(input),
  },
}))
vi.mock('../src/db/agent-queries.js', () => ({ findAgentTasksByAgentId: async () => [] }))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
import {
  SUBAGENTS_ALL_MAX_LIMIT,
  SUBAGENTS_ALL_DEFAULT_LIMIT,
} from '../src/routes/subagent-dispatch.js'

/** 造一条派单行(只填列表口径用到的字段) */
function row(
  id: string,
  status: string,
  createdAt: string,
  ownerUserId?: string,
): Record<string, unknown> {
  return {
    id,
    goal: `goal-${id}`,
    status,
    affectedFiles: ['a.ts'],
    verifyCommands: [],
    constraints: 'c',
    deliverables: 'd',
    createdAt,
    updatedAt: createdAt,
    ...(ownerUserId ? { ownerUserId } : {}),
  }
}

let app: FastifyInstance

beforeEach(async () => {
  // listActive mock 复刻 service.listActive 的真谓词(pending/running,升序)——
  // 真实 service 的 listActive 只在这两个状态上成立(见 subagent-dispatch-service.ts:2207)。
  listActiveMock.mockImplementation(() =>
    listAllMock()
      .filter((d: { status: string }) => d.status === 'pending' || d.status === 'running')
      .slice()
      .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
  )
  listAllMock.mockReturnValue([])
  dispatchMock.mockReset()
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  listAllMock.mockReset()
  listActiveMock.mockReset()
})

const ALL = {
  pending: '2026-11-01T01:00:00Z',
  running: '2026-11-01T02:00:00Z',
  completed: '2026-11-01T03:00:00Z',
  failed: '2026-11-01T04:00:00Z',
  cancelled: '2026-11-01T05:00:00Z',
} as const

function seedFiveStatuses(): void {
  listAllMock.mockReturnValue([
    row('d-pending', 'pending', ALL.pending),
    row('d-running', 'running', ALL.running),
    row('d-completed', 'completed', ALL.completed),
    row('d-failed', 'failed', ALL.failed),
    row('d-cancelled', 'cancelled', ALL.cancelled),
  ])
}

describe('G-02① GET /api/subagents/all — 全量 vs /active 子集', () => {
  it('五种状态全回(新→旧);/active 只回 pending/running(两端口径必须真的不同)', async () => {
    seedFiveStatuses()

    const all = await app.inject({ method: 'GET', url: '/api/subagents/all' })
    expect(all.statusCode).toBe(200)
    const allBody = all.json()
    expect(allBody.code).toBe(0)
    expect(allBody.data.dispatches.map((d: { id: string }) => d.id)).toEqual([
      'd-cancelled',
      'd-failed',
      'd-completed',
      'd-running',
      'd-pending',
    ])
    expect(new Set(allBody.data.dispatches.map((d: { status: string }) => d.status))).toEqual(
      new Set(['pending', 'running', 'completed', 'failed', 'cancelled']),
    )
    expect(allBody.data.total).toBe(5)

    const active = await app.inject({ method: 'GET', url: '/api/subagents/active' })
    expect(active.statusCode).toBe(200)
    const activeBody = active.json()
    expect(activeBody.data.dispatches.map((d: { id: string }) => d.id)).toEqual([
      'd-pending',
      'd-running',
    ])
    // 对照:active 少了三种终态 —— 客户端改道 active 就必然丢历史
    expect(activeBody.data.dispatches).toHaveLength(2)
    expect(allBody.data.dispatches.length).toBeGreaterThan(activeBody.data.dispatches.length)
  })
})

describe('G-02① status 过滤', () => {
  it('单值 / 逗号多值 / 重复参数三种写法同义', async () => {
    seedFiveStatuses()

    const single = await app.inject({ method: 'GET', url: '/api/subagents/all?status=completed' })
    expect(single.json().data.dispatches.map((d: { id: string }) => d.id)).toEqual(['d-completed'])

    const csv = await app.inject({
      method: 'GET',
      url: '/api/subagents/all?status=failed,cancelled',
    })
    expect(csv.json().data.dispatches.map((d: { id: string }) => d.id)).toEqual([
      'd-cancelled',
      'd-failed',
    ])

    const repeat = await app.inject({
      method: 'GET',
      url: '/api/subagents/all?status=failed&status=cancelled',
    })
    expect(repeat.json().data.dispatches.map((d: { id: string }) => d.id)).toEqual([
      'd-cancelled',
      'd-failed',
    ])
    // total 跟过滤后口径走(不是全量 5)
    expect(repeat.json().data.total).toBe(2)
  })

  it('未知字面量 ⇒ 空集(不退化成"不过滤"把全量当筛选结果交回)', async () => {
    seedFiveStatuses()
    const res = await app.inject({ method: 'GET', url: '/api/subagents/all?status=bogus' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.dispatches).toEqual([])
    expect(res.json().data.total).toBe(0)
  })
})

describe('G-02① limit 上界与 offset 分页', () => {
  it('limit 超上界夹到 SUBAGENTS_ALL_MAX_LIMIT(不 400,不拉全表)', async () => {
    const rows = Array.from({ length: SUBAGENTS_ALL_MAX_LIMIT + 100 }, (_, i) =>
      row(`r-${i}`, 'completed', new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString()),
    )
    listAllMock.mockReturnValue(rows)

    const res = await app.inject({ method: 'GET', url: '/api/subagents/all?limit=999999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.dispatches).toHaveLength(SUBAGENTS_ALL_MAX_LIMIT)
    expect(body.data.total).toBe(rows.length)
  })

  it('非法/缺省 limit ⇒ 默认页大小(有界)', async () => {
    const rows = Array.from({ length: SUBAGENTS_ALL_DEFAULT_LIMIT + 10 }, (_, i) =>
      row(`r-${i}`, 'completed', new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString()),
    )
    listAllMock.mockReturnValue(rows)

    for (const qs of ['', '?limit=0', '?limit=-5', '?limit=abc']) {
      const res = await app.inject({ method: 'GET', url: `/api/subagents/all${qs}` })
      expect(res.json().data.dispatches).toHaveLength(SUBAGENTS_ALL_DEFAULT_LIMIT)
    }
  })

  it('offset 在"新→旧"序上切窗口,total 为分页前计数', async () => {
    seedFiveStatuses()
    const res = await app.inject({ method: 'GET', url: '/api/subagents/all?limit=2&offset=2' })
    const body = res.json()
    expect(body.data.dispatches.map((d: { id: string }) => d.id)).toEqual([
      'd-completed',
      'd-running',
    ])
    expect(body.data.total).toBe(5)

    const beyond = await app.inject({ method: 'GET', url: '/api/subagents/all?offset=99' })
    expect(beyond.json().data.dispatches).toEqual([])
    expect(beyond.json().data.total).toBe(5)
  })
})

describe('G-02① 租户隔离', () => {
  it('别人(tenant-b)的派遣不出现,自己的都在;无归属记录按「未标注」照旧公开', async () => {
    listAllMock.mockReturnValue([
      row('mine-1', 'completed', '2026-11-01T01:00:00Z', 'tenant-a'),
      row('theirs-1', 'completed', '2026-11-01T02:00:00Z', 'tenant-b'),
      row('theirs-2', 'running', '2026-11-01T03:00:00Z', 'tenant-b'),
      row('legacy', 'failed', '2026-11-01T04:00:00Z'),
    ])

    const mine = await app.inject({
      method: 'GET',
      url: '/api/subagents/all',
      headers: { 'x-probe-user': 'tenant-a' },
    })
    const ids = mine.json().data.dispatches.map((d: { id: string }) => d.id)
    expect(ids).toContain('mine-1')
    expect(ids).not.toContain('theirs-1')
    expect(ids).not.toContain('theirs-2')
    expect(ids).toContain('legacy')

    // 反向视角:tenant-b 看得到自己的,看不到 tenant-a 的
    const theirs = await app.inject({
      method: 'GET',
      url: '/api/subagents/all',
      headers: { 'x-probe-user': 'tenant-b' },
    })
    const theirIds = theirs.json().data.dispatches.map((d: { id: string }) => d.id)
    expect(theirIds).toEqual(['legacy', 'theirs-2', 'theirs-1'])
    expect(theirIds).not.toContain('mine-1')
  })

  it('归属只从鉴权结果注入:请求体自报 ownerUserId 被剥掉', async () => {
    dispatchMock.mockResolvedValue({
      dispatch: row('d-new', 'pending', '2026-11-01T06:00:00Z', 'tenant-a'),
      outcome: 'ok',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/dispatch',
      headers: { 'x-probe-user': 'tenant-a' },
      payload: {
        goal: 'g',
        affectedFiles: ['a.ts'],
        verifyCommands: [],
        constraints: 'c',
        deliverables: 'd',
        // 伪造:客户端自报成别的租户
        ownerUserId: 'tenant-b',
      },
    })
    expect(res.statusCode).toBe(200)
    const passed = dispatchMock.mock.calls[0]![0] as Record<string, unknown>
    expect(passed.ownerUserId).toBe('tenant-a')
  })
})

describe('G-02① 口径纯函数(直接引源,不另抄一份)', () => {
  it('parseDispatchStatusFilter:未传 ⇒ null(不过滤);全非法 ⇒ 空数组(必空结果)', async () => {
    const { parseDispatchStatusFilter } = await import('../src/routes/subagent-dispatch.js')
    expect(parseDispatchStatusFilter(undefined)).toBeNull()
    expect(parseDispatchStatusFilter('   ')).toBeNull()
    expect(parseDispatchStatusFilter('bogus')).toEqual([])
    expect(parseDispatchStatusFilter('completed,failed')).toEqual(['completed', 'failed'])
    expect(parseDispatchStatusFilter(['completed', 'failed'])).toEqual(['completed', 'failed'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
