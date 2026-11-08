// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-127:批量禁用 / 成员禁用删除必须吊销该用户全部 refresh token。
 *
 * 旧行为:单条 `PUT /admin/users/:id` 已补 `revokeAllUserRefreshTokens`,但批量
 * `POST /admin/users/batch-status` 与 `member-users` 的 PATCH/DELETE 两套写路径没有同步 ——
 * 封禁后旧 refresh 仍能换新 access token,"禁用"在会话面不生效。
 *
 * 夹具要点(不连库:有状态 fake db + Fastify 真实路由/真实 requireAdmin 链路):
 *  - 批量 status=0/2/3 时,受影响用户逐条各触发一次 revoke(计数 = 命中 ids 数);
 *  - status=1(放行)不触发 revoke;
 *  - member-users PATCH 改 status≠1 与 DELETE 各触发一次 revoke;
 *  - 既有返回码/updated/failed 计数语义逐字不变。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const { mockAuthenticate, mockRevoke, mockIsSystemAdmin, mockLogAction, state } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRevoke: vi.fn(),
  mockIsSystemAdmin: vi.fn(),
  mockLogAction: vi.fn(),
  state: {
    existingIds: [] as string[],
    userRows: {} as Record<string, Record<string, unknown>>,
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await vi.importActual<typeof import('drizzle-orm/pg-core')>(
    'drizzle-orm/pg-core',
  )
  const dialect = new PgDialect()

  function idFromWhere(whereArg: unknown): string | undefined {
    if (!whereArg) return undefined
    const q = dialect.sqlToQuery(whereArg as Parameters<PgDialect['sqlToQuery']>[0])
    return q.params[0] as string | undefined
  }

  function pickProjection(
    full: Record<string, unknown>,
    projection: unknown,
  ): Record<string, unknown> {
    if (!projection || typeof projection !== 'object') return { ...full }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(projection)) out[key] = full[key]
    return out
  }

  function selectChain(resolver: () => unknown[]) {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }

  const db = {
    select: vi.fn(() => selectChain(() => [])),
    update: vi.fn(() => {
      let setArg: Record<string, unknown> | undefined
      let whereArg: unknown
      const chain: Record<string, unknown> = {
        set: vi.fn((arg: Record<string, unknown>) => {
          setArg = arg
          return chain
        }),
        where: vi.fn((arg: unknown) => {
          whereArg = arg
          return chain
        }),
        returning: vi.fn(async (projection?: unknown) => {
          const id = idFromWhere(whereArg)
          const row = id ? state.userRows[id] : undefined
          if (!row) return []
          Object.assign(row, setArg)
          return [pickProjection(row, projection)]
        }),
      }
      return chain
    }),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  }

  return {
    db,
    dbRead: {
      select: vi.fn(() => selectChain(() => state.existingIds.map((id) => ({ id })))),
    },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: vi.fn(async () => undefined),
}))

vi.mock('../src/db/queries.js', () => ({
  revokeAllUserRefreshTokens: mockRevoke,
  isSystemAdminUser: mockIsSystemAdmin,
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: mockLogAction,
}))

import { userRoutes } from '../src/routes/admin-extended/user-routes.js'
import memberUsersRoutes from '../src/routes/admin/member-users.js'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const MISSING = '33333333-3333-4333-8333-333333333333'
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const REGULAR_ID = '00000000-0000-4000-8000-000000000002'

function makeRow(id: string, status = 1): Record<string, unknown> {
  return {
    id,
    username: `member-${id.slice(0, 4)}`,
    nickname: '会员',
    phone: '13800138000',
    email: `${id.slice(0, 4)}@example.com`,
    passwordHash: '$2b$10$SEEDEDHASH',
    roleId: 0,
    status,
    level: 0,
    isVip: 0,
    isSystemAdmin: false,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  }
}

function asAdmin(): void {
  mockAuthenticate.mockImplementation(async (request: Record<string, unknown>) => {
    request.userId = ADMIN_ID
    request.jwtPayload = { userId: ADMIN_ID, roleId: 1 }
  })
}

function asRegularUser(): void {
  mockAuthenticate.mockImplementation(async (request: Record<string, unknown>) => {
    request.userId = REGULAR_ID
    request.jwtPayload = { userId: REGULAR_ID, roleId: 0 }
  })
}

function asAnonymous(): void {
  mockAuthenticate.mockImplementation(async () => {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
  })
}

async function buildBatchApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(userRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

async function buildMemberApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(memberUsersRoutes, { prefix: '/api/admin' })
  await app.ready()
  return app
}

beforeEach(() => {
  state.existingIds = []
  state.userRows = {}
  mockAuthenticate.mockReset()
  mockRevoke.mockReset()
  mockIsSystemAdmin.mockReset()
  mockIsSystemAdmin.mockResolvedValue(false)
  mockLogAction.mockReset()
})

describe('POST /api/admin/users/batch-status — 批量禁用吊销 refresh', () => {
  it('① 未登录 ⇒ 401,零更新/零吊销', async () => {
    asAnonymous()
    const app = await buildBatchApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/users/batch-status',
        payload: { ids: [U1, U2], status: 2 },
      })
      expect(res.statusCode).toBe(401)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('① 非管理员 ⇒ 403,零更新/零吊销', async () => {
    asRegularUser()
    const app = await buildBatchApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/users/batch-status',
        payload: { ids: [U1, U2], status: 2 },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(403)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  for (const status of [0, 2, 3] as const) {
    it(`② status=${status} ⇒ 每个受影响用户各吊销一次(计数=ids 数)`, async () => {
      asAdmin()
      state.existingIds = [U1, U2]
      state.userRows = { [U1]: makeRow(U1), [U2]: makeRow(U2) }
      const app = await buildBatchApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/users/batch-status',
          payload: { ids: [U1, U2], status },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data).toEqual({ updated: 2, failed: [] })
        expect(mockRevoke).toHaveBeenCalledTimes(2)
        expect(mockRevoke.mock.calls.map((c) => c[0])).toEqual([U1, U2])
        expect(state.userRows[U1]?.status).toBe(status)
        expect(state.userRows[U2]?.status).toBe(status)
      } finally {
        await app.close()
      }
    })
  }

  it('③ status=1(放行)⇒ 不触发 revoke', async () => {
    asAdmin()
    state.existingIds = [U1, U2]
    state.userRows = { [U1]: makeRow(U1, 2), [U2]: makeRow(U2, 2) }
    const app = await buildBatchApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/users/batch-status',
        payload: { ids: [U1, U2], status: 1 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ updated: 2, failed: [] })
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('⑤ 既有返回/计数语义不变:不存在的 id 只计 failed、不吊销', async () => {
    asAdmin()
    state.existingIds = [U1]
    state.userRows = { [U1]: makeRow(U1) }
    const app = await buildBatchApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/users/batch-status',
        payload: { ids: [U1, MISSING], status: 2 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ updated: 1, failed: [{ id: MISSING, reason: '不存在' }] })
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockRevoke.mock.calls[0]?.[0]).toBe(U1)
    } finally {
      await app.close()
    }
  })
})

describe('member-users PATCH/DELETE — 禁用/删除吊销 refresh', () => {
  it('① PATCH 未登录 ⇒ 401,零吊销', async () => {
    asAnonymous()
    const app = await buildMemberApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${U1}`,
        payload: { status: 2 },
      })
      expect(res.statusCode).toBe(401)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('① PATCH 非管理员 ⇒ 403,零吊销', async () => {
    asRegularUser()
    const app = await buildMemberApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${U1}`,
        payload: { status: 2 },
      })
      expect(res.statusCode).toBe(403)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('① DELETE 未登录/非管理员 ⇒ 401/403,零吊销', async () => {
    const anonApp = await buildMemberApp()
    const userApp = await buildMemberApp()
    try {
      asAnonymous()
      const anonRes = await anonApp.inject({
        method: 'DELETE',
        url: `/api/admin/member/users/${U1}`,
      })
      expect(anonRes.statusCode).toBe(401)
      asRegularUser()
      const userRes = await userApp.inject({
        method: 'DELETE',
        url: `/api/admin/member/users/${U1}`,
      })
      expect(userRes.statusCode).toBe(403)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await anonApp.close()
      await userApp.close()
    }
  })

  it('④ PATCH status=2 ⇒ 吊销一次且返回 200', async () => {
    asAdmin()
    state.userRows = { [U1]: makeRow(U1) }
    const app = await buildMemberApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${U1}`,
        payload: { status: 2 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.status).toBe(2)
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockRevoke.mock.calls[0]?.[0]).toBe(U1)
    } finally {
      await app.close()
    }
  })

  it('④ PATCH status=1(放行)⇒ 不触发 revoke', async () => {
    asAdmin()
    state.userRows = { [U1]: makeRow(U1, 2) }
    const app = await buildMemberApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${U1}`,
        payload: { status: 1 },
      })
      expect(res.statusCode).toBe(200)
      expect(mockRevoke).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('④ DELETE ⇒ 吊销一次,库内 status=3', async () => {
    asAdmin()
    state.userRows = { [U1]: makeRow(U1) }
    const app = await buildMemberApp()
    try {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/member/users/${U1}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.status).toBe(3)
      expect(state.userRows[U1]?.status).toBe(3)
      expect(mockRevoke).toHaveBeenCalledTimes(1)
      expect(mockRevoke.mock.calls[0]?.[0]).toBe(U1)
    } finally {
      await app.close()
    }
  })
})
