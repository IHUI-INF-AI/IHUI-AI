// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * F-128(P2,数据泄露):`PUT /api/admin/users/resetPwd` 原先由审计钩子
 * `JSON.stringify(request.body).slice(0,2000)` 把明文 password 原样写进
 * `sys_operlog.operParam`,任何能读操作日志的后台角色都可拿到他人密码。
 *
 * 本文件钉住修复后的边界:
 *  ① resetPwd 请求落库的 operParam 中不出现任何明文凭据(含嵌套/数组、驼峰/下划线变体);
 *  ② 正常字段(userId/remark 及非敏感嵌套字段)仍被完整记录,不是一脱了之;
 *  ③ 响应体不回显明文密码;
 *  ④ 鉴权行为不变:未登录 401、非管理员 403,且这两条被拒请求的审计同样已脱敏。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    operlogs: [] as Record<string, unknown>[],
    adminUser: '00000000-0000-4000-8000-0000000000a1',
    targetUser: '00000000-0000-4000-8000-0000000000b2',
  }
})

// 真实 createOperlog 仍走这个 db 假实现:insert 的 values 就是最终落库行,直接留证。
vi.mock('../src/db/index.js', () => {
  const db = {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ id: h.targetUser }],
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve([]).then(resolve, reject),
        }),
      }),
    }),
    insert: () => ({
      values: (data: Record<string, unknown>) => {
        h.operlogs.push(data)
        return { returning: async () => [data] }
      },
    }),
    select: () => {
      throw new Error('unexpected db.select in this fixture')
    },
    execute: async () => [],
  }
  return { db, dbRead: db, dbClient: {} }
})

const { mockIsSystemAdminUser, mockRevokeAllUserRefreshTokens, mockHashPassword } = vi.hoisted(() => ({
  mockIsSystemAdminUser: vi.fn().mockResolvedValue(false),
  mockRevokeAllUserRefreshTokens: vi.fn().mockResolvedValue(undefined),
  mockHashPassword: vi.fn().mockResolvedValue('$argon2id$v=19$m=19456,t=2,p=1$fakehash'),
}))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: mockIsSystemAdminUser,
  revokeAllUserRefreshTokens: mockRevokeAllUserRefreshTokens,
}))
vi.mock('../src/utils/password-crypto.js', () => ({ hashPassword: mockHashPassword }))

/** 只替换鉴权闸本体;roleId >= 1 为管理员,与真实 requireAdmin 语义一致。 */
vi.mock('../src/plugins/require-permission.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
  }
  const authenticate = (request: MockRequest, reply: MockReply): boolean => {
    const role = request.headers['x-test-role']
    if (!role) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
    return true
  }
  const requireAdmin = async (request: MockRequest, reply: MockReply): Promise<void> => {
    if (!authenticate(request, reply)) return
    if ((request.jwtPayload?.roleId ?? 0) < 1) {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
    }
  }
  return {
    requireAuth: async (request: MockRequest, reply: MockReply) => {
      authenticate(request, reply)
    },
    requireAdmin,
  }
})

import { requireAdmin } from '../src/plugins/require-permission.js'
import { operlogAuditOnResponse } from '../src/routes/admin-sys/_audit-hook.js'
import { userRoutes } from '../src/routes/admin-sys/user-routes.js'

const PLAIN_PASSWORD = 'F128-PlainPwd-9x'
const PLAIN_NEW_PASSWORD = 'F128-NewPwd-7y'
const PLAIN_SNAKE_PASSWORD = 'F128-SnakePwd-8z'
const PLAIN_TOKEN = 'F128-AccessToken-6t'
const PLAIN_API_KEY = 'F128-ApiKey-5k'
const PLAIN_SECRET = 'F128-Secret-4s'
const PLAIN_ARRAY_PASSWORD = 'F128-ArrayPwd-3a'
const NORMAL_REMARK = '运维工单-123'
const NORMAL_NOTE = '保留我'
const NORMAL_ARRAY_VALUE = 'visible-value'

const BODY = {
  userId: h.targetUser,
  password: PLAIN_PASSWORD,
  newPassword: PLAIN_NEW_PASSWORD,
  new_password: PLAIN_SNAKE_PASSWORD,
  remark: NORMAL_REMARK,
  meta: {
    token: PLAIN_TOKEN,
    accessToken: PLAIN_TOKEN,
    apiKey: PLAIN_API_KEY,
    api_key: PLAIN_API_KEY,
    secret: PLAIN_SECRET,
    note: NORMAL_NOTE,
  },
  items: [{ password: PLAIN_ARRAY_PASSWORD }, { ok: NORMAL_ARRAY_VALUE }],
}

const ALL_PLAINTEXT = [
  PLAIN_PASSWORD,
  PLAIN_NEW_PASSWORD,
  PLAIN_SNAKE_PASSWORD,
  PLAIN_TOKEN,
  PLAIN_API_KEY,
  PLAIN_SECRET,
  PLAIN_ARRAY_PASSWORD,
]

function adminHeaders(userId = h.adminUser, roleId = 1) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function waitForOperlog(count = 1): Promise<Record<string, unknown>[]> {
  const deadline = Date.now() + 2_000
  while (h.operlogs.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return h.operlogs
}

describe('F-128 resetPwd 明文密码不得进入操作日志', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // admin-sys 主插件的装配:requireAdmin 前置 + onResponse 审计钩子 + user 子路由。
    await app.register(
      async (scope) => {
        scope.addHook('preHandler', requireAdmin)
        scope.addHook('onResponse', operlogAuditOnResponse)
        await scope.register(userRoutes, { prefix: '/users' })
      },
      { prefix: '/api/admin' },
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.operlogs.length = 0
    vi.clearAllMocks()
    mockIsSystemAdminUser.mockResolvedValue(false)
    mockRevokeAllUserRefreshTokens.mockResolvedValue(undefined)
    mockHashPassword.mockResolvedValue('$argon2id$v=19$m=19456,t=2,p=1$fakehash')
  })

  it('管理员重置密码:200,响应体与落库 operParam 均无明文,正常字段仍记录', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: adminHeaders(),
      payload: BODY,
    })

    expect(res.statusCode).toBe(200)
    for (const secret of ALL_PLAINTEXT) expect(res.body).not.toContain(secret)
    expect(res.json()).toEqual({ code: 0, message: 'success', data: { success: true } })

    const rows = await waitForOperlog(1)
    expect(rows).toHaveLength(1)
    const row = rows[0]!

    // 正常字段仍被记录(不能一脱了之)。
    expect(row.title).toBe('用户管理')
    expect(row.requestMethod).toBe('PUT')
    expect(row.businessType).toBe(2)
    expect(row.status).toBe(0)
    expect(row.operName).toBe(h.adminUser)

    const operParam = String(row.operParam)
    expect(operParam.length).toBeLessThanOrEqual(2000)
    for (const secret of ALL_PLAINTEXT) expect(operParam).not.toContain(secret)
    expect(operParam).toContain('[REDACTED]')

    const parsed = JSON.parse(operParam) as {
      userId: string
      password: string
      newPassword: string
      new_password: string
      remark: string
      meta: Record<string, string>
      items: Record<string, string>[]
    }
    expect(parsed.userId).toBe(h.targetUser)
    expect(parsed.remark).toBe(NORMAL_REMARK)
    expect(parsed.password).toBe('[REDACTED]')
    expect(parsed.newPassword).toBe('[REDACTED]')
    expect(parsed.new_password).toBe('[REDACTED]')
    expect(parsed.meta.token).toBe('[REDACTED]')
    expect(parsed.meta.accessToken).toBe('[REDACTED]')
    expect(parsed.meta.apiKey).toBe('[REDACTED]')
    expect(parsed.meta.api_key).toBe('[REDACTED]')
    expect(parsed.meta.secret).toBe('[REDACTED]')
    expect(parsed.meta.note).toBe(NORMAL_NOTE)
    expect(parsed.items[0]?.password).toBe('[REDACTED]')
    expect(parsed.items[1]?.ok).toBe(NORMAL_ARRAY_VALUE)
  })

  it('未登录:401 保持,被拒请求的审计日志同样不含明文', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      payload: { userId: h.targetUser, password: PLAIN_PASSWORD },
    })
    expect(res.statusCode).toBe(401)
    expect(res.body).not.toContain(PLAIN_PASSWORD)

    const rows = await waitForOperlog(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe(1)
    expect(String(rows[0]?.operParam)).not.toContain(PLAIN_PASSWORD)
    expect(String(rows[0]?.operParam)).toContain('[REDACTED]')
  })

  it('非管理员:403 保持,被拒请求的审计日志同样不含明文', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: adminHeaders(h.adminUser, 0),
      payload: { userId: h.targetUser, password: PLAIN_PASSWORD },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).not.toContain(PLAIN_PASSWORD)

    const rows = await waitForOperlog(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe(1)
    expect(String(rows[0]?.operParam)).not.toContain(PLAIN_PASSWORD)
    expect(String(rows[0]?.operParam)).toContain('[REDACTED]')
  })
})
