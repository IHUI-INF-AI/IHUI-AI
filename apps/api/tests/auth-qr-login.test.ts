// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * QR 扫码登录三端点黑盒锁(2026-10-27 立)。
 *
 * 立因:今天补齐了扫描侧(小程序 scanCode / RN ScanLoginScreen),但 `/qr/generate`、
 * `/qr/status`、`/qr/confirm` 三个服务端端点**全仓零测试**,而排查中现读出两条真缺陷:
 *  ① confirm 只判 key 在不在、不判状态 ⇒ 已被 A 确认的票据可被 B 重复确认,PC 端轮询
 *     取到的是"最后写入"那一份 token 对(A 授权、B 换脸);
 *  ② status 限流 max=30/分钟,与 web 端 2s 轮询**恰好等量** ⇒ 多一帧就 429,而面板把任何
 *     一次失败当终态,一张名义还有效 300s 的码当场判死。
 * 两条都得有钉子:判过一次的修法,下次改动会静默退回去。
 *
 * 装具与 auth-register-sms-verify.test.ts 同套夹具面(mock 面一致,不另起一套);
 * response-sanitizer 挂**真实插件**,因为"confirmed 腿的 token 会不会被脱敏成 ***"
 * 本身就是扫码登录能不能成立的判据之一。测试不连库:redis 用 decorate 注入的替身,
 * DB 侧全部走命名导出 mock(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const { mockAuthenticate, mockFindUserById, mockIssueTokenPair, mockCreateFamilyId } = vi.hoisted(
  () => ({
    mockAuthenticate: vi.fn(),
    mockFindUserById: vi.fn(),
    mockIssueTokenPair: vi.fn(),
    mockCreateFamilyId: vi.fn(),
  }),
)

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

vi.mock('../src/services/token-service.js', () => ({ issueTokenPair: mockIssueTokenPair }))

vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: vi.fn(),
  findUserByAccount: vi.fn(),
  findUserById: mockFindUserById,
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

// 登录腿的 IP 白名单:本文件不测白名单,交空表 = 未启用 = 放行
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(),
  deleteUserPreference: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  signChallengeToken: vi.fn(),
  CHALLENGE_TOKEN_TTL_SECONDS: 300,
}))

vi.mock('../src/services/risk-engine-service.js', () => ({
  evaluateLoginRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: [] }),
  evaluateRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: [] }),
  recentRiskHitsByIp: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    isProductionGuard: false,
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1/0',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

import { authRoutes } from '../src/routes/auth.js'
import { QR_AGREEMENT_REQUIRED } from '../src/services/qr-login-agreement.js'
import responseSanitizerPlugin from '../src/plugins/response-sanitizer.js'
import { parseQrLoginTicket } from '@ihui/shared'

const USER_ID = 'user-001'
const TOKENS_A = {
  accessToken: 'qr-access-A-0000000001',
  refreshToken: 'qr-refresh-A-0000000002',
  expiresIn: 3600,
}
const TOKENS_B = {
  accessToken: 'qr-access-B-0000000003',
  refreshToken: 'qr-refresh-B-0000000004',
  expiresIn: 3600,
}

/** 逐键存活的内存 redis 替身(QR 三端点只用 get/set/ttl/del)。 */
function mkRedis() {
  const store = new Map<string, string>()
  const exp = new Map<string, number>()
  return {
    store,
    get: vi.fn(async (k: string) => {
      if (exp.has(k) && exp.get(k)! <= Date.now()) {
        store.delete(k)
        exp.delete(k)
        return null
      }
      return store.get(k) ?? null
    }),
    set: vi.fn(async (k: string, v: string, _mode?: string, _sec?: number) => {
      store.set(k, v)
      if (typeof _sec === 'number') exp.set(k, Date.now() + _sec * 1000)
      return 'OK'
    }),
    ttl: vi.fn(async (k: string) => {
      const at = exp.get(k)
      return at ? Math.max(1, Math.round((at - Date.now()) / 1000)) : -2
    }),
    del: vi.fn(async (k: string) => {
      exp.delete(k)
      return store.delete(k) ? 1 : 0
    }),
  }
}

let app: FastifyInstance
let redis: ReturnType<typeof mkRedis>
/** 各路由注册时声明的 config(限流档位是路由的静态声明,用 onRoute 钩子现读,不在测试里抄数字) */
let routeConfig: Record<string, { rateLimit?: { max?: number; timeWindow?: string } }>

async function generate(
  agreementAccepted = true,
): Promise<{ ticket: string; qrContent: string; expiresAt: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/qr/generate',
    payload: { agreementAccepted },
  })
  expect(res.statusCode).toBe(200)
  return res.json().data
}

function confirm(ticket: string, auth = true) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/qr/confirm',
    ...(auth ? { headers: { authorization: 'Bearer qr-token' } } : {}),
    payload: { ticket },
  })
}

async function status(ticket: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
  })
  expect(res.statusCode).toBe(200)
  return res.json().data as { status: string; accessToken?: string; refreshToken?: string }
}

describe('QR 扫码登录 — generate/status/confirm', () => {
  beforeAll(async () => {
    redis = mkRedis()
    app = Fastify({ logger: false })
    routeConfig = {}
    app.addHook('onRoute', (opts) => {
      routeConfig[opts.url] = (opts.config ?? {}) as (typeof routeConfig)[string]
    })
    ;(app as unknown as { decorate(name: string, value: unknown): void }).decorate('redis', redis)
    await app.register(responseSanitizerPlugin)
    await app.register(cookie)
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    redis.store.clear()
    mockAuthenticate.mockReset()
    mockAuthenticate.mockImplementation(
      async (request: { userId?: string }, reply: { code: () => unknown }) => {
        if (!request.headers?.authorization) {
          return reply.code(401).send({ code: 401, message: '未认证', data: null })
        }
        request.userId = USER_ID
      },
    )
    mockFindUserById.mockReset()
    mockFindUserById.mockResolvedValue({ id: USER_ID, phone: '13800000001', roleId: 0, status: 1 })
    mockCreateFamilyId.mockReset()
    mockCreateFamilyId.mockReturnValue('fam-qr')
    mockIssueTokenPair.mockReset()
    mockIssueTokenPair.mockResolvedValue(TOKENS_A)
  })

  it('generate:票据形态 + 二维码内容就是票据本身,且扫描侧判据能原样取出(跨端对接锁)', async () => {
    const { ticket, qrContent, expiresAt } = await generate()
    expect(ticket).toMatch(/^qr_[0-9a-f-]{36}$/)
    expect(qrContent).toBe(ticket)
    // 生成侧→解析侧是一条真链:这里不写第二份正则,直接用扫描端(小程序/RN)那份实现
    expect(parseQrLoginTicket(qrContent)).toBe(ticket)
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(280_000)
    expect(JSON.parse(redis.store.get(`qr:login:${ticket}`)!)).toEqual({
      status: 'pending',
      userId: null,
      createdAt: expect.any(String),
      // 2026-10-28 加固:出码时把"PC 端是否已同意协议"记进会话,confirm 腿据此拒绝签发。
      // 未带 agreementAccepted 的旧调用形态只会落 false(见 auth.ts 出码腿注释),故此处断言为 true。
      agreementAccepted: true,
    })
  })

  it('status:未知票据与已领取票据一律 expired,pending 原样回报', async () => {
    expect((await status('qr_does-not-exist-0000000000000000000000')).status).toBe('expired')
    const { ticket } = await generate()
    expect((await status(ticket)).status).toBe('pending')
  })

  it('confirm 主路径:签发 token 对 → PC 端轮询取到明文身份凭据,且领取后一次性失效', async () => {
    const { ticket } = await generate()
    const res = await confirm(ticket)
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ confirmed: true, ticket })

    const got = await status(ticket)
    expect(got.status).toBe('confirmed')
    // 脱敏跳过这一格必须真生效:被 response-sanitizer 遮成 *** 的话,扫码登录等于没成功
    expect(got.accessToken).toBe(TOKENS_A.accessToken)
    expect(got.refreshToken).toBe(TOKENS_A.refreshToken)
    // 领取即销毁:第二帧只能读到 expired(token 对不得重复领取)
    expect((await status(ticket)).status).toBe('expired')
  })

  it('缺陷①锁:已 confirmed 的票据不得被第二台设备重复确认(409),且不覆写既有 token 对', async () => {
    const { ticket } = await generate()
    expect((await confirm(ticket)).statusCode).toBe(200)

    // 把 key 塞回去,模拟"PC 还没来领、第二台手机又扫了一次"
    const state = {
      status: 'confirmed',
      userId: USER_ID,
      tokens: TOKENS_A,
      createdAt: new Date().toISOString(),
    }
    redis.store.set(`qr:login:${ticket}`, JSON.stringify(state))

    mockIssueTokenPair.mockResolvedValue(TOKENS_B)
    const second = await confirm(ticket)
    expect(second.statusCode).toBe(409)
    // 副作用必须没发生:既没重新签发,也没把 A 的票据改成 B
    expect(mockIssueTokenPair).toHaveBeenCalledTimes(1)
    expect(JSON.parse(redis.store.get(`qr:login:${ticket}`)!).tokens.accessToken).toBe(
      TOKENS_A.accessToken,
    )
  })

  it('confirm 拒绝面:未知票据 404、未鉴权 401,均不签发 token', async () => {
    mockIssueTokenPair.mockClear()
    expect((await confirm('qr_missing-0000000000000000000000000000')).statusCode).toBe(404)
    const { ticket } = await generate()
    expect((await confirm(ticket, false)).statusCode).toBe(401)
    expect(mockIssueTokenPair).not.toHaveBeenCalled()
    expect(JSON.parse(redis.store.get(`qr:login:${ticket}`)!).status).toBe('pending')
  })

  it('协议闸锁:未同意条款的会话,确认与领取两条腿都 403 ⇒ 一个 token 都不签发', async () => {
    // 判据单源在 services/qr-login-agreement.ts;这里只钉"两会话端点都真的接上了那道闸",
    // 不复制 `=== true` 判断(§22c:第二份判据必然漂移)。
    mockIssueTokenPair.mockClear()
    const { ticket } = await generate(false)

    const confirmed = await confirm(ticket)
    expect(confirmed.statusCode).toBe(403)
    expect(confirmed.json().errorCode).toBe(QR_AGREEMENT_REQUIRED)
    expect(mockIssueTokenPair).not.toHaveBeenCalled()
    // 被拒的会话必须原样停在 pending,不能被写成 confirmed 留下半条授权
    expect(JSON.parse(redis.store.get(`qr:login:${ticket}`)!).status).toBe('pending')

    const claimed = await app.inject({
      method: 'GET',
      url: `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
    })
    // pending 会话的 status 只回报 pending(不涉及凭据),所以 200 是对的
    expect(claimed.statusCode).toBe(200)
    expect(claimed.json().data).toEqual({ status: 'pending' })

    // 发放腿的闸针对"已 confirmed 但从未同意"的会话 —— 旧版本遗留票据正是这一形态
    redis.store.set(
      `qr:login:${ticket}`,
      JSON.stringify({
        status: 'confirmed',
        userId: USER_ID,
        tokens: TOKENS_A,
        createdAt: new Date().toISOString(),
      }),
    )
    const legacy = await app.inject({
      method: 'GET',
      url: `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
    })
    expect(legacy.statusCode).toBe(403)
    expect(legacy.json().errorCode).toBe(QR_AGREEMENT_REQUIRED)
    expect(legacy.json().data?.accessToken).toBeUndefined()
    // 被拦下的会话必须销毁,不能留着等下一次轮询(否则等于挂着一枚可换的凭据)
    expect(redis.store.has(`qr:login:${ticket}`)).toBe(false)
  })

  it('缺陷②锁:status 限流必须给 web 端 2s 轮询留余量(≥30 帧/分钟的两倍)', () => {
    // 2000ms 轮询 = 30 帧/分钟;原 max=30 与之一比一,多一帧(双标签页/代理重试)即 429。
    // 这里钉的是**路由声明**,不是测试里的第二份常量。
    const cfg = routeConfig['/api/auth/qr/status']?.rateLimit
    expect(cfg).toBeTruthy()
    expect(cfg!.timeWindow).toBe('1 minute')
    expect(cfg!.max!).toBeGreaterThanOrEqual(60)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
