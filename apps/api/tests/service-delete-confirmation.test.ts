// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 服务层"布尔删除确认改成库确认"离线回归(2026-09-27,不连库)。
//
// 覆盖规格里那五格:
//   ① 库回 [{id}] ⇒ 服务函数回报 1 个确认 id
//   ② 库回 []     ⇒ 服务函数回报空集合(路由据此只能报 deleted:false)
//   ③ 两个真实端点走 Fastify inject ⇒ 状态码仍 200、deleted === false
//   ④ 回归锁:归属/定位条件仍编进 SQL(PgDialect.sqlToQuery 量被捕获的 where,
//      防止改服务时把 eq(owner_uuid) / eq(user_id) 弄丢)
//   ⑤ 批量端点未命中的 id 必须逐条点名(missedIds)
//
// 全程 mock `src/db/index.js` 的链式调用:每次 delete/update/select 都记录
// op / where 条件 / returning 形状,返回值由脚本按用例供给。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8811/0'
})

interface CapturedCall {
  op: string
  where: unknown
  returningShape: unknown
}

const stub = vi.hoisted(() => {
  const calls: CapturedCall[] = []
  const rows = { select: [] as unknown[], update: [] as unknown[], delete: [] as unknown[] }
  return {
    calls,
    rows,
    reset: () => {
      calls.length = 0
      rows.select = []
      rows.update = []
      rows.delete = []
    },
  }
})

vi.mock('../src/db/index.js', () => {
  const makeChain = (op: CapturedCall['op'], resolve: () => unknown[]) => {
    const entry: CapturedCall = { op, where: undefined, returningShape: undefined }
    stub.calls.push(entry)
    const step: Record<string, unknown> = {}
    const self = () => step
    step.from = self
    step.innerJoin = self
    step.leftJoin = self
    step.orderBy = self
    step.groupBy = self
    step.limit = self
    step.offset = self
    step.set = self
    step.values = self
    step.where = (cond: unknown) => {
      entry.where = cond
      return step
    }
    step.returning = (shape?: unknown) => {
      entry.returningShape = shape
      return step
    }
    step.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onOk, onErr)
    return step
  }
  const db = {
    select: () => makeChain('select', () => stub.rows.select),
    update: () => makeChain('update', () => stub.rows.update),
    delete: () => makeChain('delete', () => stub.rows.delete),
    insert: () => makeChain('insert', () => []),
    execute: () => Promise.resolve([]),
    transaction: vi.fn(),
  }
  return { db, dbRead: db }
})

// admin 闸门与登录闸门:本文件判的是"布尔有没有库确认依据",鉴权链由各自既有测试守
vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, requireAdmin: async (): Promise<void> => undefined }
})

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const principalUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const principal = { userId: principalUserId, phone: '', familyId: 'fam-test', roleId: 1 }
  return {
    ...actual,
    authenticate: async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = principalUserId
      request.jwtPayload = principal
      return principal
    },
    checkAuth: async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = principalUserId
      request.jwtPayload = principal
      return true
    },
  }
})

import {
  deleteHotWord,
  deleteNewsTop,
  deleteNewsRecommend,
} from '../src/db/misc-extended-queries.js'
import { deleteInvoiceTitle, deleteInvoiceApplication } from '../src/db/order-queries.js'
import { deleteScheduleTask } from '../src/db/schedule-queries.js'
import { deleteOAuthApp } from '../src/db/oauth-queries.js'
import { deleteConversation } from '../src/services/relay-conversation-service.js'
import { adminNewsRoutes } from '../src/routes/news.js'
import { searchRoutes } from '../src/routes/search.js'
import { agentsRoutes } from '../src/routes/agents.js'

const HOT_WORD_ID = '11111111-1111-4111-8111-111111111111'
const NEWS_ID = '22222222-2222-4222-8222-222222222222'
const TITLE_ID = '33333333-3333-4333-8333-333333333333'
const APP_ID = '44444444-4444-4444-8444-444444444444'
const TASK_ID = '55555555-5555-4555-8555-555555555555'
const CLIENT_ID = 'zhs_serviceprobe0000000000000000001'
const CONV_DB_ID = '66666666-6666-4666-8666-666666666666'

/** 编译被捕获的 where 条件,断言归属列仍在 SQL 里(而不是"看起来还在")。 */
function sqlOf(where: unknown): string {
  if (where === undefined) throw new Error('该写链没有 .where( 条件 —— 归属条件丢了')
  return new PgDialect().sqlToQuery(where as SQL<unknown>).sql
}

function callsFrom(mark: number): CapturedCall[] {
  return stub.calls.slice(mark)
}

function callOf(op: CapturedCall['op'], mark: number): CapturedCall {
  const hit = callsFrom(mark).find((c) => c.op === op)
  if (!hit) throw new Error(`未捕获到 ${op} 调用`)
  return hit
}

beforeEach(() => {
  stub.reset()
})

describe('① / ② 服务函数回报库确认集合', () => {
  it('库回 [{id}] ⇒ 八个删除函数各回报恰好一个确认 id,且确实请求了 returning', async () => {
    stub.rows.delete = [{ id: 'confirmed-1' }]
    stub.rows.select = [{ id: CONV_DB_ID }]
    const mark = stub.calls.length

    const pending: Array<[string, Promise<string[]>]> = [
      ['deleteHotWord', deleteHotWord(HOT_WORD_ID)],
      ['deleteNewsTop', deleteNewsTop(NEWS_ID)],
      ['deleteNewsRecommend', deleteNewsRecommend(NEWS_ID)],
      ['deleteInvoiceTitle', deleteInvoiceTitle(TITLE_ID)],
      ['deleteInvoiceApplication', deleteInvoiceApplication(APP_ID)],
      ['deleteScheduleTask', deleteScheduleTask(TASK_ID)],
      ['deleteOAuthApp', deleteOAuthApp(CLIENT_ID, USER)],
      ['deleteConversation', deleteConversation('conv-visible-1', USER)],
    ]
    const results = await Promise.all(pending.map(([, p]) => p))
    expect(results.map((r) => r.length)).toEqual(pending.map(() => 1))
    expect(results.every((r) => r[0] === 'confirmed-1')).toBe(true)
    // 每个删除都真的向库要了 returning 集合(否则布尔没有库侧依据)
    const deletes = callsFrom(mark).filter((c) => c.op === 'delete')
    expect(deletes).toHaveLength(8)
    for (const call of deletes) expect(call.returningShape).toBeDefined()
  })

  it('库回 [] ⇒ 八个删除函数全部回报空集合(路由据此只能报 false)', async () => {
    stub.rows.delete = []
    stub.rows.select = [{ id: CONV_DB_ID }]

    expect(await deleteHotWord(HOT_WORD_ID)).toEqual([])
    expect(await deleteNewsTop(NEWS_ID)).toEqual([])
    expect(await deleteNewsRecommend(NEWS_ID)).toEqual([])
    expect(await deleteInvoiceTitle(TITLE_ID)).toEqual([])
    expect(await deleteInvoiceApplication(APP_ID)).toEqual([])
    expect(await deleteScheduleTask(TASK_ID)).toEqual([])
    expect(await deleteOAuthApp(CLIENT_ID, USER)).toEqual([])
    expect(await deleteConversation('conv-visible-1', USER)).toEqual([])
  })
})

describe('④ 回归锁:归属/定位条件仍在 SQL 里', () => {
  it('deleteOAuthApp 的 where 仍同时锁 client_id 与 owner_uuid', async () => {
    stub.rows.delete = [{ id: 'x' }]
    const mark = stub.calls.length
    await deleteOAuthApp(CLIENT_ID, USER)
    const sql = sqlOf(callOf('delete', mark).where)
    expect(sql).toContain('"client_id"')
    expect(sql).toContain('"owner_uuid"')
  })

  it('deleteConversation 的归属校验仍按 conversation_id + user_id 查', async () => {
    stub.rows.select = [{ id: CONV_DB_ID }]
    stub.rows.delete = [{ id: CONV_DB_ID }]
    const mark = stub.calls.length
    await deleteConversation('conv-visible-1', USER)
    const sql = sqlOf(callOf('select', mark).where)
    expect(sql).toContain('"conversation_id"')
    expect(sql).toContain('"user_id"')
  })

  it('六条按主键/外键定位的删除仍带着定位条件(没有被改成无条件删)', async () => {
    stub.rows.delete = [{ id: 'x' }]
    // 用 thunk 而非"先把六个 promise 都发出去",否则 mark 全被挤到调用之后
    const cases: Array<{ run: () => Promise<string[]>; column: string }> = [
      { run: () => deleteHotWord(HOT_WORD_ID), column: '"hot_words"."id"' },
      { run: () => deleteNewsTop(NEWS_ID), column: '"news_tops"."news_id"' },
      { run: () => deleteNewsRecommend(NEWS_ID), column: '"news_recommends"."news_id"' },
      { run: () => deleteInvoiceTitle(TITLE_ID), column: '"edu_invoice_titles"."id"' },
      { run: () => deleteInvoiceApplication(APP_ID), column: '"edu_invoice_applications"."id"' },
      { run: () => deleteScheduleTask(TASK_ID), column: '"schedule_tasks"."id"' },
    ]
    for (const { run, column } of cases) {
      const mark = stub.calls.length
      await run()
      expect(sqlOf(callOf('delete', mark).where)).toContain(column)
    }
  })
})

describe('deleteConversation 的 404 契约(throw)保持不变', () => {
  it('归属查不到 ⇒ 仍然 throw,且不发出 DELETE', async () => {
    stub.rows.select = []
    const mark = stub.calls.length
    await expect(deleteConversation('conv-not-mine', USER)).rejects.toThrow('会话不存在或无权访问')
    expect(callsFrom(mark).some((c) => c.op === 'delete')).toBe(false)
  })
})

describe('③ 路由侧 deleted 必须是派生真值(状态码仍 200)', () => {
  async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false, pluginTimeout: 120_000 })
    await app.register(adminNewsRoutes, { prefix: '/api/admin' })
    await app.register(searchRoutes, { prefix: '/api' })
    await app.ready()
    return app
  }

  it('库没删到 ⇒ 取消置顶 / 删除热搜词都回 200 且 deleted:false', async () => {
    const app = await buildApp()
    stub.rows.delete = []
    const top = await app.inject({
      method: 'DELETE',
      url: `/api/admin/news/articles/${NEWS_ID}/top`,
    })
    expect(top.statusCode).toBe(200)
    expect(top.json().data).toEqual({ id: NEWS_ID, deleted: false })

    const hw = await app.inject({ method: 'DELETE', url: `/api/search/hot-words/${HOT_WORD_ID}` })
    expect(hw.statusCode).toBe(200)
    expect(hw.json().data).toEqual({ id: HOT_WORD_ID, deleted: false })
    await app.close()
  })

  it('库确实删了一行 ⇒ 同一族端点回 deleted:true(证明布尔不是写死的 false)', async () => {
    const app = await buildApp()
    stub.rows.delete = [{ id: 'confirmed-1' }]
    const rec = await app.inject({
      method: 'DELETE',
      url: `/api/admin/news/articles/${NEWS_ID}/recommend`,
    })
    expect(rec.statusCode).toBe(200)
    expect(rec.json().data.deleted).toBe(true)
    await app.close()
  })
})

describe('⑤ 批量端点:未命中的 id 必须逐条点名', () => {
  const R1 = 'examine-1'
  const R2 = 'examine-2'
  const R3 = 'examine-3'

  it('请求 3 个 recordId 而库只 returning 2 个 ⇒ approved:2 + missedIds 点名第 3 个', async () => {
    const app = Fastify({ logger: false, pluginTimeout: 120_000 })
    await app.register(agentsRoutes, { prefix: '/api' })
    await app.ready()
    stub.rows.update = [{ id: R1 }, { id: R2 }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/examine/batch-approve',
      payload: { recordIds: [R1, R2, R3] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.approved).toBe(2)
    expect(body.data.missedIds).toEqual([R3])
    // 既有键 records 形状不变(missedIds 是纯新增)
    expect(body.data.records).toEqual([{ id: R1 }, { id: R2 }])
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
