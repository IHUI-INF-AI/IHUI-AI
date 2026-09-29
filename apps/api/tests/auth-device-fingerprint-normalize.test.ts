// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​‌​​‌​‌‍‍‌​‌‌‌​‌‌​‌‌‌​‌‌‌​‍‍‌​‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​​‌​​‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-642 —— 设备指纹 trim 兜底:空白/超长 id 必须归一后再落键。
//
// 立因(2026-09-29 立项):登录成功后 auth.ts 从 x-device-fingerprint header 取值只判
// `typeof === 'string'` 就 upsert 进 user_devices((userId, fingerprintHash) 唯一约束的
// conflict target)——`" "` 是 truthy 会当有效身份落库;>64 字符的值会把 Postgres
// varchar(64) 硬上限错误(22001)打进 catch 的 warn 里静默消失,设备维度审计缺行。
//
// 修法:导出 normalizeDeviceFingerprint 单一归一出口(trim;归一后为空或 >64 ⇒ undefined
// 即"无指纹",不落库)。截断会把不同设备折到同一键上制造假"同设备",故超长拒收而非截断。
//
// 本套件钉五件事(正反用例各一 + 接线 + 回归,app.inject 全程不连库/不连 Redis §5):
//   ① 单元:trim 正例 + 空白/超长/非字符串/64 边界 反例
//   ② 接线:header ' abc '(带空白)⇒ 落库值是 'abc'
//   ③ 空白 header ⇒ 完全不触发 insert(不得把 " " 当有效身份)
//   ④ 65 字符 header ⇒ 完全不触发 insert(不得截断折键)
//   ⑤ 合法 32 字符指纹 ⇒ 原样落库(行为不变的回归对照)
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { hashPassword } from '../src/utils/password-crypto.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const {
  mockIssueTokenPair,
  mockAuthenticate,
  mockFindUserByAccount,
  mockGetLockRemainingMs,
  mockRecordLoginFailure,
  mockClearLoginFailures,
  mockCreateFamilyId,
  mockEvaluateLoginRisk,
  state,
} = vi.hoisted(() => ({
  mockIssueTokenPair: vi.fn(),
  mockAuthenticate: vi.fn(),
  mockFindUserByAccount: vi.fn(),
  mockGetLockRemainingMs: vi.fn(),
  mockRecordLoginFailure: vi.fn(),
  mockClearLoginFailures: vi.fn(),
  mockCreateFamilyId: vi.fn(),
  mockEvaluateLoginRisk: vi.fn(),
  // insert 捕获:auth.ts 的 upsert 链是 insert(userDevices).values(v).onConflictDoUpdate(...)。
  state: { inserted: [] as Array<Record<string, unknown>> },
}))

vi.mock('@ihui/auth', () => ({
  verifyRefreshToken: vi.fn(),
  createFamilyId: mockCreateFamilyId,
  signAccessToken: vi.fn().mockResolvedValue('access'),
  signRefreshToken: vi.fn().mockResolvedValue('refresh'),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/services/token-service.js', () => ({
  issueTokenPair: mockIssueTokenPair,
}))

vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: vi.fn(),
  findUserByAccount: mockFindUserByAccount,
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  cancelUserAccount: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  isSystemAdminUser: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: vi.fn().mockResolvedValue([]),
  checkPermission: vi.fn(),
}))

vi.mock('../src/db/promotion-queries.js', () => ({
  findInvitationByCode: vi.fn().mockResolvedValue(null),
  markInvitationUsed: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn() }))

vi.mock('../src/services/account-lockout.js', () => ({
  recordLoginFailure: mockRecordLoginFailure,
  clearLoginFailures: mockClearLoginFailures,
  getLockRemainingMs: mockGetLockRemainingMs,
  ACCOUNT_LOCKOUT_CONFIG: { lockDurationSec: 900, maxFailures: 5 },
}))

vi.mock('../src/services/oauth-providers.js', () => ({
  wechatAppCode2session: vi.fn().mockResolvedValue(null),
  isWechatAppConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn(),
  upsertUserPreference: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  signChallengeToken: vi.fn(),
  CHALLENGE_TOKEN_TTL_SECONDS: 300,
}))

vi.mock('../src/services/risk-engine-service.js', () => ({
  evaluateLoginRisk: mockEvaluateLoginRisk,
  evaluateRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: [] }),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        state.inserted.push(v)
        return { onConflictDoUpdate: vi.fn().mockResolvedValue([]) }
      }),
    })),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

import { authRoutes, normalizeDeviceFingerprint } from '../src/routes/auth.js'

const NOW = new Date('2026-09-29T00:00:00Z')
/** 真格式:32 字符指纹哈希。 */
const FP32 = 'deadbeefcafebabe0123456789abcdef'
/** user_devices.fingerprint_hash 是 varchar(64) —— 65 字符必须被拒收。 */
const FP65 = 'a'.repeat(65)

function makeUser() {
  return {
    id: 'user-001',
    phone: '13800000001',
    email: 'u1@example.com',
    username: 'tester',
    nickname: 'tester',
    avatar: '',
    bio: '',
    gender: 0,
    birthday: '',
    familyId: 'fam-001',
    roleId: 1,
    status: 1,
    isVip: 0,
    level: 0,
    inviteCode: '',
    parentId: '',
    passwordHash: '',
    twoFactorEnabled: false,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('G-642 单元:normalizeDeviceFingerprint 归一出口', () => {
  it('正例:首尾空白被 trim,中间内容原样保留', () => {
    expect(normalizeDeviceFingerprint(`  ${FP32}  `)).toBe(FP32)
    expect(normalizeDeviceFingerprint(FP32)).toBe(FP32)
  })
  it('反例:纯空白、超长(>64)、非字符串、undefined 都是"无指纹"', () => {
    expect(normalizeDeviceFingerprint('   ')).toBeUndefined()
    expect(normalizeDeviceFingerprint('\t\n')).toBeUndefined()
    expect(normalizeDeviceFingerprint(FP65)).toBeUndefined()
    expect(normalizeDeviceFingerprint(123)).toBeUndefined()
    expect(normalizeDeviceFingerprint(null)).toBeUndefined()
    expect(normalizeDeviceFingerprint(undefined)).toBeUndefined()
  })
  it('边界钉死:64 字符合法,65 字符拒收(不得截断折键)', () => {
    expect(normalizeDeviceFingerprint('a'.repeat(64))).toBe('a'.repeat(64))
    expect(normalizeDeviceFingerprint('a'.repeat(65))).toBeUndefined()
  })
})

describe('G-642 接线:POST /api/auth/login 落库前归一', () => {
  let app: FastifyInstance
  let PASSWORD: string

  beforeAll(async () => {
    PASSWORD = 'pass1234'
    app = Fastify({ logger: false })
    // 2026-08-15 修复同款:auth 路由依赖 @fastify/cookie 提供的 reply.setCookie
    await app.register(cookie)
    app.decorate('riskEngine', {
      evaluateRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: 0 }),
    } as never)
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    state.inserted.length = 0
    mockGetLockRemainingMs.mockResolvedValue(0)
    mockRecordLoginFailure.mockResolvedValue(4)
    mockClearLoginFailures.mockResolvedValue(undefined)
    mockCreateFamilyId.mockReturnValue('fam-mock')
    mockIssueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    })
    mockEvaluateLoginRisk.mockReturnValue({ totalScore: 0, action: 'ALLOW', hits: [] })
    mockFindUserByAccount.mockResolvedValue({
      ...makeUser(),
      passwordHash: await hashPassword(PASSWORD),
    })
  })

  async function loginWithFingerprint(header: string | undefined) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { account: 'tester', password: PASSWORD },
      headers: header === undefined ? {} : { 'x-device-fingerprint': header },
    })
  }

  it('带空白的指纹 ⇒ 落库值是 trim 后的(归一在落键前发生)', async () => {
    const res = await loginWithFingerprint(`  ${FP32}  `)
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0].fingerprintHash).toBe(FP32)
  })

  it('纯空白 header ⇒ 完全不触发 insert(不得把 " " 当有效身份),登录不受影响', async () => {
    const res = await loginWithFingerprint('   ')
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(state.inserted).toHaveLength(0)
  })

  it('65 字符 header ⇒ 完全不触发 insert(超长拒收,不截断折键),登录不受影响', async () => {
    const res = await loginWithFingerprint(FP65)
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(state.inserted).toHaveLength(0)
  })

  it('回归对照:合法 32 字符指纹 ⇒ 原样落库(归一不改写合法值)', async () => {
    const res = await loginWithFingerprint(FP32)
    expect(res.statusCode).toBe(200)
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0].fingerprintHash).toBe(FP32)
  })

  it('回归对照:无 header ⇒ 不落库(既有行为不变)', async () => {
    const res = await loginWithFingerprint(undefined)
    expect(res.statusCode).toBe(200)
    expect(state.inserted).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​‌​​‌​‌‍‍‌​‌‌‌​‌‌​‌‌‌​‌‌‌​‍‍‌​‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​​‌​​‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
