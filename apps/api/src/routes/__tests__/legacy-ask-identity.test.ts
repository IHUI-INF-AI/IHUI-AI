// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-04 回归(2026-11-08):legacy-ask 四个成员接口曾按 query.userId 取数,
 * 任意登录用户改查询串即可读取他人问答/计数。主体必须取认证身份 request.userId。
 *
 * 改前必红口径:认证态 USER_A,请求带 ?userId=USER_B;旧实现 SQL 绑定 USER_B(断言失败),
 * 新实现对 query.userId 视而不见,SQL/where 只出现 USER_A。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const dbMock = vi.hoisted(() => {
  const A = 'aaaaaaaa-1111-4111-8111-111111111111'
  const B = 'bbbbbbbb-2222-4222-8222-222222222222'
  const whereArgs: unknown[] = []
  function strings(node: unknown, out: string[] = [], depth = 0): string[] {
    // drizzle `sql` 模板把插值裸放进 queryChunks(sql.js:288),StringChunk.value 是数组;
    // 三种形态都要收:裸字符串 / StringChunk 数组成员 / 对象上的 .value。
    if (typeof node === 'string') {
      out.push(node)
      return out
    }
    if (depth > 6 || node === null || typeof node !== 'object') return out
    const record = node as Record<string, unknown>
    if (typeof record.value === 'string') out.push(record.value)
    for (const value of Object.values(record)) strings(value, out, depth + 1)
    return out
  }
  const execute = vi.fn(async (query: unknown) => {
    // 旧实现会把伪造的 query.userId 绑进 SQL;新实现只绑认证态。用返回计数表达差异。
    const values = strings(query)
    if (values.includes(B)) return [{ count: 7 }]
    if (values.includes(A)) return [{ count: 3 }]
    return [{ count: 0 }]
  })
  const select = vi.fn(() => ({
    from: () => ({
      where: (w: unknown) => {
        whereArgs.push(w)
        return {
          limit: () => ({ offset: async () => [] }),
          orderBy: () => ({ limit: () => ({ offset: async () => [] }) }),
        }
      },
    }),
  }))
  return { execute, select, whereArgs, A, B }
})

vi.mock('../../db/index.js', () => ({ db: { execute: dbMock.execute, select: dbMock.select } }))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'aaaaaaaa-1111-4111-8111-111111111111'
    return { userId: 'aaaaaaaa-1111-4111-8111-111111111111' }
  }),
}))

import { legacyAskRoutes } from '../legacy-ask.js'

const USER_A = dbMock.A
const USER_B = dbMock.B
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function collectStringValues(node: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (depth > 6 || node === null || typeof node !== 'object') return out
  const record = node as Record<string, unknown>
  if (typeof record.value === 'string') out.push(record.value)
  for (const value of Object.values(record)) collectStringValues(value, out, depth + 1)
  return out
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  await app.register(legacyAskRoutes, { prefix: '/api/legacy' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.whereArgs.length = 0
})

describe('F-04 legacy-ask 成员接口主体取认证身份', () => {
  it('question-count 忽略 query.userId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/ask/member/question-count?userId=${USER_B}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    // 旧实现绑 USER_B → 计数 7;新实现只绑认证态 → 3。
    expect(res.json().count).toBe(3)
  })

  it('answer-count 忽略 query.userId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/ask/member/answer-count?userId=${USER_B}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().count).toBe(3)
  })

  it('questions 列表 where 绑定认证主体', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/ask/member/questions?userId=${USER_B}&page=1&pageSize=10`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const questionValues = collectStringValues(dbMock.whereArgs[0])
    expect(questionValues).toContain(USER_A)
    expect(questionValues).not.toContain(USER_B)
  })

  it('answers 列表 where 绑定认证主体', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/legacy/ask/member/answers?userId=${USER_B}&page=1&pageSize=10`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const answerValues = collectStringValues(dbMock.whereArgs[0])
    expect(answerValues).toContain(USER_A)
    expect(answerValues).not.toContain(USER_B)
  })
})
