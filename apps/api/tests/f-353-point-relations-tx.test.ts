// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-353 回归锁(2026-11-13)。
 *
 * 病灶:updatePointRelations 的 delete 与 insert 是两条独立语句、不在事务;
 * channelIds 无存在性校验 ⇒ 任一无效 id/瞬时错误就"删了没插"(配置清空),
 * 并发两次 PUT 结果落成并集。
 *
 * 本文件锁:
 *   ① 合法 channelIds:同一事务内 先校验 → delete → insert(事务包裹 + 顺序);
 *   ② 含不存在 channelId:只校验、不删不插,抛 400 业务错误;
 *   ③ 校验查询是 inArray(eduPointChannels.id, channelIds) 形态;
 *   ④ PUT /api/admin/edu-points/relations 对无效渠道回 400(不是 500)。
 *
 * 全程 mock db,不连 PG/Redis。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as DrizzleOrmModule from 'drizzle-orm'
import { eduPointChannels } from '@ihui/database'

const harness = vi.hoisted(() => {
  const calls: string[] = []
  const inArrayArgs: unknown[][] = []
  const channels: Array<{ id: string }> = []
  const pointRows: Array<{ id: string }> = []
  return { calls, inArrayArgs, channels, pointRows }
})

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrmModule>()
  return {
    ...actual,
    inArray: (column: unknown, values: unknown) => {
      harness.inArrayArgs.push([column, values])
      return actual.inArray(column as never, values as never)
    },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async () => true),
  authenticate: vi.fn(async () => true),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

vi.mock('../src/db/index.js', () => {
  interface Chain {
    from: () => Chain
    where: () => Chain
    limit: () => Promise<unknown>
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => Promise<unknown>
  }
  const makeSelect = (label: string, rows: () => unknown): Chain => {
    harness.calls.push(label)
    const chain: Chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows()),
      then: (onOk, onErr) => Promise.resolve(rows()).then(onOk, onErr),
    }
    return chain
  }
  const makeWrite = (label: 'delete' | 'insert'): Record<string, unknown> => {
    harness.calls.push(label)
    const chain: Record<string, unknown> = {}
    chain.where = () => Promise.resolve([])
    chain.values = () => Promise.resolve([])
    return chain
  }
  const tx = {
    select: () => makeSelect('select', () => harness.channels),
    delete: () => makeWrite('delete'),
    insert: () => makeWrite('insert'),
  }
  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    select: () => makeSelect('db.select', () => harness.pointRows),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { db } from '../src/db/index.js'
import { updatePointRelations } from '../src/db/point-queries.js'
import { adminPointRoutes } from '../src/routes/point.js'

const POINT = '33333333-3333-4333-8333-333333333333'
const CH1 = '11111111-1111-4111-8111-111111111111'
const CH2 = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  harness.calls.length = 0
  harness.inArrayArgs.length = 0
  harness.channels.length = 0
  harness.pointRows.length = 0
  vi.mocked(db.transaction).mockClear()
})

describe('F-353 updatePointRelations 事务化', () => {
  it('① 合法渠道:同一事务内先校验,再 delete + insert', async () => {
    harness.channels.push({ id: CH1 }, { id: CH2 })

    const result = await updatePointRelations(POINT, [CH1, CH2])

    expect(result).toEqual({ pointId: POINT, channelIds: [CH1, CH2] })
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1)
    expect(harness.calls).toEqual(['select', 'delete', 'insert'])
  })

  it('② 含不存在的渠道:只校验,不 delete 不 insert,抛 400 业务错', async () => {
    harness.channels.push({ id: CH1 })

    await expect(updatePointRelations(POINT, [CH1, CH2])).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 400,
      errorCode: 'VALIDATION_FAILED',
    })
    expect(harness.calls).toEqual(['select'])
    expect(harness.calls).not.toContain('delete')
    expect(harness.calls).not.toContain('insert')
  })

  it('③ 校验查询使用 inArray(eduPointChannels.id, channelIds)', async () => {
    harness.channels.push({ id: CH1 }, { id: CH2 })

    await updatePointRelations(POINT, [CH1, CH2])

    expect(harness.inArrayArgs).toHaveLength(1)
    const [column, values] = harness.inArrayArgs[0]!
    expect(column).toBe(eduPointChannels.id)
    expect(values).toEqual([CH1, CH2])
  })
})

describe('F-353 PUT /api/admin/edu-points/relations', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPointRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('④ 无效渠道回 400 且带明确文案', async () => {
    harness.pointRows.push({ id: POINT })
    harness.channels.push({ id: CH1 })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/relations',
      payload: { pointId: POINT, channelIds: [CH1, CH2] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('渠道不存在')
  })
})
