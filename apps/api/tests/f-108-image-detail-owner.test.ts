// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-108 回归锁(2026-11-11)。
 *
 * 缺陷:GET /ai-image/user-agent/:id 详情只按主键 id 查,未带 userUuid 属主条件,
 *      任意登录用户可枚举 id 读取他人图片记录(imageUrl/prompt/model/cost/userUuid)。
 * 判据:WHERE 必须同时命中 id 与 user_uuid = 当前登录用户;不命中(不存在或非本人)
 *      统一返回同一个 404,不泄露记录是否存在。
 *
 * 断言方式:包一层 drizzle 的 eq,直接看下推的列名(同 ai-grading-ownership.test.ts)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as DrizzleOrmModule from 'drizzle-orm'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { USER_ID, eqCalls, dbState } = vi.hoisted(() => ({
  USER_ID: '11111111-1111-4111-8111-111111111111',
  eqCalls: [] as Array<{ column: string; value: unknown }>,
  dbState: { rows: [] as unknown[] },
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrmModule>()
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      eqCalls.push({ column: column?.name ?? '?', value })
      return actual.eq(column as never, value as never)
    },
  }
})

// mock authenticate(避免 JWT 解析 + 真实 DB);登录主体恒为 USER_ID
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_ID
  }),
}))

// 可切换结果集的 thenable 查询链,避免真实 DB
vi.mock('../src/db/index.js', () => {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(dbState.rows).then(resolve),
  }
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
    chain[method] = () => chain
  }
  return {
    db: {
      execute: vi.fn(async () => []),
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
    },
  }
})

import { aiImageEditRoutes } from '../src/routes/ai-image-edit.js'

type ReplyMock = {
  statusCode: number
  body: unknown
  status(code: number): ReplyMock
  send(body: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(body: unknown) {
      this.body = body
      return this
    },
  }
}

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const fakeServer = {
  get: (path: string, ...args: unknown[]) => handlers.set(`GET ${path}`, args[args.length - 1] as Handler),
  post: (path: string, ...args: unknown[]) =>
    handlers.set(`POST ${path}`, args[args.length - 1] as Handler),
  delete: (path: string, ...args: unknown[]) =>
    handlers.set(`DELETE ${path}`, args[args.length - 1] as Handler),
}
await aiImageEditRoutes(fakeServer as never, {} as never)

const detailHandler = handlers.get('GET /ai-image/user-agent/:id')!

const OWN_ROW = {
  id: 7,
  userUuid: USER_ID,
  imageUrl: 'https://cdn.example.com/own.png',
  prompt: '自己的图',
  model: 'doubao-image-edit-2.0',
  cost: 10,
}

/** 以给定 id 调用详情处理器。 */
async function getDetail(id: string): Promise<ReplyMock> {
  const reply = makeReply()
  await detailHandler({ userId: USER_ID, params: { id }, log: { error: vi.fn() } }, reply)
  return reply
}

beforeEach(() => {
  eqCalls.length = 0
  dbState.rows = []
})

describe('F-108 图片交互详情属主过滤', () => {
  it('查询条件同时下推 id 与 user_uuid=当前用户', async () => {
    dbState.rows = [OWN_ROW]
    const reply = await getDetail('7')
    expect(reply.statusCode).toBe(200)
    expect(eqCalls).toContainEqual({ column: 'id', value: 7 })
    expect(eqCalls).toContainEqual({ column: 'user_uuid', value: USER_ID })
  })

  it('本人记录 → 200 返回详情', async () => {
    dbState.rows = [OWN_ROW]
    const reply = await getDetail('7')
    expect(reply.statusCode).toBe(200)
    expect(reply.body).toMatchObject({ code: 0, data: OWN_ROW })
  })

  it('他人记录被属主条件过滤(0 行)→ 404,不返回任何字段', async () => {
    dbState.rows = []
    const reply = await getDetail('7')
    expect(reply.statusCode).toBe(404)
    expect(reply.body).toEqual({ code: 404, message: '图片记录不存在' })
  })

  it('不存在与他人记录返回逐字一致的 404(不泄露存在性)', async () => {
    const missing = await getDetail('1')
    const others = await getDetail('999999')
    expect(missing.statusCode).toBe(404)
    expect(others.statusCode).toBe(404)
    expect(missing.body).toEqual(others.body)
  })

  it('非法 id → 400 且不下推查询', async () => {
    const reply = await getDetail('abc')
    expect(reply.statusCode).toBe(400)
    expect(eqCalls).toHaveLength(0)
  })
})
