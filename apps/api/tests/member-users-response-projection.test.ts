// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-131:member-users 写操作响应必须显式投影,不得把 users 整行(含 passwordHash)回给前端。
 *
 * 旧行为:插件级 `request.skipResponseSanitization = true` + 写面 `.returning()` 无投影 ⇒
 * POST/PATCH/DELETE 响应携带 `passwordHash`(测试夹具值 `$2b$10$...` 原文出仓)。
 * 现口径:写面统一 `.returning(memberUserResponseColumns)`(白名单不含密码类列);
 * status 收敛为 0/1/2/3 数字枚举,4/负数/字符串一律 400。
 *
 * 夹具要点(不连库:有状态 fake db + Fastify 真实路由/真实 requireAdmin 链路):
 *  - `passwordHash` 永不出现在响应体(键与 JSON 原文双重断言);
 *  - 白名单字段存在且值正确;
 *  - 非法 status ⇒ 400;合法 0/1/2/3 ⇒ 成功。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const { mockAuthenticate, mockIsSystemAdmin, state } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockIsSystemAdmin: vi.fn(),
  state: {
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
    // `.returning()` 无参数 ⇒ 真实 DB 返回整行(旧代码泄漏 passwordHash 的等价行为);
    // 传投影对象 ⇒ 只回投影键。
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
    insert: vi.fn(() => {
      let valuesArg: Record<string, unknown> | undefined
      const chain: Record<string, unknown> = {
        values: vi.fn((arg: Record<string, unknown>) => {
          valuesArg = arg
          return chain
        }),
        returning: vi.fn(async (projection?: unknown) => {
          const now = new Date('2026-11-08T00:00:00.000Z')
          const full: Record<string, unknown> = {
            id: NEW_ID,
            username: null,
            nickname: valuesArg?.nickname ?? null,
            phone: valuesArg?.phone ?? null,
            email: valuesArg?.email ?? null,
            passwordHash: valuesArg?.passwordHash ?? null,
            avatar: 'https://www.aizhs.top/images/default-avatar.jpg',
            bio: null,
            gender: 0,
            roleId: valuesArg?.roleId ?? 0,
            status: valuesArg?.status ?? 1,
            level: valuesArg?.level ?? 0,
            isVip: 0,
            isSystemAdmin: false,
            createdAt: now,
            updatedAt: now,
          }
          state.userRows[NEW_ID] = { ...full }
          return [pickProjection(full, projection)]
        }),
      }
      return chain
    }),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  }

  return { db, dbRead: { select: vi.fn(() => selectChain(() => [])) } }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: vi.fn(async () => undefined),
}))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: mockIsSystemAdmin,
  revokeAllUserRefreshTokens: vi.fn(async () => undefined),
}))

vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn(async () => '$2b$10$FAKEHASHFORPROJECTIONTEST000000000000000000000000000'),
}))

import memberUsersRoutes from '../src/routes/admin/member-users.js'

const U1 = '11111111-1111-4111-8111-111111111111'
const NEW_ID = '44444444-4444-4444-8444-444444444444'
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const REGULAR_ID = '00000000-0000-4000-8000-000000000002'
const PREFIX = '/api/admin'

function makeRow(id: string, status = 1): Record<string, unknown> {
  return {
    id,
    username: 'member01',
    nickname: '会员一号',
    phone: '13800138000',
    email: 'member@example.com',
    passwordHash: '$2b$10$SEEDEDHASHNEVERLEAK00000000000000000000000000000000',
    avatar: 'https://www.aizhs.top/images/default-avatar.jpg',
    bio: 'bio',
    gender: 0,
    roleId: 0,
    status,
    level: 1,
    isVip: 0,
    isSystemAdmin: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(memberUsersRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

beforeEach(() => {
  state.userRows = { [U1]: makeRow(U1) }
  mockAuthenticate.mockReset()
  mockIsSystemAdmin.mockReset()
  mockIsSystemAdmin.mockResolvedValue(false)
})

const WRITE_ENDPOINTS = [
  {
    name: 'POST',
    method: 'POST' as const,
    url: `${PREFIX}/member/users`,
    payload: { nickname: '新会员', email: 'new@example.com', password: 'secret123' },
  },
  {
    name: 'PATCH',
    method: 'PATCH' as const,
    url: `${PREFIX}/member/users/${U1}`,
    payload: { status: 2 },
  },
  {
    name: 'DELETE',
    method: 'DELETE' as const,
    url: `${PREFIX}/member/users/${U1}`,
    payload: undefined,
  },
]

describe('member-users 写操作响应脱敏(F-131)', () => {
  for (const ep of WRITE_ENDPOINTS) {
    it(`① ${ep.name} 未登录 ⇒ 401`, async () => {
      asAnonymous()
      const app = await buildApp()
      try {
        const res = await app.inject({ method: ep.method, url: ep.url, payload: ep.payload })
        expect(res.statusCode).toBe(401)
      } finally {
        await app.close()
      }
    })

    it(`① ${ep.name} 非管理员 ⇒ 403`, async () => {
      asRegularUser()
      const app = await buildApp()
      try {
        const res = await app.inject({ method: ep.method, url: ep.url, payload: ep.payload })
        expect(res.statusCode).toBe(403)
        expect(res.json().code).toBe(403)
      } finally {
        await app.close()
      }
    })

    it(`② ${ep.name} 响应体不含 passwordHash(含 $2b$ 原文)`, async () => {
      asAdmin()
      const app = await buildApp()
      try {
        const res = await app.inject({ method: ep.method, url: ep.url, payload: ep.payload })
        const raw = res.body
        expect(raw).not.toContain('passwordHash')
        expect(raw).not.toContain('password_hash')
        expect(raw).not.toContain('$2b$')
        const data = res.json().data
        const payloadRow = ep.name === 'DELETE' ? data.user : data
        expect(payloadRow).not.toHaveProperty('passwordHash')
        expect(payloadRow).not.toHaveProperty('password_hash')
      } finally {
        await app.close()
      }
    })
  }

  it('③ POST 响应含白名单字段且值正确', async () => {
    asAdmin()
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: `${PREFIX}/member/users`,
        payload: { nickname: '新会员', email: 'new@example.com', password: 'secret123' },
      })
      expect(res.statusCode).toBe(201)
      const row = res.json().data as Record<string, unknown>
      expect(row).toMatchObject({
        id: NEW_ID,
        nickname: '新会员',
        email: 'new@example.com',
        phone: null,
        roleId: 0,
        status: 1,
      })
      expect(row.createdAt).toBe(new Date('2026-11-08T00:00:00.000Z').toISOString())
      expect(row.updatedAt).toBe(new Date('2026-11-08T00:00:00.000Z').toISOString())
    } finally {
      await app.close()
    }
  })

  it('③ PATCH 响应含白名单字段且值正确', async () => {
    asAdmin()
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `${PREFIX}/member/users/${U1}`,
        payload: { status: 2 },
      })
      expect(res.statusCode).toBe(200)
      const row = res.json().data as Record<string, unknown>
      expect(row).toMatchObject({
        id: U1,
        username: 'member01',
        nickname: '会员一号',
        phone: '13800138000',
        email: 'member@example.com',
        roleId: 0,
        status: 2,
      })
      expect(row.createdAt).toBe(new Date('2026-01-01T00:00:00.000Z').toISOString())
      expect(typeof row.updatedAt).toBe('string')
    } finally {
      await app.close()
    }
  })

  it('③ DELETE 响应含白名单字段且值正确', async () => {
    asAdmin()
    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'DELETE', url: `${PREFIX}/member/users/${U1}` })
      expect(res.statusCode).toBe(200)
      const row = res.json().data.user as Record<string, unknown>
      expect(row).toMatchObject({
        id: U1,
        nickname: '会员一号',
        phone: '13800138000',
        email: 'member@example.com',
        status: 3,
      })
    } finally {
      await app.close()
    }
  })

  for (const bad of [4, -1, '2']) {
    it(`④ PATCH status=${JSON.stringify(bad)} ⇒ 400`, async () => {
      asAdmin()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'PATCH',
          url: `${PREFIX}/member/users/${U1}`,
          payload: { status: bad },
        })
        expect(res.statusCode).toBe(400)
        expect(res.json().code).toBe(400)
      } finally {
        await app.close()
      }
    })

    it(`④ POST status=${JSON.stringify(bad)} ⇒ 400`, async () => {
      asAdmin()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/member/users`,
          payload: { nickname: '新会员', email: 'new@example.com', password: 'secret123', status: bad },
        })
        expect(res.statusCode).toBe(400)
        expect(res.json().code).toBe(400)
      } finally {
        await app.close()
      }
    })
  }

  for (const status of [0, 1, 2, 3] as const) {
    it(`⑤ PATCH status=${status} ⇒ 成功且回写该值`, async () => {
      asAdmin()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'PATCH',
          url: `${PREFIX}/member/users/${U1}`,
          payload: { status },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.status).toBe(status)
      } finally {
        await app.close()
      }
    })

    it(`⑤ POST status=${status} ⇒ 201 且回写该值`, async () => {
      asAdmin()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/member/users`,
          payload: { nickname: '新会员', email: 'new@example.com', password: 'secret123', status },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().data.status).toBe(status)
      } finally {
        await app.close()
      }
    })
  }
})
