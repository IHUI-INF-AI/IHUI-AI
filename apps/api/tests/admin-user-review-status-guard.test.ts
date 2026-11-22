// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-129:单条审核 `POST /admin/users/:id/review` 与 `/audit` 不得无条件置 status=1。
 *
 * 旧写法 `.where(eq(users.id, id))` 只按主键过滤 ⇒ 对已封禁(2)/已注销(3)的用户再点一次
 * "审核通过",会把它们无条件复活成 1。现口径:把「仅待审核(status=0)可放行」写进 SQL 条件
 * (and(id, status=0),原子,避免 TOCTOU);0 行被翻转时再查一次:不存在 → 404、
 * status=1 → 幂等 200(注释里已写明选择)、其余 → 409(拒绝复活);非 uuid 在进 SQL 前 400。
 *
 * 夹具要点(不连库:有状态 fake db + Fastify 真实路由/真实 requireAdmin 链路):
 *  - fake db 的 UPDATE ... RETURNING 只有在 where 编译后带 `"status"` 等值条件且行状态命中时才回报行。
 *    因此删掉条件写 ⇒ 封禁/注销用例会拿到 200 而不是 409(旧代码正是如此,红夹具已验证)。
 *  - 成功路径断言审计恰好一条(动作名按端点区分),封禁/注销/不存在/非 uuid 一律零审计。
 *  - 覆盖表里同时跑 /review 与 /audit,证明两处同判据。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const { mockAuthenticate, mockLogAction, state } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockLogAction: vi.fn(),
  state: {
    userRow: null as Record<string, unknown> | null,
    updateCalls: 0,
    selectCalls: 0,
    updateWhereArgs: [] as unknown[],
    updateSetArgs: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await vi.importActual<{ PgDialect: typeof PgDialect }>(
    'drizzle-orm/pg-core',
  )
  const dialect = new PgDialect()

  /** 模拟真实条件写:where 里没有 status 等值条件 ⇒ 无条件命中(旧行为);有 ⇒ 只有状态相符才命中。 */
  function rowMatches(whereArg: unknown, row: Record<string, unknown>): boolean {
    if (whereArg === undefined) return true
    const compiled = dialect.sqlToQuery(whereArg as Parameters<PgDialect['sqlToQuery']>[0])
    if (!/"status"/.test(compiled.sql)) return true
    return row.status === compiled.params[compiled.params.length - 1]
  }

  function selectChain() {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'orderBy', 'groupBy']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(state.userRow ? [{ ...state.userRow }] : []).then(resolve, reject)
    return chain
  }

  return {
    db: {
      select: vi.fn(() => {
        state.selectCalls++
        return selectChain()
      }),
      update: vi.fn(() => {
        let setArg: Record<string, unknown> | undefined
        let whereArg: unknown
        const chain: Record<string, unknown> = {
          set: vi.fn((arg: Record<string, unknown>) => {
            setArg = arg
            state.updateSetArgs.push(arg)
            return chain
          }),
          where: vi.fn((arg: unknown) => {
            whereArg = arg
            state.updateWhereArgs.push(arg)
            return chain
          }),
          returning: vi.fn(async () => {
            state.updateCalls++
            const row = state.userRow
            if (!row) return []
            if (!rowMatches(whereArg, row)) return []
            Object.assign(row, setArg)
            return [{ ...row }]
          }),
        }
        return chain
      }),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => selectChain()) },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: vi.fn(async () => undefined),
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: mockLogAction,
}))

import { userRoutes } from '../src/routes/admin-extended/user-routes.js'

const PREFIX = '/api'
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const REGULAR_ID = '00000000-0000-4000-8000-000000000002'
const TARGET_ID = '11111111-1111-4111-8111-111111111111'
const MISSING_ID = '22222222-2222-4222-8222-222222222222'

function makeUser(status: number) {
  return {
    id: TARGET_ID,
    nickname: '待审用户',
    roleId: 0,
    status,
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

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(userRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

function lastUpdateWhereSql(): string {
  const arg = state.updateWhereArgs[state.updateWhereArgs.length - 1]
  if (arg === undefined) return ''
  return new PgDialect().sqlToQuery(arg as Parameters<PgDialect['sqlToQuery']>[0]).sql
}

beforeEach(() => {
  state.userRow = null
  state.updateCalls = 0
  state.selectCalls = 0
  state.updateWhereArgs.length = 0
  state.updateSetArgs.length = 0
  mockAuthenticate.mockReset()
  mockLogAction.mockReset()
})

const ENDPOINTS = [
  { name: '/review', path: 'review', action: 'user.review' },
  { name: '/audit', path: 'audit', action: 'user.audit' },
] as const

for (const ep of ENDPOINTS) {
  describe(`POST /admin/users/:id/${ep.path}`, () => {
    it('① 未登录 ⇒ 401,零 DB 写', async () => {
      asAnonymous()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${TARGET_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(401)
        expect(state.updateCalls).toBe(0)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('② 非管理员 ⇒ 403,零 DB 写', async () => {
      asRegularUser()
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${TARGET_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(403)
        expect(res.json().code).toBe(403)
        expect(state.updateCalls).toBe(0)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('③ status=0 ⇒ 200、库内变 1、审计恰好一条', async () => {
      asAdmin()
      state.userRow = makeUser(0)
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${TARGET_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.code).toBe(0)
        expect(body.data.status).toBe(1)
        expect(state.userRow?.status).toBe(1)
        expect(state.updateSetArgs[0]?.status).toBe(1)
        expect(state.updateSetArgs[0]?.updatedAt).toBeInstanceOf(Date)
        // 条件写真的进了 SQL:仅 status=0 命中
        expect(lastUpdateWhereSql()).toMatch(/"status"\s*=\s*\$/)
        expect(mockLogAction).toHaveBeenCalledTimes(1)
        const audit = mockLogAction.mock.calls[0]?.[0] as Record<string, unknown>
        expect(audit.action).toBe(ep.action)
        expect(audit.resourceType).toBe('user')
        expect(audit.resourceId).toBe(TARGET_ID)
        expect(audit.userId).toBe(ADMIN_ID)
      } finally {
        await app.close()
      }
    })

    it('④ status=2(封禁)⇒ 409,库内仍为 2(零复活)、零审计', async () => {
      asAdmin()
      state.userRow = makeUser(2)
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${TARGET_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(409)
        const body = res.json()
        expect(body.code).toBe(409)
        expect(state.userRow?.status).toBe(2)
        expect(lastUpdateWhereSql()).toMatch(/"status"\s*=\s*\$/)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('⑤ status=3(注销)⇒ 409,库内仍为 3(零复活)、零审计', async () => {
      asAdmin()
      state.userRow = makeUser(3)
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${TARGET_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(409)
        expect(state.userRow?.status).toBe(3)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('⑥ 非 uuid ⇒ 400 且零 DB 写(不得落到 22P02/500)', async () => {
      asAdmin()
      state.userRow = makeUser(2)
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/not-a-uuid/${ep.path}`,
        })
        expect(res.statusCode).toBe(400)
        expect(res.json().code).toBe(400)
        expect(state.updateCalls).toBe(0)
        expect(state.selectCalls).toBe(0)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('⑦ 不存在 uuid ⇒ 404、零审计', async () => {
      asAdmin()
      state.userRow = null
      const app = await buildApp()
      try {
        const res = await app.inject({
          method: 'POST',
          url: `${PREFIX}/admin/users/${MISSING_ID}/${ep.path}`,
        })
        expect(res.statusCode).toBe(404)
        expect(res.json().code).toBe(404)
        expect(mockLogAction).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
