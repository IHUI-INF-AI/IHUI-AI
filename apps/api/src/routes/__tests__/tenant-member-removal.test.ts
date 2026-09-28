// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 第二十八批(布尔 ack 族 · removed):DELETE /api/tenants/:id/members/:userId。
 *
 * 改前形态:`db.delete(tenantMembers).where(tenantId ∧ userId)` 不取回报,
 * 随后把"已移除"写死成代码常量 —— where 双过滤意味着"该用户根本不是这个租户的
 * 成员"是一条稳定可达的路径,响应上它与真移除一字不差。
 * 改后形态:删除链带 .returning,确认由命中集合派生;键名与响应形状逐字不变。
 *
 * 夹具与真 drizzle 同形:where() 产物既可 await 也可再 .returning()
 * (同 apps/api/tests/oss-files-delete.test.ts 的既有口径)。零 DB 副作用。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, mockDeleteReturning } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockDeleteReturning: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('../../db/index.js', () => ({
  db: {
    // 本文件只判 DELETE 成员路由;其余动词给最小可解析桩(不被调用也必须可 import)。
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const thenable = { then: (r: (v: unknown) => void) => Promise.resolve([]).then(r) }
        return { where: vi.fn(() => thenable), limit: vi.fn(() => thenable) }
      }),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })),
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        const settled = mockDeleteReturning()
        return {
          returning: () => settled,
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            settled.then(resolve, reject),
        }
      }),
    })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
  dbRead: {},
  dbClient: {},
}))

import { tenantRoutes } from '../tenant.js'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_USER_ID = '22222222-2222-4222-8222-222222222222'
const AUTH_HEADERS = { authorization: 'Bearer mock-tenant-token' }

function mockAuth(): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId: MEMBER_USER_ID,
    phone: '13800000000',
    familyId: '33333333-3333-4333-8333-333333333333',
    roleId: 1,
  })
}

describe('DELETE /api/tenants/:id/members/:userId — removed 由库侧命中集合派生', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _req, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({
        code: statusCode,
        message: (err as Error).message,
        data: null,
      })
    })
    await app.register(tenantRoutes, { prefix: '/api/tenants' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('删除链命中 1 行(库经 returning 回报该行)⇒ 报移除成功', async () => {
    mockDeleteReturning.mockResolvedValue([{ id: 'member-row-1' }])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/tenants/${TENANT_ID}/members/${MEMBER_USER_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.removed).toBe(true)
  })

  it('该用户不是此租户成员(where 双过滤命中 0 行)⇒ 不得报移除成功', async () => {
    mockDeleteReturning.mockResolvedValue([])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/tenants/${TENANT_ID}/members/not-a-member-uuid`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.removed).toBe(false)
  })
})
