// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-504 回归锁(2026-11-13)。
 *
 * 病灶:GET /learn/maps/favorites 只 checkAuth 就 findPublishedMaps(),
 * 未按当前用户收藏过滤 ⇒ 任意登录用户拿到全部已发布地图冒充「我的收藏」。
 *
 * 本文件锁:
 *   ① 收藏查询的 WHERE 必须含 user_favorites.user_id = <JWT userId>,
 *      且 userId 只来自鉴权注入,不来自请求参数;
 *   ② 他人收藏不出现在结果中(按渲染后的 SQL 参数模拟 PG 过滤);
 *   ③ 无收藏返回空数组,且不回落 findPublishedMaps 全量;
 *   ④ 有收藏时保持原字段形状与 sort asc / createdAt desc 排序(不新增分页截断)。
 *
 * 只 mock auth / db / learn-extended-queries,不连真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import type * as LearnExtendedQueriesModule from '../src/db/learn-extended-queries.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockFindPublishedMaps = vi.fn()

// learn.ts 仍会 import findPublishedMaps(其余地图列表在用);收藏路由一旦回落全量,
// 这个替身会把全部地图吐回去,用例直接翻红。
vi.mock('../src/db/learn-extended-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LearnExtendedQueriesModule>()
  return {
    ...actual,
    findPublishedMaps: (...args: unknown[]) => mockFindPublishedMaps(...args),
  }
})

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), execute: vi.fn() },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

// token = "valid:<userId>",缺失或非法 → 401。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { headers: { authorization?: string }; userId?: string }) => {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    }
    const token = header.slice(7).trim()
    if (!token.startsWith('valid:')) {
      throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 })
    }
    request.userId = token.slice(6)
  },
  checkAuth: async (
    request: { headers: { authorization?: string }; userId?: string },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    try {
      const header = request.headers.authorization
      if (!header || !header.startsWith('Bearer ')) {
        throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
      }
      const token = header.slice(7).trim()
      if (!token.startsWith('valid:')) {
        throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 })
      }
      request.userId = token.slice(6)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
      return false
    }
  },
}))

import { db } from '../src/db/index.js'
import { learnRoutes } from '../src/routes/learn.js'

interface MapRow {
  id: string
  title: string
  description: string | null
  cover: string | null
  content: unknown
  sort: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

interface FavoriteRow {
  userId: string
  resourceType: string
  resourceId: string
  createdAt: Date
}

const OWN_USER_ID = '00000000-0000-4000-8000-00000000000a'
const OTHER_USER_ID = '00000000-0000-4000-8000-00000000000b'

const MAP_A: MapRow = {
  id: '11111111-1111-4111-8111-111111111111',
  title: '地图 A',
  description: 'A 描述',
  cover: 'https://cdn.example.com/a.png',
  content: { nodes: [] },
  sort: 1,
  isPublished: true,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-03T00:00:00.000Z'),
}
const MAP_B: MapRow = {
  ...MAP_A,
  id: '22222222-2222-4222-8222-222222222222',
  title: '地图 B',
  description: 'B 描述',
  cover: null,
  content: { nodes: [{ title: '节点' }] },
  sort: 2,
  createdAt: new Date('2026-01-04T00:00:00.000Z'),
}
const MAP_DRAFT: MapRow = {
  ...MAP_A,
  id: '33333333-3333-4333-8333-333333333333',
  title: '未发布地图',
  sort: 0,
  isPublished: false,
}

const dialect = new PgDialect()

interface Captured {
  fromTable?: string
  joinCond?: SQL
  where?: SQL
  orderBy: SQL[]
  limitCalls: number
  offsetCalls: number
}

/** 按列等值条件取出绑定的参数值(没有该条件时为 undefined,即"不过滤")。 */
function readEq(
  query: { sql: string; params: unknown[] },
  table: string,
  column: string,
): string | undefined {
  const match = new RegExp(`"${table}"\\."${column}" = \\$(\\d+)`).exec(query.sql)
  if (!match) return undefined
  const value = query.params[Number(match[1]) - 1]
  return typeof value === 'string' ? value : undefined
}

/**
 * 造一个 thenable 的 drizzle 链:from/innerJoin/where/orderBy/limit/offset 返回自身。
 * await 时按渲染出的 WHERE 参数模拟 PG(缺 user_id 条件就是不过滤),
 * 从而让"他人收藏是否会漏出"由被测 SQL 决定,而不是由 mock 行决定。
 */
function stubFavoritesDb(input: { favorites: FavoriteRow[]; maps: MapRow[] }): Captured {
  const capture: Captured = { orderBy: [], limitCalls: 0, offsetCalls: 0 }
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    from: vi.fn((table: unknown) => {
      capture.fromTable = getTableName(table as never)
      return chain
    }),
    innerJoin: vi.fn((_table: unknown, cond: SQL) => {
      capture.joinCond = cond
      return chain
    }),
    where: vi.fn((cond: SQL) => {
      capture.where = cond
      return chain
    }),
    orderBy: vi.fn((...cols: SQL[]) => {
      capture.orderBy = cols
      return chain
    }),
    limit: vi.fn(() => {
      capture.limitCalls += 1
      return chain
    }),
    offset: vi.fn(() => {
      capture.offsetCalls += 1
      return chain
    }),
    then: (onFulfilled: (value: unknown) => unknown) => {
      const query = capture.where
        ? dialect.sqlToQuery(capture.where)
        : { sql: '', params: [] as unknown[] }
      const userId = readEq(query, 'user_favorites', 'user_id')
      const resourceType = readEq(query, 'user_favorites', 'resource_type')
      let favorites = input.favorites
      if (userId !== undefined) favorites = favorites.filter((f) => f.userId === userId)
      if (resourceType !== undefined) {
        favorites = favorites.filter((f) => f.resourceType === resourceType)
      }
      let maps = favorites
        .map((f) => input.maps.find((m) => m.id === f.resourceId))
        .filter((m): m is MapRow => Boolean(m))
      if (query.sql.includes('"learn_maps"."is_published"')) {
        maps = maps.filter((m) => m.isPublished)
      }
      maps = [...maps].sort(
        (a, b) => a.sort - b.sort || b.createdAt.getTime() - a.createdAt.getTime(),
      )
      return onFulfilled(maps.map((map) => ({ map })))
    },
  })
  vi.mocked(db.select).mockImplementation((() => chain) as unknown as typeof db.select)
  return capture
}

function render(cond: SQL | undefined) {
  expect(cond).toBeDefined()
  return dialect.sqlToQuery(cond as SQL)
}

async function call(app: FastifyInstance, authorization?: string) {
  return app.inject({
    method: 'GET',
    url: '/api/learn/maps/favorites',
    ...(authorization ? { headers: { authorization } } : {}),
  })
}

describe('F-504 我的收藏必须按当前用户过滤', () => {
  let app: FastifyInstance
  const auth = `Bearer valid:${OWN_USER_ID}`

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(learnRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(db.select).mockReset()
    mockFindPublishedMaps.mockReset()
    // 陷阱:若收藏路由回落到全量查询,会拿到这三张地图。
    mockFindPublishedMaps.mockResolvedValue([MAP_A, MAP_B, MAP_DRAFT])
  })

  it('① 收藏查询 SQL 含当前 JWT userId 条件与收藏表 join', async () => {
    const capture = stubFavoritesDb({ favorites: [], maps: [MAP_A, MAP_B, MAP_DRAFT] })

    const res = await call(app, auth)
    expect(res.statusCode).toBe(200)

    expect(capture.fromTable).toBe('user_favorites')
    const where = render(capture.where)
    expect(where.sql).toContain('"user_favorites"."user_id" = $')
    expect(where.params).toContain(OWN_USER_ID)
    expect(where.params).not.toContain(OTHER_USER_ID)
    expect(where.params).toContain('learn_map')

    const join = render(capture.joinCond)
    expect(join.sql).toContain('"user_favorites"."resource_id"')
    expect(join.sql).toContain('"learn_maps"."id"')
    expect(join.sql).toContain('::text')
  })

  it('② 他人收藏不出现在结果中', async () => {
    stubFavoritesDb({
      favorites: [
        {
          userId: OWN_USER_ID,
          resourceType: 'learn_map',
          resourceId: MAP_A.id,
          createdAt: new Date(),
        },
        {
          userId: OTHER_USER_ID,
          resourceType: 'learn_map',
          resourceId: MAP_B.id,
          createdAt: new Date(),
        },
      ],
      maps: [MAP_A, MAP_B, MAP_DRAFT],
    })

    const res = await call(app, auth)
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: MapRow[] } }
    expect(body.data.list.map((m) => m.id)).toEqual([MAP_A.id])
    expect(body.data.list.map((m) => m.title)).not.toContain(MAP_B.title)
    expect(mockFindPublishedMaps).not.toHaveBeenCalled()
  })

  it('③ 无收藏返回空数组,不回落全量已发布地图', async () => {
    stubFavoritesDb({
      favorites: [
        {
          userId: OTHER_USER_ID,
          resourceType: 'learn_map',
          resourceId: MAP_A.id,
          createdAt: new Date(),
        },
      ],
      maps: [MAP_A, MAP_B, MAP_DRAFT],
    })

    const res = await call(app, auth)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ code: 0, message: 'success', data: { list: [] } })
    expect(mockFindPublishedMaps).not.toHaveBeenCalled()
  })

  it('④ 有收藏时保持原字段与 sort asc / createdAt desc 排序,不新增分页截断', async () => {
    const capture = stubFavoritesDb({
      favorites: [
        {
          userId: OWN_USER_ID,
          resourceType: 'learn_map',
          resourceId: MAP_B.id,
          createdAt: new Date(),
        },
        {
          userId: OWN_USER_ID,
          resourceType: 'learn_map',
          resourceId: MAP_A.id,
          createdAt: new Date(),
        },
      ],
      maps: [MAP_B, MAP_A, MAP_DRAFT],
    })

    const res = await call(app, auth)
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: MapRow[] } }
    expect(body.data.list).toEqual(JSON.parse(JSON.stringify([MAP_A, MAP_B])))

    const orderSql = capture.orderBy.map((col) => dialect.sqlToQuery(col).sql)
    expect(orderSql[0]).toContain('"learn_maps"."sort" asc')
    expect(orderSql[1]).toContain('"learn_maps"."created_at" desc')
    expect(capture.limitCalls).toBe(0)
    expect(capture.offsetCalls).toBe(0)
  })

  it('⑤ 未登录仍返回 401,不触达收藏查询', async () => {
    stubFavoritesDb({ favorites: [], maps: [] })

    const res = await call(app)
    expect(res.statusCode).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})
