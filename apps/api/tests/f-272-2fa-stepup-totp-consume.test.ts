// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-272 回归锁(2026-11-13)。
 *
 * 病灶:`POST /api/auth/2fa/step-up` 只做布尔 `verifyTotp` + `recordTwoFactorStepUp`,
 * 不消费 TOTP counter ⇒ 同一 6 位码在 ±1 step(约 90s)窗口内可以反复刷新 step-up,
 * 与登录 2FA 兑付点(`/auth/2fa/login-verify`)的一次性兑付口径不一致(§0.6 判据单源)。
 *
 * 本文件锁:
 *   ① 首次有效码 ⇒ 200,且记账 step-up(新鲜度 + 审计事件各一次);
 *   ② 同一 code 立即重复 ⇒ 401,且不再写第二次 step-up(窗过期也不会被重新点亮);
 *   ③ 并发两次同一 code ⇒ 恰好一次成功(consume 原子,Promise.all 断言成功计数 = 1);
 *   ④ 旧 counter 码 / 未登记错码仍按既有逻辑拒;拒绝体与"码正确但已用过"逐字一致(不泄露);
 *   ⑤ 登录 2FA 路径仍消费(源锁);
 *   ⑥ 源锁:step-up 段落用 verifyTotpCounter + consumeTotpCounter,消费先于记账。
 *
 * 只 mock TOTP 校验出口 / db / 审计写库,不连真实 Redis/PG;store 用真实实现(无 Redis
 * 时走进程内账,与生产降级路径一致)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const USER_ID = 'f272-user-2fa'

// TOTP 校验出口替身:code → 命中的 time step(未登记 = 错码)。
const TOTP = vi.hoisted(() => ({
  codes: new Map<string, number>(),
  verifyCounterCalls: 0,
  verifyBoolCalls: 0,
}))

vi.mock('../src/services/totp-service.js', () => ({
  CHALLENGE_TOKEN_TTL_SECONDS: 300,
  generateSecret: () => Buffer.alloc(20, 9),
  buildOtpauthUri: () => 'otpauth://totp/f272',
  generateQrCodeDataUrl: async () => 'data:image/png;base64,',
  generateBackupCodes: () => [],
  hashBackupCode: (code: string) => `hash:${code}`,
  verifyBackupCode: () => false,
  base32Encode: () => 'JBSWY3DPEHPK3PXP',
  verifyChallengeToken: () => null,
  signChallengeToken: () => 'challenge-token',
  verifyTotp: (code: string) => {
    TOTP.verifyBoolCalls += 1
    return TOTP.codes.has(code)
  },
  verifyTotpCounter: (code: string) => {
    TOTP.verifyCounterCalls += 1
    return TOTP.codes.get(code) ?? null
  },
}))

// 审计写库与用户查询替身(step-up 只读账号,不写库)。
const db = vi.hoisted(() => ({
  findUserById: vi.fn(),
  recordSecurityEvent: vi.fn(),
}))

vi.mock('../src/db/security-logs-queries.js', () => ({
  recordSecurityEvent: db.recordSecurityEvent,
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, findUserById: db.findUserById }
})

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

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
    PUBLIC_BASE_URL: '',
    OAUTH_ISSUER: '',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
  }),
}))

// 记账函数包一层计数:断言"重复码不会写下第二次 step-up",真实记账仍由原实现完成。
const STORE = vi.hoisted(() => ({ recordCalls: 0 }))

vi.mock('../src/services/two-factor-step-up-store.js', async (importOriginal) => {
  // 只截留记账调用做计数,其余导出(含 __test__ / consumeTotpCounter)保持真实实现。
  const actual = (await importOriginal()) as unknown as {
    recordTwoFactorStepUp: (userId: string, redis: unknown) => Promise<void>
    [key: string]: unknown
  }
  return {
    ...actual,
    recordTwoFactorStepUp: vi.fn(async (userId: string, redis: unknown) => {
      STORE.recordCalls += 1
      return actual.recordTwoFactorStepUp(userId, redis)
    }),
  }
})

import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import { encryptJSON } from '../src/utils/crypto.js'
import {
  __test__ as S,
  STEP_UP_WINDOW_SEC,
  consumeTotpCounter,
} from '../src/services/two-factor-step-up-store.js'

const SECRET = Buffer.from('12345678901234567890', 'utf8')

/** 与 auth-extended 内部 encryptTwoFactorSecret 同格式(JSON.stringify({iv,ciphertext,tag}))。 */
function encryptedSecret(): Buffer {
  return Buffer.from(JSON.stringify(encryptJSON(SECRET.toString('base64'))), 'utf8')
}

const securityEvents = (): string[] => db.recordSecurityEvent.mock.calls.map((c) => String(c[1]))

const readSrc = () =>
  readFileSync(fileURLToPath(new URL('../src/routes/auth-extended.ts', import.meta.url)), 'utf8')

/** step-up 处理器的源码段落(与既有 two-factor-step-up.test.ts 同一切法)。 */
function stepUpSource(): string {
  const src = readSrc()
  const start = src.indexOf("'/auth/2fa/step-up'")
  expect(start).toBeGreaterThan(0)
  const end = src.indexOf('// POST /api/auth/2fa/disable', start)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('F-272 · /api/auth/2fa/step-up 一次性兑付 TOTP counter', () => {
  let app: FastifyInstance

  const stepUp = (code: string) =>
    app.inject({ method: 'POST', url: '/api/auth/2fa/step-up', payload: { code } })

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
    TOTP.codes.clear()
    TOTP.verifyCounterCalls = 0
    TOTP.verifyBoolCalls = 0
    STORE.recordCalls = 0
    S.memFreshUntil.clear()
    S.memLastTotpCounter.clear()
    db.findUserById.mockReset()
    db.findUserById.mockResolvedValue({
      id: USER_ID,
      status: 1,
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret(),
      phone: '13800000000',
      roleId: 0,
    })
    db.recordSecurityEvent.mockReset()
    db.recordSecurityEvent.mockResolvedValue(undefined)
  })

  it('① 首次有效码 ⇒ 200 且记账 step-up(审计 + 新鲜度各一次)', async () => {
    TOTP.codes.set('123456', 700)

    const res = await stepUp('123456')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { verified: true, windowSec: STEP_UP_WINDOW_SEC },
    })
    expect(STORE.recordCalls).toBe(1)
    expect(S.memFreshUntil.get(USER_ID)).toBeGreaterThan(Date.now())
    expect(securityEvents()).toEqual(['two_factor_step_up'])
    // 判据已换到 counter 版:成功路径不再经过布尔 verifyTotp。
    expect(TOTP.verifyCounterCalls).toBe(1)
    expect(TOTP.verifyBoolCalls).toBe(0)
  })

  it('② 同一 code 立即重复 ⇒ 401,且不写第二次 step-up(不重新点亮新鲜度)', async () => {
    TOTP.codes.set('123456', 700)
    expect((await stepUp('123456')).statusCode).toBe(200)

    // 模拟 step-up 窗已过:若重放仍记账,这里会被重新写回。
    S.memFreshUntil.delete(USER_ID)

    const replay = await stepUp('123456')

    expect(replay.statusCode).toBe(401)
    expect(replay.json()).toEqual({ code: 401, message: '验证码错误或已过期' })
    expect(STORE.recordCalls).toBe(1)
    expect(S.memFreshUntil.has(USER_ID)).toBe(false)
    expect(securityEvents()).toEqual(['two_factor_step_up', 'two_factor_step_up_failed'])
  })

  it('③ 并发提交同一 code ⇒ 恰好一次成功(consume 原子)', async () => {
    TOTP.codes.set('222222', 800)

    const results = await Promise.all([stepUp('222222'), stepUp('222222')])

    const succeeded = results.filter((r) => r.statusCode === 200)
    expect(succeeded).toHaveLength(1)
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401])
    expect(STORE.recordCalls).toBe(1)
  })

  it('④ 旧 counter 码与未登记错码照旧拒;拒绝体与"已用过"逐字一致(不泄露)', async () => {
    TOTP.codes.set('333333', 900)
    expect((await stepUp('333333')).statusCode).toBe(200)

    // 回退步(旧码)被单调判据拒,跨步正常放行。
    TOTP.codes.set('444444', 899)
    const older = await stepUp('444444')
    TOTP.codes.set('555555', 901)
    expect((await stepUp('555555')).statusCode).toBe(200)

    // 未登记的码 = 错码。
    const wrong = await stepUp('000000')

    expect(older.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(older.json()).toEqual(wrong.json())
    expect(STORE.recordCalls).toBe(2)
  })

  it('⑤ 登录 2FA 兑付点仍用 verifyTotpCounter + consumeTotpCounter(行为不变)', () => {
    const src = readSrc()
    const at = src.indexOf("'/auth/2fa/login-verify'")
    expect(at).toBeGreaterThan(0)
    const loginBlock = src.slice(at, at + 6000)

    expect(loginBlock).toContain('verifyTotpCounter(token, secret)')
    expect(loginBlock).toContain('consumeTotpCounter(userId, totpCounter')
    expect(loginBlock).toContain('verified = true')
  })

  it('⑥ 源锁:step-up 段落消费 counter,且消费先于记账', () => {
    const seg = stepUpSource()

    expect(seg).toContain('verifyTotpCounter(parsed.data.code, secret)')
    expect(seg).toContain('consumeTotpCounter(userId, totpStep, request.server.redis)')
    // 不再是"只有布尔 verifyTotp"的判据。
    expect(seg).not.toMatch(/if \(!verifyTotp\(/)

    const consumeAt = seg.indexOf('consumeTotpCounter(userId, totpStep')
    const recordAt = seg.indexOf('recordTwoFactorStepUp(')
    expect(consumeAt).toBeGreaterThan(0)
    expect(recordAt).toBeGreaterThan(consumeAt)

    // 码错与"码正确但已用过"共用同一句错误文案,不给差分。
    expect(seg.match(/验证码错误或已过期/g)).toHaveLength(1)
  })

  it('⑦ store 层:同一 counter 并发两次只有一方成功;Redis 路径用 Lua 比较并写回', async () => {
    const results = await Promise.all([
      consumeTotpCounter('f272-concurrent', 1234, null),
      consumeTotpCounter('f272-concurrent', 1234, null),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)

    const storeSrc = readFileSync(
      fileURLToPath(new URL('../src/services/two-factor-step-up-store.ts', import.meta.url)),
      'utf8',
    )
    expect(storeSrc).toContain('redis.eval(')
    expect(storeSrc).toMatch(/tonumber\(ARGV\[1\]\) <= cur/)
  })
})
