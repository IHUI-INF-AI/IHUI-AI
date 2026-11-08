// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​​​​‌​‌‍‍​​‌​‌‌‌​‍‍​​‌​​​​‍‍​‌​​‌‌‌​‍‍​‌​​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-170(P1,数据外泄域):GET /api/self-media/records 此前只按可选 category 过滤,
 * 任意登录用户可枚举全站自媒体记录(title / topicKeyword / payload / authorId /
 * status / draftId);且 limit 为负数时 Math.min 仍为负,落库层触发 500。
 *
 * 本文件钉住两条边界:
 *  ① 读侧与写侧同口径(authorId=request.userId),A 的列表里不得出现 B 的任何字段;
 *     本路由无管理员全量路径,管理员亦只能看到自己的记录;
 *  ② limit 夹到 [1, 100](HISTORY_LIMIT),负数 / 超大值都返回 200 且行数有界。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  records: [] as Record<string, unknown>[],
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    AI_SERVICE_URL: 'http://ai-service.test:8803',
  },
}))

/** 只替换鉴权出口;身份由请求头注入,route 的 preHandler 语义不变。 */
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  return {
    authenticate: async (request: MockRequest) => {
      const headerUser = request.headers['x-test-user']
      if (typeof headerUser !== 'string' || headerUser.length === 0) {
        throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
      }
      const headerRole = request.headers['x-test-role']
      const roleId = typeof headerRole === 'string' ? Number(headerRole) : 0
      request.userId = headerUser
      request.jwtPayload = { userId: headerUser, roleId }
      return request.jwtPayload
    },
  }
})

vi.mock('../src/db/index.js', () => {
  /** 递归收集 drizzle 条件里的标量参数(eq / and(...) 都覆盖),让 where 在夹具里真的收窄。 */
  const collectedValues = (node: unknown, out: string[] = []): string[] => {
    if (!node || typeof node !== 'object') return out
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) collectedValues(chunk, out)
      return out
    }
    const value = (node as { value?: unknown }).value
    if (typeof value === 'string') out.push(value)
    return out
  }
  const matchedRows = (condition?: unknown) => {
    const values = collectedValues(condition)
    if (values.length === 0) return h.records
    return h.records.filter((row) => values.every((v) => Object.values(row).includes(v)))
  }
  const db = {
    select: () => ({
      from: () => ({
        where: (condition?: unknown) => {
          const rows = matchedRows(condition)
          return {
            orderBy: () => ({
              limit: async (n?: number) => {
                // 复刻 Postgres 语义:负 limit 是错误(旧代码 limit=-100 即在此炸成 500)。
                if (n !== undefined && (!Number.isInteger(n) || n < 0)) {
                  throw new Error('LIMIT must not be negative')
                }
                return rows.slice(0, n ?? rows.length)
              },
            }),
          }
        },
      }),
    }),
    insert: () => ({
      values: () => ({ returning: async () => [] }),
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { selfMediaRoutes } from '../src/routes/self-media-routes.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const B_PAYLOAD_1 = 'B_PAYLOAD_SECRET_9f2c'
const B_PAYLOAD_2 = 'B_PAYLOAD_SECRET_71d4'

const RECORD_A_1 = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'wechat',
  title: 'A 的公众号草稿一',
  topicKeyword: 'A 主题一',
  payload: { secret: 'A_PAYLOAD_1' },
  authorId: USER_A,
  status: 'generated',
  draftId: 'draft-a-1',
  createdAt: new Date('2026-11-01T00:00:00Z'),
}

const RECORD_A_2 = {
  ...RECORD_A_1,
  id: '22222222-2222-4222-8222-222222222222',
  category: 'koubo',
  title: 'A 的口播稿二',
  topicKeyword: 'A 主题二',
  payload: { secret: 'A_PAYLOAD_2' },
  draftId: 'draft-a-2',
  createdAt: new Date('2026-11-02T00:00:00Z'),
}

const RECORD_B_1 = {
  ...RECORD_A_1,
  id: '33333333-3333-4333-8333-333333333333',
  title: 'B 的公众号草稿',
  topicKeyword: 'B 主题',
  payload: { secret: B_PAYLOAD_1 },
  authorId: USER_B,
  draftId: 'draft-b-1',
  createdAt: new Date('2026-11-03T00:00:00Z'),
}

const RECORD_B_2 = {
  ...RECORD_B_1,
  id: '44444444-4444-4444-8444-444444444444',
  category: 'koubo',
  title: 'B 的口播稿',
  payload: { secret: B_PAYLOAD_2 },
  draftId: 'draft-b-2',
  createdAt: new Date('2026-11-04T00:00:00Z'),
}

type RecordRow = typeof RECORD_A_1
interface ListBody {
  data: { items: RecordRow[]; count: number }
}

function authHeaders(userId: string, roleId = 0) {
  return { 'x-test-user': userId, 'x-test-role': String(roleId) }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(selfMediaRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.records = [RECORD_A_1, RECORD_A_2, RECORD_B_1, RECORD_B_2]
})

describe('F-170 GET /api/self-media/records 只能读当前用户自己的记录', () => {
  it('USER_A 默认列表 → 200 且只含自己的行,响应体没有 B 的 title/payload/authorId', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records',
      headers: authHeaders(USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as ListBody
    expect(body.data.items).toHaveLength(2)
    expect(body.data.items.map((item) => item.title).sort()).toEqual(
      [RECORD_A_1.title, RECORD_A_2.title].sort(),
    )
    for (const item of body.data.items) {
      expect(item.authorId).toBe(USER_A)
    }
    expect(res.body).toContain(RECORD_A_1.title)
    expect(res.body).not.toContain(RECORD_B_1.title)
    expect(res.body).not.toContain(RECORD_B_2.title)
    expect(res.body).not.toContain(B_PAYLOAD_1)
    expect(res.body).not.toContain(B_PAYLOAD_2)
    expect(res.body).not.toContain(USER_B)
    await app.close()
  })

  it('category 过滤仍叠加属主条件:USER_A 查 wechat 只得到 A 的公众号草稿', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records?category=wechat',
      headers: authHeaders(USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as ListBody
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0]?.title).toBe(RECORD_A_1.title)
    expect(body.data.items[0]?.authorId).toBe(USER_A)
    expect(res.body).not.toContain(RECORD_B_1.title)
    expect(res.body).not.toContain(B_PAYLOAD_1)
    await app.close()
  })

  it('limit=-100 → 200(不再 500),行数夹到下限 1 且无 B 数据', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records?limit=-100',
      headers: authHeaders(USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as ListBody
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0]?.authorId).toBe(USER_A)
    expect(res.body).not.toContain(RECORD_B_1.title)
    expect(res.body).not.toContain(B_PAYLOAD_1)
    await app.close()
  })

  it('limit=999999 → 200,行数封顶 100 且只含自己的 2 条', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records?limit=999999',
      headers: authHeaders(USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as ListBody
    expect(body.data.items.length).toBeLessThanOrEqual(100)
    expect(body.data.items).toHaveLength(2)
    expect(body.data.count).toBe(2)
    expect(res.body).not.toContain(RECORD_B_1.title)
    expect(res.body).not.toContain(B_PAYLOAD_1)
    await app.close()
  })

  it('管理员(roleId=1)也走 own-only —— 本路由没有全量管理路径', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records',
      headers: authHeaders(USER_A, 1),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as ListBody
    expect(body.data.items).toHaveLength(2)
    for (const item of body.data.items) {
      expect(item.authorId).toBe(USER_A)
    }
    expect(res.body).not.toContain(RECORD_B_1.title)
    expect(res.body).not.toContain(B_PAYLOAD_1)
    await app.close()
  })

  it('未认证请求仍被 preHandler 拦截为 401', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-media/records',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
