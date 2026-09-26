// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * registerCrud 批量删除:deleted 必须是**库确认的条数**(2026-09-26 立,不连库:mock db)。
 *
 * 缺陷:apps/api/src/routes/admin/_shared.ts 的 `DELETE <basePath>` 旧写法是
 *   `return reply.send(success({ deleted: idList.length }))` —— 请求侧自己数的。
 *   id 打错 / 行早被别人删掉 / 该 id 属于另一张表 ⇒ 一个都没删,仍然回 deleted: 3。
 *   该工厂被多处 admin 路由复用,所以"UI 显示已删除 3 项、库里一行没动"是通病形态。
 *
 * 现口径:db.delete(...).returning({ id }) 取库确认集合 → batchWriteOutcome() 唯一出口
 *   推出 affected 与 missedIds。既有响应键 `deleted` 名字不变、语义收紧;missedIds 是纯增字段。
 *
 * 用例设计（六条各守一格,互不重复）:
 *   ① 3 请求 / 库只 returning 1 ⇒ deleted===1 且逐条点名另外 2 个 ← "UI 不再谎报已删 3 项"的证明
 *   ② 全命中 ⇒ deleted===3、missedIds 为空数组
 *   ③ 一个都没命中 ⇒ deleted===0(不再是 3)、missedIds 等于请求全集
 *   ④ 请求含重复 id ⇒ deleted 不重复计(去重语义与出口一致)
 *   ⑤ 非法 UUID / 空清单 ⇒ 仍 400,文案逐字不变(防顺手改校验)
 *   ⑥ 单条删除端点同样以库确认为准(2026-09-26 语义改造:命中⇒true / 未命中⇒false,状态码仍 200)
 * 另有一条机制锁:断言 returning 确实被调用并带上 id 列 —— 否则 ①③ 可以靠"少报数"蒙过。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

// Mock config 避免 env 校验触发 process.exit(1)
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
  },
}))

const { mockDeleteReturning } = vi.hoisted(() => ({
  /**
   * db.delete(table).where(...).returning(...) 的返回值 = 库确认真的被删掉的行。
   * 形参必须写进签名:否则 vi.fn 把 calls 推成空元组，①b 取 calls[0][0] 在编译期就报错，
   * 而那条断言正是「deleted 只能来自库确认集合」的机制锁。
   */
  mockDeleteReturning: vi.fn(
    async (_fields?: Record<string, unknown>): Promise<{ id: string }[]> => [],
  ),
}))

// 链式 mock:delete → where → returning(批量与单条删除**都**走这条 —— 2026-09-26 起
// 单条也取库确认集合,不再依赖"await 非 thenable 对象原样返回"那条旧形态)。
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const step: Record<string, unknown> = {}
      for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
        step[m] = vi.fn(() => step)
      }
      step.then = (resolve: (v: unknown) => void) => resolve([])
      return step
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: mockDeleteReturning })),
    })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

import { registerCrud } from '../src/routes/admin/_shared.js'

// 临时表名(不连库,只为让 inArray / desc 拿到真实的 drizzle 列对象)
const tmpTable = pgTable('ihui_test_crud_batch_delete_target', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }),
})

const ID_1 = '11111111-1111-4111-8111-111111111111'
const ID_2 = '22222222-2222-4222-8222-222222222222'
const ID_3 = '33333333-3333-4333-8333-333333333333'

const BASE = '/ihui-test/crud-batch-delete'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  registerCrud(app, BASE, tmpTable, { map: () => ({}) })
  await app.ready()
  return app
}

/** 打真实的批量删除路由(ids 是逗号拼接的字符串,与该端点的校验 schema 同形)。 */
async function batchDelete(ids: string[]) {
  const app = await buildApp()
  const res = await app.inject({ method: 'DELETE', url: BASE, payload: { ids: ids.join(',') } })
  const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
  await app.close()
  return { res, body }
}

beforeEach(() => {
  mockDeleteReturning.mockReset()
  mockDeleteReturning.mockResolvedValue([])
})

describe('registerCrud 批量删除:deleted 由库确认,未命中逐条点名', () => {
  it('① 请求 3 个 id 而库只 returning 1 行 ⇒ deleted===1,missedIds 点名另外 2 个', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: ID_1 }])
    const { res, body } = await batchDelete([ID_1, ID_2, ID_3])

    expect(res.statusCode).toBe(200)
    expect(body.code).toBe(0)
    // 这一条就是"UI 不再谎报已删 3 项"的证明
    expect(body.data.deleted).toBe(1)
    expect(body.data.missedIds).toEqual([ID_2, ID_3])
  })

  it('①b 机制锁:deleted 只能来自库确认集合 ⇒ returning 必须被调用且带上 id 列', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: ID_1 }])
    await batchDelete([ID_1, ID_2])

    expect(mockDeleteReturning).toHaveBeenCalledTimes(1)
    const arg = mockDeleteReturning.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(arg).toBeDefined()
    // 投影必须是 id 列本身(不是整行、不是别的列),否则条数与点名都无从算起
    expect(Object.keys(arg!)).toEqual(['id'])
    expect(arg!.id).toBe(tmpTable.id)
  })

  it('② 全命中 ⇒ deleted===3、missedIds 为空数组(既有键名不变,只多一个键)', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: ID_1 }, { id: ID_2 }, { id: ID_3 }])
    const { res, body } = await batchDelete([ID_1, ID_2, ID_3])

    expect(res.statusCode).toBe(200)
    expect(body.data.deleted).toBe(3)
    expect(body.data.missedIds).toEqual([])
    // 整包形态:除新增键外与改前逐字相同(纯增字段,不改既有契约)
    expect(body).toEqual({ code: 0, message: 'success', data: { deleted: 3, missedIds: [] } })
  })

  it('③ 一个都没命中 ⇒ deleted===0(不再是 3),missedIds 等于请求全集', async () => {
    mockDeleteReturning.mockResolvedValue([])
    const { res, body } = await batchDelete([ID_1, ID_2, ID_3])

    expect(res.statusCode).toBe(200)
    expect(body.data.deleted).toBe(0)
    expect(body.data.missedIds).toEqual([ID_1, ID_2, ID_3])
  })

  it('④ 请求含重复 id ⇒ deleted 不重复计(去重语义与 batchWriteOutcome 出口一致)', async () => {
    // 请求写了 3 个但只有 2 个不同;库里两个都在 ⇒ 必须是 2,不是 3
    mockDeleteReturning.mockResolvedValue([{ id: ID_1 }, { id: ID_2 }])
    const { body } = await batchDelete([ID_1, ID_1, ID_2])

    expect(body.data.deleted).toBe(2)
    expect(body.data.missedIds).toEqual([])
  })

  it('⑤ 非法 UUID / 空清单 ⇒ 仍走 400,响应文案逐字不变', async () => {
    const app = await buildApp()

    const bad = await app.inject({ method: 'DELETE', url: BASE, payload: { ids: `${ID_1},not-a-uuid` } })
    expect(bad.statusCode).toBe(400)
    // 文案与响应形态逐字不变(error() 不带 data 键)
    expect(bad.json()).toEqual({ code: 400, message: '无效的 ID' })

    const empty = await app.inject({ method: 'DELETE', url: BASE, payload: { ids: '' } })
    expect(empty.statusCode).toBe(400)
    expect(empty.json()).toEqual({ code: 400, message: '无效的 ID' })

    await app.close()
    // 校验分支不得触达库
    expect(mockDeleteReturning).not.toHaveBeenCalled()
  })

  it('⑥ 单条删除的 deleted 也必须是库确认结果(2026-09-26 语义改造后本锁方向已反转)', async () => {
    const app = await buildApp()
    // 库里真删掉一行 ⇒ true
    mockDeleteReturning.mockResolvedValueOnce([{ id: ID_1 }])
    const hit = await app.inject({ method: 'DELETE', url: `${BASE}/${ID_1}` })
    expect(hit.statusCode).toBe(200)
    expect(hit.json()).toEqual({ code: 0, message: 'success', data: { id: ID_1, deleted: true } })

    // 库里没有这一行(打错 id / 已被别人删掉)⇒ 不再谎报成功,状态码仍 200
    mockDeleteReturning.mockResolvedValueOnce([])
    const miss = await app.inject({ method: 'DELETE', url: `${BASE}/${ID_2}` })
    expect(miss.statusCode).toBe(200)
    expect(miss.json()).toEqual({ code: 0, message: 'success', data: { id: ID_2, deleted: false } })
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
