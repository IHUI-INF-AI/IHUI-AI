// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-ACTIVE 2026-11-01

/**
 * 回归锁:GET /api/subagents/active 的跨租户可见性(2026-11-01,S-ACTIVE)。
 *
 * 背景(S-G02 收尾残余原话):「/subagents/active 仍无租户过滤(禁改其语义),跨租户越权面仍在」。
 * 前序席位只给 /all 补了 isDispatchVisibleTo,刻意没动 /active。本票单独修 /active 的**越权**:
 *  - 定性 = 数据越权(不是纯字段泄露,也不是 fail-open 落进所有人列表):记录自 2026-11-01 起带
 *    ownerUserId(service buildDispatch 从 request.userId 注入),但 /active 直接 listActive() 全量返回,
 *    A 的 pending/running 派单连同 goal/affectedFiles/constraints/deliverables 一起被 B 读到。
 *  - 修法 = 复用 /all 的 isDispatchVisibleTo(同源一份,§22c),放在**路由层**;
 *    service.listActive 仍是并发上限的计数口径,不按租户过滤(那是另一张票的语义变更)。
 *
 * 判据(每条都有反向例,见文件尾「反向例」注释与 .ihui-agent/seats/S-ACTIVE.md 的实测读数):
 *  ① A 请求 /active 只看到 A 的 pending/running;B 的同理(双向断言,不只看一侧)。
 *  ② 语义未变:/active 仍只 pending/running —— 同租户塞入 completed/failed/cancelled 不得出现。
 *  ③ 无归属记录(ownerUserId 缺失)⇒ **fail-closed**(2026-11-02 归属回填与 fail-open 收敛):
 *     普通用户在 /active 与 /all 都看不到,仅系统管理员可见;回填成功的记录回到「本人可见」。
 *  ④ 反向例:删掉路由里的租户 filter ⇒ ① 变红(实测读数在 seat)。
 *  ⑤ 反向例:把 isActiveDispatchStatus 放宽成恒真 ⇒ ② 变红(本文件的 listActive mock 直接
 *     引这个生产谓词,故谓词一放宽,② 立刻收进 completed/failed)。
 *
 * 全程不连库不发网络(vi.mock service + auth);判据引生产源,不在测试里另抄一份。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/**
 * 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a);
 * x-probe-role=1 时同时注入 jwtPayload.roleId,供 isAdminViewer 判管理面(2026-11-02 fail-closed)
 */
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: {
    userId?: string
    jwtPayload?: { roleId?: number }
    headers: Record<string, unknown>
  }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
    const role = request.headers['x-probe-role']
    request.jwtPayload = typeof role === 'string' ? { roleId: Number(role) } : undefined
  },
  checkAuth: async () => true,
}))

const { listAllMock, listActiveMock } = vi.hoisted(() => ({
  listAllMock: vi.fn(),
  listActiveMock: vi.fn(),
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    listAll: () => listAllMock(),
    listActive: () => listActiveMock(),
    getDispatchStats: () => null,
    getDag: () => null,
  },
}))
vi.mock('../src/db/agent-queries.js', () => ({ findAgentTasksByAgentId: async () => [] }))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
// 生产谓词直接引源(§22c):活性语义只有一份,放宽它 ② 就红
import { isActiveDispatchStatus } from '../src/utils/dispatch-status.js'

/** 造一条派单行(只填 /active 口径用到的字段;ownerUserId 缺省 ⇒ 记录上没有该字段) */
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
  // listActive mock 用**生产谓词**复刻 service.listActive(pending/running,升序)——
  // 谓词被放宽成"全状态"时,② 会立刻变红(反向例 ⑤)。
  listActiveMock.mockImplementation(() =>
    listAllMock()
      .filter((d: { status: string }) => isActiveDispatchStatus(d.status))
      .slice()
      .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
  )
  listAllMock.mockReturnValue([])
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  listAllMock.mockReset()
  listActiveMock.mockReset()
})

async function getActiveAs(headers: Record<string, string>) {
  const res = await app.inject({
    method: 'GET',
    url: '/api/subagents/active',
    headers,
  })
  expect(res.statusCode).toBe(200)
  const body = res.json()
  expect(body.code).toBe(0)
  return body.data.dispatches as Array<Record<string, unknown>>
}

async function getActive(asTenant: string) {
  return getActiveAs({ 'x-probe-user': asTenant })
}

const asAdmin = { 'x-probe-user': 'tenant-admin', 'x-probe-role': '1' }

const ids = (rows: Array<Record<string, unknown>>) => rows.map((d) => d.id)

describe('S-ACTIVE ① /active 跨租户不可见', () => {
  it('A 只看得到 A 的活跃派单;B 的同理(双向)', async () => {
    listAllMock.mockReturnValue([
      row('a-pending', 'pending', '2026-11-01T01:00:00Z', 'tenant-a'),
      row('a-running', 'running', '2026-11-01T02:00:00Z', 'tenant-a'),
      row('b-pending', 'pending', '2026-11-01T03:00:00Z', 'tenant-b'),
      row('b-running', 'running', '2026-11-01T04:00:00Z', 'tenant-b'),
    ])

    const mine = await getActive('tenant-a')
    expect(ids(mine)).toEqual(['a-pending', 'a-running'])
    // 不只是 id:B 的记录整条不能出现在 A 的载荷里(goal 也是跨租户内容)
    expect(JSON.stringify(mine)).not.toContain('goal-b-pending')
    expect(mine.every((d) => d.ownerUserId !== 'tenant-b')).toBe(true)

    const theirs = await getActive('tenant-b')
    expect(ids(theirs)).toEqual(['b-pending', 'b-running'])
    expect(JSON.stringify(theirs)).not.toContain('goal-a-pending')
    expect(theirs.every((d) => d.ownerUserId !== 'tenant-a')).toBe(true)

    // 显式钉住"没加过滤前的读数"长什么样:全量 4 条 —— ④ 的回退就是回到这个读数
    expect(listActiveMock()).toHaveLength(4)
  })

  it('租户只认鉴权结果:?userId=tenant-b 之类的自报参数不改变可见集', async () => {
    listAllMock.mockReturnValue([
      row('a-pending', 'pending', '2026-11-01T01:00:00Z', 'tenant-a'),
      row('b-pending', 'pending', '2026-11-01T02:00:00Z', 'tenant-b'),
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/active?userId=tenant-b&ownerUserId=tenant-b',
      headers: { 'x-probe-user': 'tenant-a' },
    })
    expect(res.statusCode).toBe(200)
    expect(ids(res.json().data.dispatches)).toEqual(['a-pending'])
  })
})

describe('S-ACTIVE ② /active 语义未变:只回 pending/running', () => {
  it('同租户塞入五种状态 ⇒ 只回 pending/running(终态一个都不许出现)', async () => {
    listAllMock.mockReturnValue([
      row('a-pending', 'pending', '2026-11-01T01:00:00Z', 'tenant-a'),
      row('a-running', 'running', '2026-11-01T02:00:00Z', 'tenant-a'),
      row('a-completed', 'completed', '2026-11-01T03:00:00Z', 'tenant-a'),
      row('a-failed', 'failed', '2026-11-01T04:00:00Z', 'tenant-a'),
      row('a-cancelled', 'cancelled', '2026-11-01T05:00:00Z', 'tenant-a'),
    ])

    const active = await getActive('tenant-a')
    expect(ids(active)).toEqual(['a-pending', 'a-running'])
    expect(active.every((d) => isActiveDispatchStatus(String(d.status)))).toBe(true)

    // 对照:/all 同租户回 5 条 —— 两端口径必须真的不同(客户端改道 active 就丢历史)
    const all = await app.inject({
      method: 'GET',
      url: '/api/subagents/all',
      headers: { 'x-probe-user': 'tenant-a' },
    })
    expect(all.json().data.dispatches).toHaveLength(5)
    expect(active).toHaveLength(2)
  })
})

describe('S-ACTIVE ③ 无归属记录(ownerUserId 缺失):fail-closed(仅管理面)', () => {
  it('普通用户在 /active 与 /all 都看不到;系统管理员看得到(同源同判)', async () => {
    listAllMock.mockReturnValue([
      row('a-pending', 'pending', '2026-11-01T01:00:00Z', 'tenant-a'),
      // 2026-11-01 ownerUserId 落地前的在途记录 / Redis 旧 hash(读回时 '' → undefined)
      row('legacy-pending', 'pending', '2026-11-01T02:00:00Z'),
    ])

    const mine = await getActive('tenant-a')
    expect(ids(mine)).toEqual(['a-pending'])

    // 无归属记录不再对任何普通租户公开(2026-11-02 fail-closed)
    const theirs = await getActive('tenant-b')
    expect(ids(theirs)).toEqual([])

    // 管理面只多出「无归属/orphan」这一档:带 owner 的记录仍只对属主可见(管理面不跨租户读)
    const admin = await getActiveAs(asAdmin)
    expect(ids(admin)).toEqual(['legacy-pending'])

    // 与 /all 同判:同一批记录,普通用户两边都看不到 legacy;管理员两边都只看得到 legacy
    const allB = await app.inject({
      method: 'GET',
      url: '/api/subagents/all',
      headers: { 'x-probe-user': 'tenant-b' },
    })
    expect(ids(allB.json().data.dispatches)).toEqual([])

    const allAdmin = await app.inject({
      method: 'GET',
      url: '/api/subagents/all',
      headers: asAdmin,
    })
    expect(ids(allAdmin.json().data.dispatches)).toEqual(['legacy-pending'])
  })
})

/**
 * 反向例(实测步骤;读数见 .ihui-agent/seats/S-ACTIVE.md「反向例实测」节):
 *  ④ 把 /active 路由里的 `.filter((d) => isDispatchVisibleTo(d, userId))` 删掉 ⇒ ① 红:
 *     expect(ids(mine)).toEqual(['a-pending','a-running']) 收到 4 条(含 tenant-b 的两条)。
 *  ⑤ 把 utils/dispatch-status.ts 的 isActiveDispatchStatus 改成恒真 ⇒ ② 红:
 *     /active 收到 5 条(含 completed/failed/cancelled),且 active.every(...) 断言不成立。
 * 两条都在原地跑过(改 → run → 改回),不是纸面声明。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
