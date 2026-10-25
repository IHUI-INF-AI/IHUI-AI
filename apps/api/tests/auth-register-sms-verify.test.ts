// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-876:POST /api/auth/register 手机号真实性核验(黑盒 inject 真跑路由)。
 *
 * 票面判据:
 *  - 正确 code 注册成功,且码被一次性消费;
 *  - 错码 / 过期码 / 复用码 / 缺码各拒(400),均不落库;
 *  - 码限定 register 用途:login 场景发出的码不得拿来注册;
 *  - 短信通道未配置 ⇒ 503(与本仓认证类「未配置态」同形:绝不静默放行,errorCode 落枚举);
 *  - 校验先于 409 查询(未验码者不得借 409 枚举号码归属)。
 *
 * 通道判据直接用生产出口 isSmsConfigured()(经 SMS_API_BASE_URL 代理档点亮),
 * 测试不复制判定逻辑(§22c)。存储侧用 code-store 的 __test__ 出口重置与探活。
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

// auth.ts 仅从 @ihui/shared 取一个错误文案工具;注册主路径不依赖它。
// 本文件只验注册码判据,不把共享包(及其在途改动)拖进收集面。
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e ?? '')),
}))

import { authRoutes } from '../src/routes/auth.js'
import {
  __test__ as codeStoreTest,
  putCodeEntry,
  CODE_TTL_REGISTER_MS,
  type CodeEntry,
} from '../src/utils/code-store.js'

const NOW = new Date('2026-10-24T00:00:00Z')
const PHONE = '13800000001'
const UNCONFIGURED_ENV_KEYS = [
  'SMS_API_BASE_URL',
  'ALI_SMS_ACCESS_KEY_ID',
  'ALI_SMS_ACCESS_KEY_SECRET',
  'TENCENT_SMS_SECRET_ID',
  'TENCENT_SMS_SECRET_KEY',
  'TENCENT_SMS_SDK_APP_ID',
  'TENCENT_SMS_SIGN_NAME',
] as const

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

/** 按发送端真实写入口径存一枚码:场景随码落库(register 才有用途资格)。 */
async function seedCode(
  phone: string,
  code: string,
  scene: 'register' | 'login' = 'register',
  ttlMs = CODE_TTL_REGISTER_MS,
): Promise<void> {
  const now = Date.now()
  await putCodeEntry(phone, {
    code,
    expiresAt: now + ttlMs,
    sentAt: now,
    scene,
  } as CodeEntry)
}

let app: FastifyInstance

async function postRegister(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/auth/register', payload })
}

describe('G-876 register 验证码校验', () => {
  const savedEnv: Record<string, string | undefined> = {}

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
    for (const k of UNCONFIGURED_ENV_KEYS) {
      savedEnv[k] = process.env[k]
      delete process.env[k]
    }
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

  afterEach(() => {
    for (const k of UNCONFIGURED_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
  })

  describe('短信通道已配置(SMS_API_BASE_URL 代理档点亮 isSmsConfigured)', () => {
    beforeEach(() => {
      process.env.SMS_API_BASE_URL = 'http://127.0.0.1:1'
    })

    it('正例:正确 code(register 场景)⇒ 200 发 token,码被一次性消费', async () => {
      await seedCode(PHONE, '246810')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '246810' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.accessToken).toBe('access-token')
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
      expect(await codeStoreTest.exists(PHONE)).toBe(false)
    })

    it('反例:缺码 ⇒ 400 且 errorCode 落枚举,不落库、不查 409', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(res.json().message).toContain('验证码')
      expect(mockCreateUser).not.toHaveBeenCalled()
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })

    it('反例:码格式非法(非 6 位数字)⇒ 400 且不落库、不查 409', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '12345' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(res.json().message).toContain('验证码必须为 6 位')
      expect(mockCreateUser).not.toHaveBeenCalled()
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })

    it('反例:错码 ⇒ 400 且不消费原码、不落库', async () => {
      await seedCode(PHONE, '246810')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '999999' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(res.json().message).toContain('验证码错误或已过期')
      expect(await codeStoreTest.exists(PHONE)).toBe(true)
      expect(mockCreateUser).not.toHaveBeenCalled()
      // 错码也不得走到「号码已注册」查询:409 文案不能被拿来枚举号码归属
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })

    it('抢号未遂:无码抢注 400 且不落库 ⇒ 真号主随后带正确 register 码仍能 200', async () => {
      // 票面原始攻击面:未验码者抢先建号,真号主之后只会撞 409。这里把两步都钉住。
      const stolen = await postRegister({ phone: PHONE, password: 'password123' })
      expect(stolen.statusCode).toBe(400)
      expect(mockCreateUser).not.toHaveBeenCalled()

      await seedCode(PHONE, '654321')
      const owner = await postRegister({ phone: PHONE, password: 'password123', code: '654321' })
      expect(owner.statusCode).toBe(200)
      expect(owner.json().data.accessToken).toBe('access-token')
      expect(mockCreateUser).toHaveBeenCalledTimes(1)
    })

    it('反例:过期码 ⇒ 400 且不落库', async () => {
      await seedCode(PHONE, '246810', 'register', -1000)
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '246810' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('反例:同一枚码复用 ⇒ 第二次 400(一次性)', async () => {
      vi.mocked(mockFindUserByPhone).mockResolvedValueOnce(null)
      await seedCode(PHONE, '135790')
      const first = await postRegister({ phone: PHONE, password: 'password123', code: '135790' })
      expect(first.statusCode).toBe(200)
      const second = await postRegister({
        phone: '13800000002',
        password: 'password123',
        code: '135790',
      })
      expect(second.statusCode).toBe(400)
      expect(second.json().errorCode).toBe('VALIDATION_FAILED')
    })

    it('用途锁:login 场景发出的码 ⇒ 400,且不消费该码', async () => {
      await seedCode(PHONE, '112233', 'login')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '112233' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(await codeStoreTest.exists(PHONE)).toBe(true)
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('已注册号码 + 正确码 ⇒ 409(核验通过后仍拒重复注册,errorCode 落枚举)', async () => {
      mockFindUserByPhone.mockResolvedValue(makeUser())
      await seedCode(PHONE, '246813')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '246813' })
      expect(res.statusCode).toBe(409)
      expect(res.json().errorCode).toBe('CONFLICT')
      expect(mockCreateUser).not.toHaveBeenCalled()
    })

    it('已注册号码 + 缺码 ⇒ 400 而非 409(未验过不得借 409 探号)', async () => {
      mockFindUserByPhone.mockResolvedValue(makeUser())
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(mockFindUserByPhone).not.toHaveBeenCalled()
    })
  })

  describe('短信通道未配置(三档全缺)⇒ 503 响亮失败,绝不静默放行', () => {
    it('带正确码 ⇒ 503 且 errorCode=CAPABILITY_UNAVAILABLE,不落库', async () => {
      await seedCode(PHONE, '864210')
      const res = await postRegister({ phone: PHONE, password: 'password123', code: '864210' })
      expect(res.statusCode).toBe(503)
      expect(res.json().code).toBe(503)
      expect(res.json().errorCode).toBe('CAPABILITY_UNAVAILABLE')
      expect(String(res.json().message)).toContain('短信通道未配置')
      expect(mockCreateUser).not.toHaveBeenCalled()
      // 未配置态不消费码:通道恢复后这枚码仍在(不被注册路径半消费)
      expect(await codeStoreTest.exists(PHONE)).toBe(true)
    })

    it('不带码 ⇒ 400(schema 必填先于通道判据,不是 503/200)', async () => {
      const res = await postRegister({ phone: PHONE, password: 'password123' })
      expect(res.statusCode).toBe(400)
      expect(res.json().errorCode).toBe('VALIDATION_FAILED')
      expect(mockCreateUser).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
