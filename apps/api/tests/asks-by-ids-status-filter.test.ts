// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-331(P2)夹具:三个 `by-ids` 批量端点的可见集。
 *
 * 缺陷:GET /asks/question/list/by-ids、GET /asks/answer/list/by-ids、
 * GET /circles/dynamic/list/by-ids 原先只 `inArray(id, ids)` 裸查,不叠加 status=1,
 * 任何登录用户用一串 id 即可枚举读取审核拒绝(status=2/3)与软删(status=-1)的行。
 *
 * 判据:同文件 :880-886 已写明「可见集口径 = status=1」,三个批量读必须同口径;
 * ids 中混入不可见 id 时,响应里只允许出现 status=1 的行。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const {
  AUTH_USER_ID,
  ADMIN_USER_ID,
  mockVerifyAccessToken,
  TABLE_ROWS,
  chainLog,
  ENDPOINTS,
} = vi.hoisted(() => {
  const AUTH_USER_ID = '44444444-4444-4444-8444-444444444444'
  const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555'
  const stamp = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min))
  const q = (n: number) => `11111111-1111-4111-8111-11111111111${n}`
  const a = (n: number) => `22222222-2222-4222-8222-22222222222${n}`
  const p = (n: number) => `33333333-3333-4333-8333-33333333333${n}`

  const TABLE_ROWS = {
    asks: [
      { id: q(1), userId: AUTH_USER_ID, status: 1, title: '可见问题', content: 'visible question', createdAt: stamp(1) },
      { id: q(2), userId: AUTH_USER_ID, status: 2, title: '审核中问题', content: 'pending question', createdAt: stamp(2) },
      { id: q(3), userId: AUTH_USER_ID, status: 3, title: '审核拒绝问题', content: 'rejected question', createdAt: stamp(3) },
      { id: q(4), userId: AUTH_USER_ID, status: -1, title: '已删问题', content: 'deleted question', createdAt: stamp(4) },
    ],
    ask_answers: [
      { id: a(1), userId: AUTH_USER_ID, status: 1, content: 'visible answer', createdAt: stamp(1) },
      { id: a(2), userId: AUTH_USER_ID, status: 3, content: 'rejected answer', createdAt: stamp(2) },
      { id: a(3), userId: AUTH_USER_ID, status: -1, content: 'deleted answer', createdAt: stamp(3) },
    ],
    circle_posts: [
      { id: p(1), userId: AUTH_USER_ID, status: 1, content: 'visible dynamic', createdAt: stamp(1) },
      { id: p(2), userId: AUTH_USER_ID, status: 2, content: 'pending dynamic', createdAt: stamp(2) },
      { id: p(3), userId: AUTH_USER_ID, status: 3, content: 'rejected dynamic', createdAt: stamp(3) },
      { id: p(4), userId: AUTH_USER_ID, status: -1, content: 'deleted dynamic', createdAt: stamp(4) },
    ],
  }

  const ENDPOINTS = [
    {
      label: '问题',
      url: '/api/asks/question/list/by-ids',
      tableName: 'asks' as const,
      visibleId: q(1),
      mixedIds: [q(1), q(2), q(3), q(4)],
      probe: { id: q(1), status: 1, title: '可见问题', content: 'visible question' },
    },
    {
      label: '回答',
      url: '/api/asks/answer/list/by-ids',
      tableName: 'ask_answers' as const,
      visibleId: a(1),
      mixedIds: [a(1), a(2), a(3)],
      probe: { id: a(1), status: 1, content: 'visible answer' },
    },
    {
      label: '圈子动态',
      url: '/api/circles/dynamic/list/by-ids',
      tableName: 'circle_posts' as const,
      visibleId: p(1),
      mixedIds: [p(1), p(2), p(3), p(4)],
      probe: { id: p(1), status: 1, content: 'visible dynamic' },
    },
  ]

  return {
    AUTH_USER_ID,
    ADMIN_USER_ID,
    mockVerifyAccessToken: vi.fn(),
    TABLE_ROWS,
    chainLog: [] as Array<{ table?: unknown; cond?: unknown }>,
    ENDPOINTS,
  }
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn().mockResolvedValue({ ok: true, fields: { content: { text: '' } } }),
}))

vi.mock('../src/services/user-rate-limit.js', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/db/community-queries.js', () => ({
  acceptAnswer: vi.fn(),
  createAnswer: vi.fn(),
  createAsk: vi.fn(),
  deleteAsk: vi.fn(),
  deleteCircle: vi.fn(),
  findAskAnswers: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findAskById: vi.fn().mockResolvedValue(undefined),
  findAsks: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findCircleById: vi.fn().mockResolvedValue(undefined),
  findPostById: vi.fn(),
  updateAsk: vi.fn(),
  updateCircleShowStatus: vi.fn(),
}))

/**
 * select→from→where 记录器 + 以条件为准的行过滤(零真实连接)。
 * `columns.includes('status')` 由路由真发出去的条件还原:旧实现只带 id ⇒ 不加过滤,
 * 新实现带 status ⇒ 只留 status=1。这样红/绿差异来自待测代码,而不是夹具另造语义。
 */
vi.mock('../src/db/index.js', () => {
  function describeCondition(
    node: unknown,
    seen = new Set<unknown>(),
  ): { columns: string[]; params: unknown[] } {
    const acc = { columns: [] as string[], params: [] as unknown[] }
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object' || seen.has(n)) return
      seen.add(n)
      if (Array.isArray(n)) {
        for (const item of n) walk(item)
        return
      }
      const o = n as Record<string, unknown>
      if (typeof o.name === 'string' && typeof o.getSQL === 'function') acc.columns.push(o.name)
      if ((o.constructor as { name?: string } | undefined)?.name === 'Param') acc.params.push(o.value)
      if (Array.isArray(o.queryChunks)) {
        for (const q of o.queryChunks) walk(typeof q === 'function' ? (q as () => unknown)() : q)
      }
    }
    walk(node)
    return acc
  }

  function resultRows(sink: { table?: unknown; cond?: unknown }): unknown[] {
    const tableName = (sink.table as Record<symbol, string> | undefined)?.[
      Symbol.for('drizzle:Name')
    ]
    const rows = (TABLE_ROWS as Record<string, Array<Record<string, unknown>>>)[tableName] ?? []
    const { columns, params } = describeCondition(sink.cond)
    const idParams = params.filter((v): v is string => typeof v === 'string')
    return rows
      .filter((r) => idParams.includes(r.id as string))
      .filter((r) => (columns.includes('status') ? r.status === 1 : true))
      .sort((x, y) => (y.createdAt as Date).getTime() - (x.createdAt as Date).getTime())
  }

  const make = (sink: Record<string, unknown>): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: (table: unknown) => {
        sink.table = table
        return chain
      },
      where: (cond: unknown) => {
        sink.cond = cond
        return chain
      },
      orderBy: () => {
        chainLog.push(sink as { table?: unknown; cond?: unknown })
        return Promise.resolve(resultRows(sink))
      },
      limit: () => chain,
      offset: () => chain,
      leftJoin: () => chain,
    }
    return chain
  }

  return {
    db: {
      select: () => make({}),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: () => make({}) },
    dbClient: {},
  }
})

import asksRoutes from '../src/routes/community/asks.js'

const USER_TOKEN = 'Bearer user-token'
const ADMIN_TOKEN = 'Bearer admin-token'
let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(asksRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  chainLog.length = 0
  mockVerifyAccessToken.mockResolvedValue({
    userId: AUTH_USER_ID,
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
})

function lastReturned(
  res: { json: () => { data?: { list?: Array<Record<string, unknown>> } } },
): Array<{ id: unknown; status: unknown }> {
  const list = res.json().data?.list ?? []
  return list.map((r) => ({ id: r.id, status: r.status }))
}

describe('by-ids 批量端点:可见集 = status=1', () => {
  it('未登录 ⇒ 三个端点均 401 且零查询', async () => {
    for (const ep of ENDPOINTS) {
      const res = await app.inject({
        method: 'GET',
        url: `${ep.url}?ids=${ep.mixedIds.join(',')}`,
      })
      expect(res.statusCode, `${ep.url} 未登录未被闸住`).toBe(401)
    }
    expect(chainLog.length).toBe(0)
  })

  for (const ep of ENDPOINTS) {
    it(`${ep.label} by-ids:ids 混入 status=2/3/-1 时只返回 status=1 行`, async () => {
      const res = await app.inject({
        method: 'GET',
        url: `${ep.url}?ids=${ep.mixedIds.join(',')}`,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const actual = lastReturned(res as never)
      expect(
        actual,
        `已删/拒绝行被读回(旧代码缺陷原文): ${JSON.stringify(actual)}`,
      ).toEqual([{ id: ep.visibleId, status: 1 }])
    })

    it(`${ep.label} by-ids:仅 status=1 的 id 正常返回且字段不变`, async () => {
      const res = await app.inject({
        method: 'GET',
        url: `${ep.url}?ids=${ep.visibleId}`,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const list = res.json().data.list as Array<Record<string, unknown>>
      expect(list).toHaveLength(1)
      expect(Object.keys(list[0]!).sort()).toEqual(Object.keys(TABLE_ROWS[ep.tableName][0]!).sort())
      expect(list[0]).toMatchObject(ep.probe)
    })

    it(`${ep.label} by-ids:缺 ids / 空 ids 保持既有 400`, async () => {
      const missing = await app.inject({
        method: 'GET',
        url: ep.url,
        headers: { authorization: USER_TOKEN },
      })
      expect(missing.statusCode).toBe(400)
      expect(missing.json().code).toBe(400)

      const empty = await app.inject({
        method: 'GET',
        url: `${ep.url}?ids=`,
        headers: { authorization: USER_TOKEN },
      })
      expect(empty.statusCode).toBe(400)
      expect(empty.json().code).toBe(400)
    })

    it(`${ep.label} by-ids:管理员与普通用户同口径(不额外放行已删/拒绝)`, async () => {
      mockVerifyAccessToken.mockResolvedValue({
        userId: ADMIN_USER_ID,
        phone: '13800000009',
        familyId: '00000000-0000-4000-8000-000000000004',
        roleId: 1,
      })
      const res = await app.inject({
        method: 'GET',
        url: `${ep.url}?ids=${ep.mixedIds.join(',')}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const actual = lastReturned(res as never)
      expect(actual, `管理员读回了不可见行: ${JSON.stringify(actual)}`).toEqual([
        { id: ep.visibleId, status: 1 },
      ])
    })
  }
})
