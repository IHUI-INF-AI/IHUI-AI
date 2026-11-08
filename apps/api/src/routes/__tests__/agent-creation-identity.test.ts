// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-06 回归(2026-11-08):POST /api/agent/creation/my/:type 曾用 `body.userId ?? req.userId`,
 * 客户端自报优先,可读他人创作列表。身份一律取认证态 req.userId,body.userId 直接删除。
 *
 * 改前必红口径:认证态 USER_A,body 注入 userId=USER_B;旧实现 where 绑定 USER_B(断言失败),
 * 新实现只出现 USER_A。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const dbMock = vi.hoisted(() => {
  const whereArgs: unknown[] = []
  const select = vi.fn(() => ({
    from: () => ({
      where: (w: unknown) => {
        whereArgs.push(w)
        return {
          orderBy: () => ({ limit: () => ({ offset: async () => [] }) }),
        }
      },
    }),
  }))
  return { select, whereArgs }
})

vi.mock('../../db/index.js', () => ({ db: { select: dbMock.select } }))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = 'aaaaaaaa-1111-4111-8111-111111111111'
  },
  requireAdmin: async () => {},
}))

import agentCreationPlugin from '../agent-creation.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function collectStringValues(node: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 5 || node === null || typeof node !== 'object') return out
  const record = node as Record<string, unknown>
  if (typeof record.value === 'string') out.push(record.value)
  for (const value of Object.values(record)) collectStringValues(value, out, depth + 1)
  return out
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  await app.register(agentCreationPlugin)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.whereArgs.length = 0
})

describe('F-06 我的创作主体取认证身份', () => {
  it('agent 列表忽略 body.userId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/creation/my/agent',
      headers: AUTH_HEADERS,
      payload: { userId: USER_B, page: 1, pageSize: 10 },
    })
    expect(res.statusCode).toBe(200)
    const values = collectStringValues(dbMock.whereArgs[0])
    expect(values).toContain(USER_A)
    expect(values).not.toContain(USER_B)
  })
})
