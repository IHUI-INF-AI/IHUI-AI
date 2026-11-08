// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000001'

const redisState = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))
vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(redisState) }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    ADMIN_TOTP_MODE: 'off',
  },
}))
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

/**
 * 保真 db 替身:模拟 drizzle 的「显式投影」语义。
 * - select(无参)                     → 整行(含 passwordHash/twoFactorSecret/twoFactorBackupCodes)
 * - select({ user: users, ... })     → 整行(旧写法)
 * - select({ user: <列投影>, ... })  → 只回投影里出现的列(新写法)
 * - select(<列投影>)                 → 只回投影里出现的列
 * 这样把守卫/投影改回旧写法时,夹具的响应会重新带上密钥列 → 断言翻红。
 */
const { mockVerifyAccessToken, makeDbMock, state } = vi.hoisted(() => {
  const state = { selectEmpty: false }
  const FULL_ROW = {
    id: '00000000-0000-4000-8000-000000000001',
    phone: '13800000000',
    email: 'alice@example.com',
    username: 'alice',
    nickname: 'Alice',
    avatar: null,
    bio: null,
    gender: null,
    birthday: null,
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
    deptId: 1,
    status: 1,
    isVip: 0,
    identityType: null,
    level: 0,
    isSystemAdmin: false,
    inviteCode: null,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    twoFactorEnabled: true,
    twoFactorEnabledAt: new Date('2026-01-02T00:00:00.000Z'),
    passwordHash: 'sha256-secret-hash',
    twoFactorSecret: 'TOTP-SECRET-MUST-NOT-LEAK',
    twoFactorBackupCodes: ['BACKUP-CODE-MUST-NOT-LEAK'],
    departmentName: '研发部',
  }
  type Sel = Record<string, unknown>
  function pick(selection: Sel): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(selection)) {
      out[key] = (FULL_ROW as Record<string, unknown>)[key]
    }
    return out
  }
  function project(arg: Sel | undefined): Record<string, unknown> | Record<string, unknown>[] {
    if (!arg) return { ...FULL_ROW }
    if (Object.keys(arg).length === 1 && 'status' in arg) return [{ status: 1 }]
    if (Object.keys(arg).length === 1 && 'flag' in arg) return [{ flag: false }]
    if ('count' in arg) return [{ count: 1 }]
    if (state.selectEmpty) return []
    if ('user' in arg) {
      const userSel = arg.user as Sel
      const fullTable = Object.prototype.hasOwnProperty.call(userSel, 'passwordHash')
      return {
        user: fullTable ? { ...FULL_ROW } : pick(userSel),
        departmentName: FULL_ROW.departmentName,
      }
    }
    return pick(arg)
  }
  function selectChain(arg: Sel | undefined) {
    const chain: Record<string, unknown> = {
      from: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        const rows = project(arg)
        Promise.resolve(Array.isArray(rows) ? rows : [rows]).then(resolve, reject)
      },
    }
    return chain
  }
  const returnRows = (arg: Sel | undefined) => Promise.resolve([arg ? pick(arg) : { ...FULL_ROW }])
  const makeDbMock = () => ({
    select: vi.fn((arg?: Sel) => selectChain(arg)),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn((arg?: Sel) => returnRows(arg)) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn((arg?: Sel) => returnRows(arg)) })),
      })),
    })),
  })
  return { mockVerifyAccessToken: vi.fn(), FULL_ROW, makeDbMock, state }
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/index.js', () => ({ db: makeDbMock() }))
vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

import { usercenterRoutes } from '../src/routes/usercenter'

const SECRET_KEYS = ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes']

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      keys.add(k)
      collectKeys(v, keys)
    }
  }
  return keys
}

function expectNoSecretKeys(body: unknown) {
  const keys = collectKeys(body)
  for (const secret of SECRET_KEYS) {
    expect(keys.has(secret), `响应中出现敏感键 ${secret}`).toBe(false)
  }
}

describe('F-245 admin usercenter 响应不得下发 2FA/密码密钥列', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: error.message })
    })
    await server.register(usercenterRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.selectEmpty = false
    mockVerifyAccessToken.mockResolvedValue({
      userId: USER_ID,
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 1,
    })
  })

  it('GET /usercenter/users — 列表深层不含密钥列,必要字段仍在', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/usercenter/users',
      headers: { authorization: 'Bearer admin-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expectNoSecretKeys(body)
    expect(body.data.list[0].nickname).toBe('Alice')
    expect(body.data.list[0].twoFactorEnabled).toBe(true)
    expect(body.data.total).toBe(1)
  })

  it('GET /usercenter/users/by-phone — 不含密钥列', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/usercenter/users/by-phone?phone=13800000000',
      headers: { authorization: 'Bearer admin-token' },
    })
    expect(res.statusCode).toBe(200)
    expectNoSecretKeys(res.json())
    expect(res.json().data.user.nickname).toBe('Alice')
  })

  it('GET /usercenter/users/:id — 不含密钥列', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/usercenter/users/${USER_ID}`,
      headers: { authorization: 'Bearer admin-token' },
    })
    expect(res.statusCode).toBe(200)
    expectNoSecretKeys(res.json())
    expect(res.json().data.user.id).toBe(USER_ID)
  })

  it('PUT /usercenter/users/:id — 更新响应同样只回投影列', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/usercenter/users/${USER_ID}`,
      headers: { authorization: 'Bearer admin-token' },
      body: { nickname: 'Alice2' },
    })
    expect(res.statusCode).toBe(200)
    expectNoSecretKeys(res.json())
  })

  it('POST /usercenter/users — 创建响应同样只回投影列', async () => {
    // 手机号查重走同一投影查询,置空表示"不存在"
    state.selectEmpty = true
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/usercenter/users',
      headers: { authorization: 'Bearer admin-token' },
      body: { phone: '13900000000', password: 'newpass123', nickname: 'Bob' },
    })
    expect(res.statusCode).toBe(201)
    expectNoSecretKeys(res.json())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
