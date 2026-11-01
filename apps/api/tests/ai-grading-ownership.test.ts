// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 出题/批改面的归属闸(2026-11-01 安全强化)。
 *
 * 修前:`/ai-grading/questions` 列表、`/ai-grading/records` 列表、删题、复核
 * 全都不带归属条件 —— `createdBy` / `studentId` 写了却从不用于判据,任意登录
 * 用户可读全站批改记录、删他人题目、替他人落复核意见。
 *
 * 现行口径:
 *  - 批改记录列表:非管理员按 `student_id = 当前用户` 过滤,管理员全量(教师面复核);
 *  - 删题:非管理员 WHERE 必须命中 `created_by = 当前用户`,不命中 ⇒ 0 行 ⇒ 404;
 *  - 复核:非管理员 WHERE 必须命中 `student_id = 当前用户`,不命中 ⇒ 404;
 *  - 管理员分支走仓库既有角色判据出口 `isSystemAdmin`(本文件断言 WHERE 里不再带归属列)。
 *
 * 断言方式:包一层 drizzle 的 `eq`,记录实际下推的列名 —— 直接看"WHERE 里有没有
 * created_by / student_id",而不是靠 mock 返回值碰运气。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { eqCalls, mockAiServiceFetch } = vi.hoisted(() => ({
  eqCalls: [] as Array<{ column: string; value: unknown }>,
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      eqCalls.push({ column: column?.name ?? '?', value })
      return actual.eq(column as never, value as never)
    },
  }
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

interface DbChain {
  then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
  from: () => DbChain
  where: () => DbChain
  orderBy: () => DbChain
  limit: () => DbChain
  offset: () => DbChain
  values: () => DbChain
  set: () => DbChain
  returning: () => DbChain
  leftJoin: () => DbChain
}

function createChain(result: unknown[] = []): DbChain {
  const chain: DbChain = {
    then: (resolve) => Promise.resolve(result).then(resolve),
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    values: () => chain,
    set: () => chain,
    returning: () => chain,
    leftJoin: () => chain,
  }
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => createChain()),
    insert: vi.fn(() => createChain()),
    update: vi.fn(() => createChain()),
    delete: vi.fn(() => createChain()),
  },
}))

import { aiGradingRoutes } from '../src/routes/ai-grading.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '11111111-1111-4111-8111-111111111111'
const QUESTION_ID = '22222222-2222-4222-8222-222222222222'
const RECORD_ID = '33333333-3333-4333-8333-333333333333'

function mockAuth(roleId = 0): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    roleId,
  } as never)
}

function columns(): string[] {
  return eqCalls.map((c) => c.column)
}

describe('AI 出题/批改面归属闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiGradingRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    eqCalls.length = 0
    mockAuth(0)
  })

  it('批改记录列表:非管理员 WHERE 带 student_id = 当前用户', async () => {
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(createChain([]) as never)
      .mockReturnValueOnce(createChain([{ count: 0 }]) as never)

    const res = await app.inject({
      method: 'GET',
      url: '/api/ai-grading/records?page=1&pageSize=10',
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(eqCalls).toContainEqual({ column: 'student_id', value: USER_ID })
  })

  it('批改记录列表:管理员(教师面)不加归属过滤,保留全量复核能力', async () => {
    mockAuth(1)
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(createChain([]) as never)
      .mockReturnValueOnce(createChain([{ count: 0 }]) as never)

    const res = await app.inject({
      method: 'GET',
      url: '/api/ai-grading/records?page=1&pageSize=10',
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(columns()).not.toContain('student_id')
  })

  it('删题:非管理员 WHERE 必须同时命中 id 与 created_by = 当前用户', async () => {
    const { db } = await import('../src/db/index.js')
    // 模拟"题目存在但不归当前用户":带归属条件的 DELETE 命中 0 行
    vi.mocked(db.delete).mockReturnValueOnce(createChain([]) as never)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/ai-grading/questions/${QUESTION_ID}`,
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(404)
    expect(eqCalls).toContainEqual({ column: 'created_by', value: USER_ID })
  })

  it('删题:本人题目照常删除(命中 1 行 → 200)', async () => {
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.delete).mockReturnValueOnce(createChain([{ id: QUESTION_ID }]) as never)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/ai-grading/questions/${QUESTION_ID}`,
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(eqCalls).toContainEqual({ column: 'created_by', value: USER_ID })
  })

  it('删题:管理员不带归属条件', async () => {
    mockAuth(1)
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.delete).mockReturnValueOnce(createChain([{ id: QUESTION_ID }]) as never)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/ai-grading/questions/${QUESTION_ID}`,
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(columns()).not.toContain('created_by')
  })

  it('复核:非管理员 WHERE 必须同时命中 id 与 student_id = 当前用户', async () => {
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.update).mockReturnValueOnce(createChain([]) as never)

    const res = await app.inject({
      method: 'POST',
      url: `/api/ai-grading/records/${RECORD_ID}/review`,
      headers: AUTH_HEADERS,
      payload: { teacherReview: '分数偏高', status: 'rejected' },
    })

    expect(res.statusCode).toBe(404)
    expect(eqCalls).toContainEqual({ column: 'student_id', value: USER_ID })
  })

  it('复核:管理员不带归属条件(可按记录 id 复核)', async () => {
    mockAuth(1)
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.update).mockReturnValueOnce(
      createChain([{ id: RECORD_ID, status: 'approved' }]) as never,
    )

    const res = await app.inject({
      method: 'POST',
      url: `/api/ai-grading/records/${RECORD_ID}/review`,
      headers: AUTH_HEADERS,
      payload: { teacherReview: '同意', status: 'approved' },
    })

    expect(res.statusCode).toBe(200)
    expect(columns()).not.toContain('student_id')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
