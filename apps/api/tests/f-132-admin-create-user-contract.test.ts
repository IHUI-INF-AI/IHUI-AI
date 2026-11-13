// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-132 回归(P3):`POST /admin/users` 请求契约必须自洽。
 *
 * 修前:路由 JSON Schema `required: ['passwordHash']` 且 properties 无 `password`,
 * handler 却用 zod `createUserBodySchema`(`password` 必填)并 `hashPassword`:
 * - 照文档传 `passwordHash` ⇒ zod 拒(不认识该键);
 * - 传 `password` ⇒ ajv 先拒(缺 `passwordHash`);
 * - 更糟的是"传 passwordHash 以为存的是自己的哈希"会被静默忽略。
 *
 * 现统一为 `password`(明文入口,服务端只哈希一次),`passwordHash` 不再是入参。
 * 本文件用 app.inject 走真实路由,钉三条行为(不是源文本):
 *   ① 只给 password ⇒ 201,createUser 收到的是哈希而非明文;
 *   ② 只给 passwordHash ⇒ 400,且不落库、不触发哈希;
 *   ③ 成功路径 hashPassword 只调用一次(不存在二次哈希)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  created: [] as Record<string, unknown>[],
  hashed: 'argon2id$v=19$mocked-hash',
}))

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 本票只测请求契约,鉴权由 requireAdminRouteGuard 的统一契约另行覆盖
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdminRouteGuard: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  chain.orderBy = () => chain
  chain.limit = async () => []
  chain.then = (resolve: (v: unknown) => void) => resolve([])
  return {
    db: {
      select: () => chain,
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: async () => [] })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    },
    dbRead: { select: () => chain },
    dbClient: {},
  }
})

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    createUser: vi.fn(async (data: Record<string, unknown>) => {
      state.created.push(data)
      return {
        id: '00000000-0000-4000-8000-0000000000aa',
        nickname: data.nickname,
        phone: data.phone,
        email: data.email,
        passwordHash: data.passwordHash,
      }
    }),
    isSystemAdminUser: vi.fn(async () => false),
    revokeAllUserRefreshTokens: vi.fn(async () => {}),
  }
})

vi.mock('../src/utils/password-crypto.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, hashPassword: vi.fn(async () => state.hashed) }
})

import { adminRoutes } from '../src/routes/admin.js'
import { hashPassword } from '../src/utils/password-crypto.js'

const CREATE_URL = '/api/admin/users'
const PLAIN = 'plain-pw-123'

function payload(body: Record<string, unknown>): Record<string, unknown> {
  return { phone: '13800000000', nickname: '契约用户', ...body }
}

describe('F-132 POST /admin/users 请求契约自洽', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    // 与 server.ts 的 setErrorHandler 同形:把 FST_ERR_VALIDATION 等 4xx 归一为
    // { code, message },否则 route 的 400 响应 schema(code:number)会序列化失败
    app.setErrorHandler((err, _request, reply) => {
      const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
      return reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(adminRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.created.length = 0
    vi.mocked(hashPassword).mockClear()
  })

  it('只给 password(明文)创建成功,入库值是哈希而非明文', async () => {
    const res = await app.inject({
      method: 'POST',
      url: CREATE_URL,
      payload: payload({ password: PLAIN }),
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      code: 0,
      message: 'success',
      data: { user: { nickname: '契约用户' } },
    })

    expect(state.created).toHaveLength(1)
    const saved = state.created[0]
    expect(saved).toBeDefined()
    expect(saved?.passwordHash).toBe(state.hashed)
    expect(saved?.passwordHash).not.toBe(PLAIN)

    // 服务端只哈希一次,且哈希的是明文入参(无二次哈希路径)
    expect(vi.mocked(hashPassword)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(hashPassword)).toHaveBeenCalledWith(PLAIN)
  })

  it('只给 passwordHash 返回 400,且不落库、不做哈希', async () => {
    const res = await app.inject({
      method: 'POST',
      url: CREATE_URL,
      payload: payload({ passwordHash: '$2b$12$abcdefghijklmnopqrstuv' }),
    })

    expect(res.statusCode).toBe(400)
    expect(state.created).toHaveLength(0)
    expect(vi.mocked(hashPassword)).not.toHaveBeenCalled()
  })

  it('password 少于 6 位返回 400(与 schema 同值时由 zod 兜底)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: CREATE_URL,
      payload: payload({ password: '12345' }),
    })

    expect(res.statusCode).toBe(400)
    expect(state.created).toHaveLength(0)
  })
})
