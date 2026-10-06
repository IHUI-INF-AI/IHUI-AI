// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * user_browse_history 三端点(2026-10-04新增)。
 *
 * 背景:`/member/history` 页 GET/DELETE 打的 /api/browse-history 两端点此前都不存在(死按钮),
 * 且仓里没有浏览历史表。本文件钉住三件事,每一件都有对应的"退回即翻红"构造:
 *
 *  ① **归属过滤** —— 列表端点漏掉 userId 条件就是跨用户数据泄露,而"返回 200 + 有 list"
 *     这类断言对它是全绿。故照member-list-endpoints.test.ts 的桩法:**桩掉 drizzle-orm
 *     算子并把实参录下来**,直接断言"过滤列就是本表 userId 列、比较值就是本次请求的
 *     request.userId",且**列表与 count 两条查询都要过滤**(只断言"至少一次"会被
 *     "列表那条漏了、count 那条还在"蒙过去)。
 *  ② **物理全清只删自己** —— DELETE 漏掉 where 就是把**全表**删光。
 *  ③ **visit 幂等** —— 复合唯一 (user_id,target_id,target_type) + onConflictDoUpdate:
 *     同一 target 重复上报必须走冲突分支只刷 visited_at,**不产生第二行**。
 *     断言钉在 onConflictDoUpdate 的实参上(冲突目标列 + set 里动了 visitedAt),
 *     退回成普通 insert(不传 onConflictDoUpdate)本用例立刻翻红。
 *
 * 测试隔离铁律(AGENTS §5):全程不连真实 PostgreSQL —— db 层整体桩掉,不触库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, dbQueue, eqCalls, onConflictArgs, valuesArgs } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
  // 录下每次 eq(左列, 右值) 的实参 —— 归属过滤的判据就钉在这里
  eqCalls: [] as { left: unknown; right: unknown }[],
  // 录下 onConflictDoUpdate 的实参 —— visit 幂等地基的判据
  onConflictArgs: [] as { target: unknown[]; set: Record<string, unknown> }[],
  // 录下 insert().values() 的实参
  valuesArgs: [] as Record<string, unknown>[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 算子桩:不真正执行 SQL,但把"过滤了哪一列 / 跟谁比"如实录下来。
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left: unknown, right: unknown) => {
    eqCalls.push({ left, right })
    return { op: 'eq', left, right }
  }),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
  sql: Object.assign(
    vi.fn((strs: TemplateStringsArray, ...vals: unknown[]) => ({
      op: 'sql',
      text: String(strs),
      vals,
    })),
    { raw: (c: unknown) => c },
  ),
  count: vi.fn(() => ({ op: 'count' })),
  sum: vi.fn(() => ({ op: 'sum' })),
}))

// @ihui/database **部分**桩:other 路由 barrel 会牵进大量无关表(它们 import 期就读列),
// 整表桩掉会炸在 promotion-queries 之类的地方 ⇒ 这里只把本批要断言的那张表换成
// 可辨识的字符串列名,其余原样放行。字符串列名的用意:让"过滤的是不是 userId 列"
// 能逐字断言,而不是"两个 Proxy 长得像"。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    userBrowseHistory: {
      id: 'user_browse_history.id',
      userId: 'user_browse_history.userId',
      targetId: 'user_browse_history.targetId',
      targetType: 'user_browse_history.targetType',
      title: 'user_browse_history.title',
      visitedAt: 'user_browse_history.visitedAt',
      metadata: 'user_browse_history.metadata',
    },
  }
})

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'set',
      'returning',
      'innerJoin',
      'leftJoin',
      'select',
      'groupBy',
    ]) {
      chain[m] = () => chain
    }
    // insert().values(...) 与 onConflictDoUpdate(...) 单独录实参
    chain.values = (v: Record<string, unknown>) => {
      valuesArgs.push(v)
      return chain
    }
    chain.onConflictDoUpdate = (cfg: { target: unknown[]; set: Record<string, unknown> }) => {
      onConflictArgs.push(cfg)
      return chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
    transaction: vi.fn(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

const PREFIX = '/api'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER = '00000000-0000-4000-8000-0000000000ff'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

function historyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    userId: USER_ID,
    targetId: '22222222-2222-4222-8222-222222222222',
    targetType: 'post',
    title: '某篇文章',
    visitedAt: new Date('2026-10-04T10:00:00Z'),
    ...overrides,
  }
}

describe('user_browse_history 三端点(此前 /api/browse-history 全不存在)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items.length = 0
    eqCalls.length = 0
    onConflictArgs.length = 0
    valuesArgs.length = 0
    mockAuthenticate.mockReset()
  })

  // =========================================================================
  // ① GET /api/browse-history
  // =========================================================================

  describe('① GET /api/browse-history — 列表', () => {
    it('未登录 → 401,且不查库', async () => {
      mockUnauthed()
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/browse-history` })
      expect(res.statusCode).toBe(401)
      expect(eqCalls).toHaveLength(0)
    })

    it('端点存在:登录后 200 且返回 {list,total,page,pageSize}', async () => {
      mockAuthed()
      enqueue([historyRow()], [{ count: 1 }])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/browse-history` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page')
      expect(body.data).toHaveProperty('pageSize')
      expect(Array.isArray(body.data.list)).toBe(true)
    })

    it('字段名是 targetType/targetId(不是 resourceType/resourceId)', async () => {
      mockAuthed()
      enqueue([historyRow()], [{ count: 1 }])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/browse-history` })
      const item = res.json().data.list[0]
      // 与共享契约 BookmarkItem(packages/types/src/app-engagement.ts;2026-10-04 起 app.ts 拆为业务域文件,
      // 该类型现住在 app-engagement.ts —— §1 禁写行号,按类型名定位)对齐
      expect(item.targetType).toBe('post')
      expect(item.targetId).toBe('22222222-2222-4222-8222-222222222222')
      // 旧名不许残留 —— 残留会让前端 member/history 页拿到 undefined
      expect(item).not.toHaveProperty('resourceType')
      expect(item).not.toHaveProperty('resourceId')
    })

    it('归属过滤:where 命中 user_browse_history.userId 且值 === request.userId', async () => {
      mockAuthed(USER_ID)
      enqueue([historyRow()], [{ count: 1 }])
      await server.inject({ method: 'GET', url: `${PREFIX}/browse-history` })

      const onUserId = eqCalls.filter((c) => c.left === 'user_browse_history.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
      // 反向:任何一次都不许拿 userId 列去比一个不是本请求用户的值
      expect(eqCalls.filter((c) => c.left === 'user_browse_history.userId' && c.right !== USER_ID))
        .toHaveLength(0)
      // **条数**也钉住:本端点发两条查询(列表 + count),两条都要过滤。
      // 变异验证:删掉列表的 where 后本用例仍绿,因为 count 的 eq 顶了数 ——
      // 所以这里断的是"恰好两次且都是本用户",不是"至少一次"。
      expect(onUserId).toHaveLength(2)
    })

    it('归属过滤对每个登录用户都成立(换用户即换比较值)', async () => {
      mockAuthed(OTHER_USER)
      enqueue([historyRow({ userId: OTHER_USER })], [{ count: 1 }])
      await server.inject({ method: 'GET', url: `${PREFIX}/browse-history` })
      const onUserId = eqCalls.filter((c) => c.left === 'user_browse_history.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === OTHER_USER)).toBe(true)
    })

    it('分页参数越界 → 400', async () => {
      mockAuthed()
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/browse-history?pageSize=999` })
      expect(res.statusCode).toBe(400)
    })
  })

  // =========================================================================
  // ② DELETE /api/browse-history
  // =========================================================================

  describe('② DELETE /api/browse-history — 物理全清当前用户', () => {
    it('未登录 → 401,且不查库', async () => {
      mockUnauthed()
      const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/browse-history` })
      expect(res.statusCode).toBe(401)
      expect(eqCalls).toHaveLength(0)
    })

    it('端点存在:返回 {deletedCount}(前端"清空"按钮读它)', async () => {
      mockAuthed()
      enqueue([{ id: 'a' }, { id: 'b' }])
      const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/browse-history` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deletedCount).toBe(2)
    })

    it('全清必须带 userId 条件(漏了就是删光全表)', async () => {
      mockAuthed(USER_ID)
      enqueue([])
      await server.inject({ method: 'DELETE', url: `${PREFIX}/browse-history` })
      // 变异验证:把 where 整条删掉 → 本用例立刻红(下界 0)
      const onUserId = eqCalls.filter((c) => c.left === 'user_browse_history.userId')
      expect(onUserId).toHaveLength(1)
      expect(onUserId[0]?.right).toBe(USER_ID)
    })

    it('清空只删自己那一份(换用户即换比较值)', async () => {
      mockAuthed(OTHER_USER)
      enqueue([])
      await server.inject({ method: 'DELETE', url: `${PREFIX}/browse-history` })
      const onUserId = eqCalls.filter((c) => c.left === 'user_browse_history.userId')
      expect(onUserId).toHaveLength(1)
      expect(onUserId[0]?.right).toBe(OTHER_USER)
    })
  })

  // =========================================================================
  // ③ POST /api/browse-history/visit(幂等是本用例的核心)
  // =========================================================================

  describe('③ POST /api/browse-history/visit — 上报(upsert,重复上报不产生第二行)', () => {
    const VISIT = {
      method: 'POST' as const,
      url: `${PREFIX}/browse-history/visit`,
      payload: { targetType: 'post', targetId: '22222222-2222-4222-8222-222222222222', title: 'T' },
    }

    it('未登录 → 401,且不写库', async () => {
      mockUnauthed()
      const res = await server.inject(VISIT)
      expect(res.statusCode).toBe(401)
      expect(valuesArgs).toHaveLength(0)
    })

    it('落库行的 userId 取自 request.userId(不是硬编码/不是入参)', async () => {
      mockAuthed(USER_ID)
      enqueue([{ id: 'x', visitedAt: new Date() }])
      const res = await server.inject(VISIT)
      expect(res.statusCode).toBe(200)
      expect(valuesArgs).toHaveLength(1)
      expect(valuesArgs[0]?.userId).toBe(USER_ID)
      // 归属只能来自登录态,绝不能允许 body 覆盖 ⇒ 入参里没有 userId
      expect(Object.keys(VISIT.payload)).not.toContain('userId')
    })

    it('写入的 targetType/targetId 与上报一致', async () => {
      mockAuthed()
      enqueue([{ id: 'x', visitedAt: new Date() }])
      await server.inject(VISIT)
      expect(valuesArgs[0]?.targetType).toBe('post')
      expect(valuesArgs[0]?.targetId).toBe('22222222-2222-4222-8222-222222222222')
      expect(valuesArgs[0]?.title).toBe('T')
    })

    it('幂等地基:走 onConflictDoUpdate,冲突目标正是那三列复合唯一', async () => {
      mockAuthed()
      enqueue([{ id: 'x', visitedAt: new Date() }])
      await server.inject(VISIT)
      // 退回成普通 insert(删掉 .onConflictDoUpdate)⇒ 本用例立刻红
      expect(onConflictArgs).toHaveLength(1)
      const cfg = onConflictArgs[0]!
      // 顺序即建表的 UNIQUE(user_id, target_id, target_type)
      expect(cfg.target).toEqual([
        'user_browse_history.userId',
        'user_browse_history.targetId',
        'user_browse_history.targetType',
      ])
      // 冲突分支必须刷 visited_at —— 这正是"重复上报只更新时间"的落点
      expect(Object.keys(cfg.set)).toContain('visitedAt')
    })

    it('重复上报同一 target:两次都走冲突分支,不产生第二行', async () => {
      mockAuthed()
      enqueue(
        [{ id: 'x', visitedAt: new Date('2026-10-04T10:00:00Z') }],
        [{ id: 'x', visitedAt: new Date('2026-10-04T11:00:00Z') }],
      )
      await server.inject(VISIT)
      await server.inject(VISIT)
      // 两次都声明了同一个冲突目标 ⇒ 第二次命中的是同一行,不是新行
      expect(onConflictArgs).toHaveLength(2)
      expect(onConflictArgs[0]?.target).toEqual(onConflictArgs[1]?.target)
      // 且两次插入携带的是同一个 (targetId,targetType) 键
      const keyOf = (v: Record<string, unknown> | undefined) =>
        `${String(v?.targetId)}|${String(v?.targetType)}`
      expect(keyOf(valuesArgs[0])).toBe(keyOf(valuesArgs[1]))
    })

    it('targetType 不在白名单 → 400 且不写库', async () => {
      mockAuthed()
      const res = await server.inject({
        ...VISIT,
        payload: { targetType: 'unknown-kind', targetId: 'abc' },
      })
      expect(res.statusCode).toBe(400)
      expect(valuesArgs).toHaveLength(0)
    })

    it('targetId 含路径分隔符 → 400(不接受 slug 之外的形态)', async () => {
      mockAuthed()
      const res = await server.inject({
        ...VISIT,
        payload: { targetType: 'doc', targetId: '../../etc/passwd' },
      })
      expect(res.statusCode).toBe(400)
      expect(valuesArgs).toHaveLength(0)
    })

    it('doc 这一档的 slug 形态被接受(varchar 而非 uuid 的理由)', async () => {
      mockAuthed()
      enqueue([{ id: 'x', visitedAt: new Date() }])
      const res = await server.inject({
        ...VISIT,
        payload: { targetType: 'doc', targetId: 'rag-intro', title: 'RAG 入门' },
      })
      expect(res.statusCode).toBe(200)
      expect(valuesArgs[0]?.targetId).toBe('rag-intro')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
