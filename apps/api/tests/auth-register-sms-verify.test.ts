// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-876:POST /api/auth/register 手机号真实性核验。
 * 票面判据两档(通道在/不在配置态)各有成对夹具:
 *  - 配置态:code 必填 + 先过 code-store verifyCode 再落库(未验过不落库),
 *    校验先于 409 查询(无码者不得借 409 枚举号码归属),验证码一次性消费(重放必红)。
 *  - 未配置态:code 可选(改必填会当场关死注册),但带上就必须验真(防绕过)。
 * 配置态判据直接用生产出口 isSmsConfigured()(经 SMS_API_BASE_URL 代理档点亮),
 * 测试不复制一份判定逻辑(§22c)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// ---------- 可控 mock(与 auth-permission.test.ts 同套夹具面) ----------
const {
  mockCreateFamilyId,
  mockIssueTokenPair,
  mockAuthenticate,
  mockFindUserByPhone,
  mockCreateUser,
  mockGetUserPermissions,
  mockEvaluateRisk,
  mockRecentRiskHitsByIp,
} = vi.hoisted(() => ({
  mockCreateFamilyId: vi.fn(),
  mockIssueTokenPair: vi.fn(),
  mockAuthenticate: vi.fn(),
  mockFindUserByPhone: vi.fn(),
  mockCreateUser: vi.fn(),
  mockGetUserPermissions: vi.fn(),
  mockEvaluateRisk: vi.fn(),
  mockRecentRiskHitsByIp: vi.fn(),
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
  findUserByPhone: mockFindUserByPhone,
  findUserByAccount: vi.fn(),
  findUserById: vi.fn(),
  createUser: mockCreateUser,
  updateUser: vi.fn(),
  cancelUserAccount: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  isSystemAdminUser: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: mockGetUserPermissions,
  checkPermission: vi.fn(),
}))

vi.mock('../src/db/promotion-queries.js', () => ({
  findInvitationByCode: vi.fn().mockResolvedValue(null),
  markInvitationUsed: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn() }))

vi.mock('../src/services/account-lockout.js', () => ({
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
  getLockRemainingMs: vi.fn().mockResolvedValue(0),
  ACCOUNT_LOCKOUT_CONFIG: { lockDurationSec: 900, maxFailures: 5 },
}))

vi.mock('../src/services/oauth-providers.js', () => ({
  jscode2session: vi.fn(),
  isWechatMiniConfigured: vi.fn().mockReturnValue(false),
  wechatAppCode2session: vi.fn().mockResolvedValue(null),
  isWechatAppConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  signChallengeToken: vi.fn(),
  CHALLENGE_TOKEN_TTL_SECONDS: 300,
}))

vi.mock('../src/services/risk-engine-service.js', () => ({
  evaluateLoginRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: [] }),
  evaluateRisk: mockEvaluateRisk,
  recentRiskHitsByIp: mockRecentRiskHitsByIp,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    isProductionGuard: false,
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    // 指到死端口 ⇒ code-store 走「内存兜底」档(与 auth-permission.test.ts 同口径)
    REDIS_URL: 'redis://127.0.0.1:1/0',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

import { authRoutes } from '../src/routes/auth.js'
import { config } from '../src/config/index.js'
import {
  __test__ as codeStoreTest,
  putCodeEntry,
  CODE_TTL_REGISTER_MS,
} from '../src/utils/code-store.js'

const NOW = new Date('2026-10-23T00:00:00Z')
const PHONE = '13800000001'

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    phone: PHONE,
    email: null,
    username: null,
    nickname: 'tester',
    avatar: null,
    bio: null,
    gender: 0,
    birthday: null,
    familyId: 'fam-001',
    roleId: 0,
    status: 1,
    isVip: 0,
    identityType: null,
    level: 0,
    inviteCode: null,
    parentId: null,
    passwordHash: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

async function seedRegisterCode(phone: string, code: string): Promise<void> {
  const now = Date.now()
  await putCodeEntry(phone, { code, expiresAt: now + CODE_TTL_REGISTER_MS, sentAt: now })
}

let app: FastifyInstance

async function postRegister(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/auth/register', payload })
}

describe('G-876 register 验证码校验', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    app.decorate('riskEngine', { evaluateRisk: () => ({ action: 'ALLOW', hits: 0 }) } as never)
    app.decorate('recordFunnel', () => {})
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await codeStoreTest.reset()
    mockCreateFamilyId.mockReturnValue('fam-mock')
    mockIssueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    })
    mockFindUserByPhone.mockResolvedValue(null)
    mockCreateUser.mockResolvedValue(makeUser())
    mockGetUserPermissions.mockResolvedValue([])
    mockEvaluateRisk.mockReturnValue({ action: 'ALLOW', hits: [] })
    mockRecentRiskHitsByIp.mockResolvedValue(0)
  })

  describe('短信通道已配置(SMS_API_BASE_URL 代理档点亮 isSmsConfigured)', () => {
    const saved = { proxy: process.env.SMS_API_BASE_URL }
    beforeEach(() => {
      process.env.SMS_API_BASE_URL = 'http://127.0.0.1:1'
    })
    afterAll(() => {
      if (saved.proxy === undefined) delete process.env.SMS_API_BASE_URL
      else process.env.SMS_API_BASE_URL = saved.proxy
    })

    it('不带 code ⇒ 400,不落库、不查 409(校验先于枚举面)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('验证码')
      expect(mockCreateUser).not.toHaveBeenCalled()
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })

    it('带错码(存储无此号)⇒ 400,不落库', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '999999' })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('验证码错误或已过期')
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('code 非 6 位 ⇒ 400(schema 档)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '12345' })
      expect(res.statusCode).toBe(400)
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('正确码 ⇒ 200 发 token,且验证码被一次性消费', async () => {
      await seedRegisterCode(PHONE, '246810')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '246810' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.accessToken).toBe('access-token')
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
      expect(await codeStoreTest.exists(PHONE)).toBe(false)
    })

    it('同一枚码重放 ⇒ 第二次 400(一次性)', async () => {
      await seedRegisterCode(PHONE, '135790')
      const first = await postRegister({ phone: PHONE, password: 'password123', code: '135790' })
      expect(first.statusCode).toBe(200)
      const second = await postRegister({
        phone: '13800000002',
        password: 'password123',
        code: '135790',
      })
      expect(second.statusCode).toBe(400)
    })

    it('已注册号码 + 正确码 ⇒ 409(核验通过后仍拒重复注册)', async () => {
      mockFindUserByPhone.mockResolvedValue(makeUser())
      await seedRegisterCode(PHONE, '246813')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '246813' })
      expect(res.statusCode).toBe(409)
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('已注册号码 + 不带码 ⇒ 400 而非 409(未验过不得借 409 探号)', async () => {
      mockFindUserByPhone.mockResolvedValue(makeUser())
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })
  })

  describe('短信通道未配置(三档全缺)', () => {
    beforeEach(() => {
      delete process.env.SMS_API_BASE_URL
      delete process.env.ALI_SMS_ACCESS_KEY_ID
      delete process.env.ALI_SMS_ACCESS_KEY_SECRET
      delete process.env.TENCENT_SMS_SECRET_ID
      delete process.env.TENCENT_SMS_SECRET_KEY
      delete process.env.TENCENT_SMS_SDK_APP_ID
      delete process.env.TENCENT_SMS_SIGN_NAME
    })

    it('不带 code ⇒ 200(必填会当场关死注册,票面明令等通道)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(200)
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
    })

    it('带错码 ⇒ 400,不落库(防绕过:带了就必须验,不得静默忽略)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '000000' })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('验证码错误或已过期')
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('带正确码 ⇒ 200(未配置态走 dev 回显码同样可注册)', async () => {
      await seedRegisterCode(PHONE, '864210')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '864210' })
      expect(res.statusCode).toBe(200)
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
    })
  })

  // G-876 续:fail-soft 开关(config.AUTH_REGISTER_CODE_FAIL_SOFT,环境变量/配置控制,默认关)。
  // 开启 = 核验不过仅告警放行(通道切换/客户端灰度期回退窗口);关闭 = fail-hard(上面两档已钉)。
  describe('fail-soft 开关(AUTH_REGISTER_CODE_FAIL_SOFT)', () => {
    const cfg = config as typeof config & { AUTH_REGISTER_CODE_FAIL_SOFT?: boolean }
    const saved = { proxy: process.env.SMS_API_BASE_URL, soft: cfg.AUTH_REGISTER_CODE_FAIL_SOFT }
    beforeEach(() => {
      process.env.SMS_API_BASE_URL = 'http://127.0.0.1:1' // 通道已配置档(严格面本应 400)
      cfg.AUTH_REGISTER_CODE_FAIL_SOFT = true
    })
    afterEach(() => {
      cfg.AUTH_REGISTER_CODE_FAIL_SOFT = saved.soft
    })
    afterAll(() => {
      if (saved.proxy === undefined) delete process.env.SMS_API_BASE_URL
      else process.env.SMS_API_BASE_URL = saved.proxy
    })

    it('开关开 + 缺码 ⇒ 200 放行(fail-soft 不拦)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(200)
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
    })

    it('开关开 + 错码 ⇒ 200 放行(核验不过仅告警)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '999999' })
      expect(res.statusCode).toBe(200)
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
    })

    it('开关关(默认档)⇒ 同场景仍 400(反向锁:开关是唯一变量)', async () => {
      cfg.AUTH_REGISTER_CODE_FAIL_SOFT = false
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('开关开不改变 409 语义:已注册号码仍 409', async () => {
      mockFindUserByPhone.mockResolvedValue(makeUser())
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(409)
      expect(mockCreateUser).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
