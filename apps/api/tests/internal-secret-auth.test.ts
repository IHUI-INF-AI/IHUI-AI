// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * X-Internal-Secret 族统一鉴权出口的行为测试(2026-11-06)。
 *
 * 钉住验收要求:
 *  ① 默认 ticket 档:只带旧密钥 ⇒ 拒;带了有效票 ⇒ 放行(正常路径不被误挡)。
 *  ② 坏票/错用途/重放 ⇒ 401,且**不回落**旧密钥(即便同一请求还带着对的旧密钥)。
 *  ③ 显式 dual 档:旧密钥可用;生产 + legacy 启动即失败。
 *  ④ 共享状态(Redis)拿不到 ⇒ 拒票(fail-closed),不降级成"跳过检查"。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

const TEST_JWT_SECRET = 'unit-test-only-internal-secret-ticket-key-0123456789abcdef'
process.env.JWT_SECRET = TEST_JWT_SECRET

const TEST_AI_CALLBACK_SECRET = 'x-internal-secret-compat-value-0123456789abcdef'

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      AI_CALLBACK_SECRET: TEST_AI_CALLBACK_SECRET,
      INTERNAL_SECRET_AUTH_MODE: 'ticket',
      INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS: 300,
    },
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const { authorizeInternalSecretCall, assertInternalSecretAuthModeAtStartup, ticketSubjectAllows } =
  await import('../src/plugins/internal-secret-auth')
const { mintInternalServiceTicket, INTERNAL_TICKET_HEADER, JTI_KEY_PREFIX } =
  await import('../src/plugins/internal-service-ticket')
const { config } = await import('../src/config/index.js')
const { logger } = await import('../src/utils/logger.js')

const USER_ID = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
const SECRET_HEADER = 'x-internal-secret'

function makeFakeRedis() {
  const seen = new Set<string>()
  return {
    set: vi.fn(async (key: string) => {
      if (seen.has(key)) return null
      seen.add(key)
      return 'OK'
    }),
    seen,
  }
}

function makeRequest(
  headers: Record<string, string>,
  redis: ReturnType<typeof makeFakeRedis> | null = makeFakeRedis(),
): FastifyRequest {
  return {
    headers,
    server: redis ? { redis } : {},
    ip: '127.0.0.1',
    url: '/__test__',
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyRequest
}

async function mint(scope: string, userId = USER_ID, ttlSeconds?: number) {
  return mintInternalServiceTicket({
    userId,
    scope: scope as never,
    ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
  })
}

beforeEach(() => {
  ;(config as unknown as Record<string, unknown>).INTERNAL_SECRET_AUTH_MODE = 'ticket'
  vi.clearAllMocks()
})

afterEach(() => {
  ;(config as unknown as Record<string, unknown>).INTERNAL_SECRET_AUTH_MODE = 'ticket'
})

describe('默认 ticket 档', () => {
  it('有效票放行,并把票面主体返回给调用点', async () => {
    const ticket = await mint('knowledge-card')
    const result = await authorizeInternalSecretCall(
      makeRequest({ [INTERNAL_TICKET_HEADER]: ticket }),
      { scope: 'knowledge-card' },
    )
    expect(result).toEqual({ ok: true, via: 'ticket', subject: USER_ID })
  })

  it('只带旧密钥(不带票)⇒ 401,missing=true(可回落到用户登录)', async () => {
    const result = await authorizeInternalSecretCall(
      makeRequest({ [SECRET_HEADER]: TEST_AI_CALLBACK_SECRET }),
      { scope: 'knowledge-card' },
    )
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      missing: true,
      reason: 'ticket_required',
    })
  })

  it('什么都没有 ⇒ 401 且 missing=true', async () => {
    const result = await authorizeInternalSecretCall(makeRequest({}), { scope: 'checkin-pool' })
    expect(result).toMatchObject({ ok: false, status: 401, missing: true })
  })

  it('错用途的票 ⇒ scope_mismatch(跨用途票不可复用)', async () => {
    const ticket = await mint('knowledge-card')
    const result = await authorizeInternalSecretCall(
      makeRequest({ [INTERNAL_TICKET_HEADER]: ticket }),
      { scope: 'ai-callback' },
    )
    expect(result).toMatchObject({ ok: false, status: 401, reason: 'scope_mismatch' })
  })

  it('同一张票第二次使用 ⇒ replayed', async () => {
    const ticket = await mint('relay-user-pool')
    const redis = makeFakeRedis()
    const first = await authorizeInternalSecretCall(
      makeRequest({ [INTERNAL_TICKET_HEADER]: ticket }, redis),
      { scope: 'relay-user-pool' },
    )
    const second = await authorizeInternalSecretCall(
      makeRequest({ [INTERNAL_TICKET_HEADER]: ticket }, redis),
      { scope: 'relay-user-pool' },
    )
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: false, status: 401, reason: 'replayed' })
  })

  it('共享状态拿不到 ⇒ reject(fail-closed),不是放行', async () => {
    const ticket = await mint('ai-callback')
    const result = await authorizeInternalSecretCall(
      makeRequest({ [INTERNAL_TICKET_HEADER]: ticket }, null),
      { scope: 'ai-callback' },
    )
    expect(result).toMatchObject({ ok: false, status: 401, reason: 'replay_store_unavailable' })
  })
})

describe('显式 dual 兼容档', () => {
  beforeEach(() => {
    ;(config as unknown as Record<string, unknown>).INTERNAL_SECRET_AUTH_MODE = 'dual'
  })

  it('旧密钥可用(滚动发布窗口的最小兼容)', async () => {
    const result = await authorizeInternalSecretCall(
      makeRequest({ [SECRET_HEADER]: TEST_AI_CALLBACK_SECRET }),
      { scope: 'knowledge-card' },
    )
    expect(result).toEqual({ ok: true, via: 'legacy', subject: null })
  })

  it('坏票 + 对的旧密钥 ⇒ 仍拒,绝不回落老门', async () => {
    const result = await authorizeInternalSecretCall(
      makeRequest({
        [INTERNAL_TICKET_HEADER]: 'not-a-jwt',
        [SECRET_HEADER]: TEST_AI_CALLBACK_SECRET,
      }),
      { scope: 'knowledge-card' },
    )
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('旧密钥错误 ⇒ 401 secret_mismatch', async () => {
    const result = await authorizeInternalSecretCall(
      makeRequest({ [SECRET_HEADER]: 'wrong-secret' }),
      { scope: 'knowledge-card' },
    )
    expect(result).toMatchObject({ ok: false, status: 401, reason: 'secret_mismatch' })
  })
})

describe('启动守卫', () => {
  it('生产 + legacy ⇒ 抛错', () => {
    expect(() =>
      assertInternalSecretAuthModeAtStartup({ mode: 'legacy', isProduction: true }),
    ).toThrow(/生产环境禁止启动/)
  })

  it('生产 + dual ⇒ 放行但显著告警', () => {
    expect(() =>
      assertInternalSecretAuthModeAtStartup({ mode: 'dual', isProduction: true }),
    ).not.toThrow()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('INTERNAL_SECRET_AUTH_MODE'))
  })

  it('生产 + ticket(默认)⇒ 静默', () => {
    expect(() =>
      assertInternalSecretAuthModeAtStartup({ mode: 'ticket', isProduction: true }),
    ).not.toThrow()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('未知档位落回 ticket', () => {
    expect(() =>
      assertInternalSecretAuthModeAtStartup({ mode: 'typo', isProduction: true }),
    ).not.toThrow()
  })
})

describe('票主体与归属绑定', () => {
  it('真人票必须与声明的 userId 一致', () => {
    expect(ticketSubjectAllows(USER_ID, USER_ID)).toBe(true)
    expect(ticketSubjectAllows(USER_ID, 'another-user')).toBe(false)
  })

  it('服务主体票不受归属字段约束', () => {
    expect(ticketSubjectAllows('service:ai-service', 'any-user')).toBe(true)
  })
})

// 防御性:JTI 前缀是共享状态命名空间的一部分,改前缀会让滚动发布期间的新旧实例互不认识。
it('JTI key 前缀固定', () => {
  expect(JTI_KEY_PREFIX).toBe('ihui:internal-ticket:jti:')
})
