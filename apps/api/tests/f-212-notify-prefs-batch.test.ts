// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-212 回归锁(2026-11-13)。
 *
 * 病灶:PUT /api/settings/notification 的 body schema 是裸 z.record(不限键数),
 * handler 又对每个键各发一条 upsert 并包进 Promise.all ⇒ 数万键的单请求放大成
 * 数万次 DB 往返,可打爆连接池。
 *
 * 本文件锁:
 *   ① 超过键数上限 ⇒ 400,且一次库写都不发生;
 *   ② 合法键集 ⇒ 只发一次批量写(insert 调用 1 次、values 一次带齐全部行),不是 N 次;
 *   ③ 既有键约束(1~100 字符)仍生效,非法键 400 且不写库;
 *   ④ 返回结构与成功语义不变:.returning 回库确认,少回的键如实进 missedIds。
 *
 * 只 mock db / auth / require-permission / password-crypto,不触达 PG、Redis、
 * 真实 ai-service。风格照抄 tests/f-99-career-advice-auth.test.ts。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  writes: [] as Array<Array<Record<string, unknown>>>,
  returningKeys: null as string[] | null,
}))

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  function insertChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    chain.values = (rows: Array<Record<string, unknown>>) => {
      state.writes.push(rows)
      return chain
    }
    chain.onConflictDoUpdate = () => chain
    chain.returning = () => {
      const rows = state.writes.at(-1) ?? []
      const keys = state.returningKeys ?? rows.map((row) => String(row.key))
      return Promise.resolve(keys.map((key) => ({ id: `id-${key}`, key })))
    }
    return chain
  }
  mocks.insert.mockImplementation(() => insertChain())
  const dbMock = {
    select: vi.fn(),
    insert: mocks.insert,
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {}, dbScoped: dbMock }
})

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, checkAuth: mocks.checkAuth }
})

vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, requireAdmin: async () => {} }
})

vi.mock('../src/utils/password-crypto.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    hashPassword: vi.fn(async () => 'hashed'),
    verifyPassword: vi.fn(async () => true),
  }
})

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'

const USER_ID = '00000000-0000-4000-8000-000000000212'
const URL = '/api/settings/notification'
const LEGAL_PAYLOAD: Record<string, unknown> = {
  apiError: true,
  quotaWarning: false,
  weeklyReport: 'true',
}

describe('F-212 通知偏好 PUT:键数封顶 + 单次批量 upsert', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(miniappCompatRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.writes.length = 0
    state.returningKeys = null
    mocks.checkAuth.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
      return true
    })
  })

  const call = (payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: URL, payload })

  it('① 超过键数上限(101 键)⇒ 400,且不写库', async () => {
    const payload = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`key${i}`, true]))

    const res = await call(payload)
    expect(res.statusCode).toBe(400)
    const body = res.json() as { code: number; message: string }
    expect(body.code).toBe(400)
    expect(body.message).toContain('最多支持 100 个键')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(state.writes).toHaveLength(0)
  })

  it('② 合法键集 ⇒ 一次批量写(insert 调用 1 次,values 一次带齐 3 行)', async () => {
    const res = await call(LEGAL_PAYLOAD)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { success: true, requested: 3, affected: 3, missedIds: [] },
    })
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]).toHaveLength(3)
    expect(state.writes[0]!.map((row) => row.key).sort()).toEqual([
      'apiError',
      'quotaWarning',
      'weeklyReport',
    ])
    for (const row of state.writes[0]!) {
      expect(row.userId).toBe(USER_ID)
      expect(row.group).toBe('notifications')
    }
  })

  it('③ 非法键(超过 100 字符)仍被拒:400 且不写库', async () => {
    const res = await call({ ['x'.repeat(101)]: true })

    expect(res.statusCode).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(state.writes).toHaveLength(0)
  })

  it('④ 返回结构不变:少回的键如实进 missedIds,success=false', async () => {
    state.returningKeys = ['apiError', 'quotaWarning']

    const res = await call(LEGAL_PAYLOAD)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { success: false, requested: 3, affected: 2, missedIds: ['weeklyReport'] },
    })
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })
})
