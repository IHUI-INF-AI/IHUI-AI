/**
 * F-53 · PUT /auth/profile 仅凭会话不得改绑邮箱。
 *
 * 缺陷:该端点只挂 authenticate,请求体里的 email 直接写库,形成
 * 「改邮箱 → 邮箱验证码登录」的持久接管链(auth.ts 的 /auth/me 已要求 currentPassword
 * + 唯一性 + 吊销 refresh token)。
 *
 * 判据:
 *  - 改成他人邮箱(含仅大小写不同的他人邮箱)⇒ 403,不写库,响应引导 /api/auth/me;
 *  - 与当前邮箱同值(大小写不敏感)⇒ 幂等放行,原逻辑不变;
 *  - 不带 email 的资料更新 ⇒ 原行为不变(旧客户端兼容);
 *  - 当前用户无邮箱时提交邮箱 ⇒ 403(不存在"同值"可放行)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const USER_ID = '11111111-1111-4111-8111-111111111111'

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  writeRows: [] as Array<{ id: string }>,
  // 观察扩展字段直写链(db.update(users)...)有没有真的进 SQL
  updateCalls: 0,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 鉴权面与本源无关:authenticate 只负责注入 userId。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
    return { userId: USER_ID, familyId: 'f-1', roleId: 0, type: 'access' as const }
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
  }),
  requireAdmin: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
  }),
  requirePermission: () => vi.fn(async () => {}),
  requireAnyPermission: () => vi.fn(async () => {}),
}))

// 与真 drizzle 同形的可配置链:任一中间态既可继续链式调用,也可 await / .returning()。
function makeChain(getRows: () => unknown[]): Record<string, unknown> {
  const target = function () {} as unknown as Record<string, unknown>
  const proxy: Record<string, unknown> = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(getRows()).then(resolve, reject)
      }
      return proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

function makeDb() {
  return {
    select: () => makeChain(() => state.selectRows),
    update: () => {
      state.updateCalls += 1
      return makeChain(() => state.writeRows)
    },
    delete: () => makeChain(() => state.writeRows),
    insert: () => makeChain(() => state.writeRows),
    execute: () => Promise.resolve([]),
  }
}

vi.mock('../src/db/index.js', () => ({
  db: makeDb(),
  dbRead: makeDb(),
  dbClient: {},
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

const m = vi.hoisted(() => ({
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  sanitizeUgcInput: vi.fn(),
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return {
    ...actual,
    findUserById: m.findUserById,
    updateUser: m.updateUser,
  }
})

vi.mock('../src/db/sensitive-words-queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, sanitizeUgcInput: m.sanitizeUgcInput }
})

import { authExtendedRoutes } from '../src/routes/auth-extended.js'

const baseUser = {
  id: USER_ID,
  phone: '13800000001',
  email: 'User@Example.com',
  nickname: 'T',
  avatar: '',
  gender: 0,
  roleId: 0,
  status: 1,
  familyId: 'fam-001',
}

describe('F-53 · PUT /api/auth/profile 邮箱改绑收敛到 /api/auth/me', () => {
  let app: FastifyInstance

  const putProfile = (body: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: '/api/auth/profile', payload: body })

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.selectRows = []
    state.writeRows = [{ id: USER_ID }]
    state.updateCalls = 0
    m.findUserById.mockReset()
    m.findUserById.mockResolvedValue(baseUser)
    m.updateUser.mockReset()
    m.updateUser.mockResolvedValue({ id: USER_ID })
    m.sanitizeUgcInput.mockReset()
    m.sanitizeUgcInput.mockResolvedValue({ ok: true, fields: {} })
  })

  it('改成他人邮箱 ⇒ 403、不写库,并引导走 /api/auth/me', async () => {
    const res = await putProfile({ email: 'attacker@evil.com' })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
    expect(body.errorCode).toBe('EMAIL_REBIND_REQUIRES_ME')
    expect(body.message).toContain('/api/auth/me')
    expect(m.updateUser).not.toHaveBeenCalled()
    expect(state.updateCalls).toBe(0)
  })

  it('改成他人邮箱(仅大小写不同)⇒ 同样 403,大小写不能绕过', async () => {
    const res = await putProfile({ email: 'ATTACKER@EVIL.COM' })
    expect(res.statusCode).toBe(403)
    expect(m.updateUser).not.toHaveBeenCalled()
    expect(state.updateCalls).toBe(0)
  })

  it('提交与当前邮箱完全相同的值 ⇒ 幂等放行,原逻辑写库', async () => {
    const res = await putProfile({ email: baseUser.email })
    expect(res.statusCode).toBe(200)
    expect(m.updateUser).toHaveBeenCalledTimes(1)
    expect(m.updateUser).toHaveBeenCalledWith(USER_ID, { email: baseUser.email })
  })

  it('提交与当前邮箱仅大小写不同的值 ⇒ 视为同值放行(大小写不敏感比较)', async () => {
    const res = await putProfile({ email: 'user@example.com' })
    expect(res.statusCode).toBe(200)
    expect(m.updateUser).toHaveBeenCalledTimes(1)
    expect(m.updateUser).toHaveBeenCalledWith(USER_ID, { email: 'user@example.com' })
  })

  it('对照:不含 email 的资料更新 ⇒ 原行为不变(旧客户端兼容)', async () => {
    const res = await putProfile({ nickname: 'NewNick' })
    expect(res.statusCode).toBe(200)
    expect(m.updateUser).toHaveBeenCalledTimes(1)
    expect(m.updateUser).toHaveBeenCalledWith(USER_ID, { nickname: 'NewNick' })
  })

  it('当前用户没有邮箱时提交邮箱 ⇒ 403(不存在同值可放行)', async () => {
    m.findUserById.mockResolvedValue({ ...baseUser, email: null })
    const res = await putProfile({ email: 'someone@example.com' })
    expect(res.statusCode).toBe(403)
    expect(m.updateUser).not.toHaveBeenCalled()
    expect(state.updateCalls).toBe(0)
  })
})
