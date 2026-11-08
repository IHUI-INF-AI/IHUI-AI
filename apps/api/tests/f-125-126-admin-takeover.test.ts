// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-125 / F-126 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * F-125:两个管理员改密端点(admin.ts POST /users/:id/resetPwd、
 *        admin-sys user-routes PUT /users/resetPwd)此前不判「目标是否为内置管理员」,
 *        任意 admin 都能改掉受保护账号的密码并登录 ⇒ 持久 root 接管;改密后也没吊销
 *        refresh token。判据:非本人改内置管理员 → 403 且不落库;正常目标 → 200 且吊销。
 * F-126:第三方绑定表 POST/PUT 接受任意 userId,给内置管理员绑一个可控 openId 后
 *        走第三方登录即得 root 登录态。判据:目标为内置管理员 → 403 且不写库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  systemAdminIds: new Set<string>(),
  users: new Map<string, unknown>(),
  revoked: [] as string[],
  selectRows: [] as unknown[],
  updateReturning: [] as unknown[],
  insertReturning: [] as unknown[],
  updateCalls: 0,
}))

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  // 只验证「内置管理员」判定,不掺 TOTP 绑定态查询
  process.env.ADMIN_TOTP_MODE = 'off'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown> }) => {
    const userId = request.headers['x-test-user'] as string | undefined
    if (!userId) {
      const e = new Error('Authentication required') as Error & { statusCode?: number }
      e.statusCode = 401
      throw e
    }
    const roleId = Number(request.headers['x-test-role'] ?? 0)
    Object.assign(request, { userId, jwtPayload: { userId, roleId } })
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isSystemAdminUser: vi.fn(async (id: string) => state.systemAdminIds.has(id)),
    revokeAllUserRefreshTokens: vi.fn(async (id: string) => {
      state.revoked.push(id)
    }),
  }
})

vi.mock('../src/db/admin-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserByIdAdmin: vi.fn(async (id: string) => state.users.get(id) ?? null),
  }
})

vi.mock('../src/utils/password-crypto.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, hashPassword: vi.fn(async () => 'hashed-password') }
})

function selectChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  chain.orderBy = () => chain
  chain.limit = async () => state.selectRows
  chain.then = (resolve: (v: unknown) => void) => resolve(state.selectRows)
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => selectChain(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: async () => state.insertReturning })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          const settled = {
            returning: async () => state.updateReturning,
            then: (resolve: (v: unknown) => void) => {
              state.updateCalls += 1
              resolve(undefined)
            },
          }
          return settled
        }),
      })),
    })),
  },
  dbRead: { select: () => selectChain() },
  dbClient: {},
}))

import { adminRoutes } from '../src/routes/admin.js'
import { userRoutes as adminSysUserRoutes } from '../src/routes/admin-sys/user-routes.js'
import authAccountsRoutes from '../src/routes/admin/auth-accounts.js'

const SYS = '00000000-0000-4000-8000-000000000001'
const OTHER_ADMIN = '00000000-0000-4000-8000-000000000002'
const USER = '00000000-0000-4000-8000-000000000003'
const ACC = '00000000-0000-4000-8000-000000000004'

function authHeaders(id: string): Record<string, string> {
  return { 'x-test-user': id, 'x-test-role': '1' }
}

describe('F-125 管理员改密不得越过内置管理员', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify()
    await app.register(adminRoutes, { prefix: '/api/admin' })
    // 生产挂载为 admin-sys/index.ts 的 { prefix: '/users' },此处按同一路径还原
    await app.register(adminSysUserRoutes, { prefix: '/api/admin/users' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    state.systemAdminIds.clear()
    state.users.clear()
    state.revoked.length = 0
    state.updateCalls = 0
    state.updateReturning = [{ id: USER }]
  })

  it('其他管理员 POST /users/:id/resetPwd 指向内置管理员 → 403 且不落库', async () => {
    state.systemAdminIds.add(SYS)
    state.users.set(SYS, { id: SYS })
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${SYS}/resetPwd`,
      headers: authHeaders(OTHER_ADMIN),
      payload: { newPassword: 'newpass123' },
    })
    expect(res.statusCode).toBe(403)
    expect(state.updateCalls).toBe(0)
    expect(state.revoked).toEqual([])
  })

  it('其他管理员 POST 指向普通用户 → 200 且吊销该用户 refresh token', async () => {
    state.users.set(USER, { id: USER })
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${USER}/resetPwd`,
      headers: authHeaders(OTHER_ADMIN),
      payload: { newPassword: 'newpass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(state.updateCalls).toBe(1)
    expect(state.revoked).toEqual([USER])
  })

  it('内置管理员重置自己的密码 → 200(不误伤)', async () => {
    state.systemAdminIds.add(SYS)
    state.users.set(SYS, { id: SYS })
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${SYS}/resetPwd`,
      headers: authHeaders(SYS),
      payload: { newPassword: 'newpass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(state.revoked).toEqual([SYS])
  })

  it('其他管理员 PUT /users/resetPwd 指向内置管理员 → 403 且不落库', async () => {
    state.systemAdminIds.add(SYS)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: authHeaders(OTHER_ADMIN),
      payload: { userId: SYS, password: 'newpass123' },
    })
    expect(res.statusCode).toBe(403)
    expect(state.updateCalls).toBe(0)
    expect(state.revoked).toEqual([])
  })

  it('其他管理员 PUT 指向普通用户 → 200 且吊销该用户 refresh token', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: authHeaders(OTHER_ADMIN),
      payload: { userId: USER, password: 'newpass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(state.revoked).toEqual([USER])
  })
})

describe('F-126 第三方绑定不得挂到内置管理员', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify()
    await app.register(authAccountsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    state.systemAdminIds.clear()
    state.selectRows = []
    state.insertReturning = [{ id: ACC, userId: USER }]
    state.updateReturning = [{ id: ACC, userId: USER }]
  })

  it('POST /auth-accounts 绑定内置管理员 → 403 且不写库', async () => {
    state.systemAdminIds.add(SYS)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth-accounts',
      headers: authHeaders(OTHER_ADMIN),
      payload: { userId: SYS, platform: 'wechat', openId: 'attacker-controlled' },
    })
    expect(res.statusCode).toBe(403)
    expect(state.insertReturning).toEqual([{ id: ACC, userId: USER }])
  })

  it('POST /auth-accounts 绑定普通用户 → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth-accounts',
      headers: authHeaders(OTHER_ADMIN),
      payload: { userId: USER, platform: 'wechat', openId: 'normal-openid' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('PUT /auth-accounts/:id 改绑到内置管理员名下 → 403', async () => {
    state.systemAdminIds.add(SYS)
    state.selectRows = [{ userId: SYS }]
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/auth-accounts/${ACC}`,
      headers: authHeaders(OTHER_ADMIN),
      payload: { openId: 'attacker-controlled' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('PUT /auth-accounts/:id 普通绑定 → 200(不误伤)', async () => {
    state.selectRows = [{ userId: USER }]
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/auth-accounts/${ACC}`,
      headers: authHeaders(OTHER_ADMIN),
      payload: { openId: 'normal-openid-2' },
    })
    expect(res.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
