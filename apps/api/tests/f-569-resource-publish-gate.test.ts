// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-569 回归锁(2026-11-13)。
 *
 * 病灶:资源详情/批量端点只按 id 过滤,草稿(isPublished=false)与下线(status!=1)
 * 资源仍可被任意调用方读到,与列表 /resources 的强制过滤、下载
 * findPublishedResourceById 的发布态口径不一致;草稿浏览还会被计热度。
 *
 * 本文件锁:
 *   ① 草稿详情 404,且不触发任何写库 ⇒ 草稿浏览量不被虚增;
 *   ② by-ids 混入草稿/下线 id 时只返回已发布 + status=1 的行;
 *   ③ 已发布资源详情正常返回;
 *   ④ 下线资源详情同样 404;
 *   ⑤ 内部 admin 查询可用 includeUnpublished 读到草稿(既有后台能力不被误伤)。
 *
 * 只 mock db(按 drizzle 条件里是否带 is_published/status 还原过滤语义)、
 * auth,不触达真实 PG / Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { PUB_ID, DRAFT_ID, OFFLINE_ID, ROWS } = vi.hoisted(() => {
  const PUB_ID = '11111111-1111-4111-8111-111111111111'
  const DRAFT_ID = '22222222-2222-4222-8222-222222222222'
  const OFFLINE_ID = '33333333-3333-4333-8333-333333333333'
  const FILE_URL = 'https://oss.example.com/files/secret.pdf'

  const make = (id: string, overrides: Record<string, unknown>) => ({
    id,
    title: `资源-${id.slice(0, 4)}`,
    coverImage: null,
    intro: '资源简介',
    categoryId: null,
    fileUrl: FILE_URL,
    fileType: 'application/pdf',
    fileSize: 1024,
    isPublished: true,
    viewCount: 7,
    downloadCount: 0,
    sort: 0,
    status: 1,
    type: null,
    price: null,
    productId: null,
    tagIdList: null,
    image: null,
    introduction: null,
    cidList: null,
    ownerUserId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  })

  const ROWS = [
    make(PUB_ID, {}),
    make(DRAFT_ID, { isPublished: false }),
    make(OFFLINE_ID, { status: 0 }),
  ]
  return { PUB_ID, DRAFT_ID, OFFLINE_ID, ROWS }
})

/**
 * select→from→where 断言器:从路由真实发出的 drizzle 条件里还原过滤语义。
 * 旧实现只带 id ⇒ 不加过滤(红);新实现带 is_published/status ⇒ 按发布态过滤(绿)。
 */
vi.mock('../src/db/index.js', () => {
  function describeCondition(node: unknown): { columns: string[]; params: unknown[] } {
    const acc = { columns: [] as string[], params: [] as unknown[] }
    const seen = new Set<unknown>()
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

  function rowsFor(cond: unknown): Array<Record<string, unknown>> {
    const { columns, params } = describeCondition(cond)
    const idParams = params.filter((v): v is string => typeof v === 'string')
    return ROWS.filter((r) => idParams.includes(r.id as string))
      .filter((r) => (columns.includes('is_published') ? r.isPublished === true : true))
      .filter((r) => (columns.includes('status') ? r.status === 1 : true))
  }

  const makeChain = (sink: { cond?: unknown }): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: (cond: unknown) => {
        sink.cond = cond
        return chain
      },
      orderBy: () => Promise.resolve(rowsFor(sink.cond)),
      limit: () => Promise.resolve(rowsFor(sink.cond)),
      offset: () => chain,
      leftJoin: () => chain,
    }
    return chain
  }

  return {
    db: {
      select: () => makeChain({}),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: () => makeChain({}) },
    dbClient: {},
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f569-user'
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

import { db } from '../src/db/index.js'
import { findResourceById } from '../src/db/resource-queries.js'
import { resourceRoutes } from '../src/routes/resource.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(resourceRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('F-569 资源详情/批量必须过滤发布态', () => {
  it('① 草稿详情 404,且不写库(浏览量不被虚增)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/resources/${DRAFT_ID}` })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { code: number }).code).toBe(404)
    expect(res.body).not.toContain('secret.pdf')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('② by-ids 混入草稿/下线 id:只返回已发布且启用的行', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/by-ids?ids=${PUB_ID},${DRAFT_ID},${OFFLINE_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<Record<string, unknown>> }
    expect(data.list.map((r) => r.id)).toEqual([PUB_ID])
    expect(data.list[0]).not.toHaveProperty('fileUrl')
  })

  it('③ 已发布资源详情正常返回', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/resources/${PUB_ID}` })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { resource: Record<string, unknown> }
    expect(data.resource.id).toBe(PUB_ID)
    expect(data.resource.viewCount).toBe(7)
    expect(data.resource).not.toHaveProperty('fileUrl')
  })

  it('④ 下线资源详情同样 404(status 闸门生效)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/resources/${OFFLINE_ID}` })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { code: number }).code).toBe(404)
  })

  it('⑤ 内部 admin 查询 includeUnpublished 仍能读到草稿', async () => {
    expect(await findResourceById(DRAFT_ID)).toBeUndefined()
    expect((await findResourceById(DRAFT_ID, { includeUnpublished: true }))?.id).toBe(DRAFT_ID)
  })
})

