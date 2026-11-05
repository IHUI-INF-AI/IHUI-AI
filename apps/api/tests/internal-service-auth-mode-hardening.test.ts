// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​‌​​‌‍‍​‌‌‌‍‍​‌​​​​​‌‍‍​‌‌​‌‌‌​‍​‌​‌‍‌​‌​​​​‍‍​​‌‍‌​‌‍‌‍‌‌‍‍‌‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​‌‍​‌‍​​‌‌‌‌‍‌‌​​‌‌​‌‍‌​‍‌‍​​‍‍‌‌​‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌‌​‌‌‌​‌‍​​​‌‍‍⁠

/**
 * F-03 回归:内部服务鉴权的**默认态**与老通道身份收口(2026-11-05)。
 *
 * 钉四件事,对应验收要求:
 *  ① 默认配置(未写 INTERNAL_SERVICE_AUTH_MODE)⇒ 老通道不可用,即便密钥和签名都对;
 *  ② 生产 + legacy ⇒ 启动守卫抛错(fail-closed),非生产 legacy 才允许且告警;
 *  ③ 显式 dual ⇒ 老通道仅接受"全局密钥 + 身份签名"双校验,未签名身份头 401,并打显著告警;
 *  ④ 正常新机制(短期票)在默认档下逐字不受影响。
 *
 * 老通道签名的契约(发票方需同步):
 *   x-internal-service-signature = hex(HMAC-SHA256(AI_CALLBACK_SECRET,
 *                                   "legacy-v1\\n" + x-user-id + "\\n" + x-internal-service-timestamp))
 *   x-internal-service-timestamp = 秒级 Unix 时间戳,±300s 内有效。
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

const TEST_JWT_SECRET = 'unit-test-only-internal-ticket-secret-0123456789abcdef'
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET
process.env.JWT_SECRET = TEST_JWT_SECRET

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => mockSelect() }),
        }),
      }),
    },
  }
})

const TEST_AI_CALLBACK_SECRET = 'internal-secret-value-for-auth-mode-tests-0123456789'

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      AI_CALLBACK_SECRET: TEST_AI_CALLBACK_SECRET,
      // 模拟"默认配置":env 未显式设置时运行期解析到 ticket
      INTERNAL_SERVICE_AUTH_MODE: 'ticket',
      INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS: 300,
    },
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const {
  assertInternalAuthModeAtStartup,
  resolveInternalAuthMode,
  checkInternalServiceToken,
  internalAuthLegacyDoorUses,
  DEFAULT_INTERNAL_AUTH_MODE,
} = await import('../src/plugins/internal-service-token')
const { mintInternalServiceTicket, INTERNAL_TICKET_HEADER } =
  await import('../src/plugins/internal-service-ticket')
const { logger } = await import('../src/utils/logger.js')

const USER_ID = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'

function activeUser() {
  mockSelect.mockResolvedValue([{ id: USER_ID, status: 1, roleId: 0 }])
}

/** 只暴露 set 的最小 Redis 替身(票的一次性登记表);绝不连真 Redis。 */
function fakeRedis() {
  const seen = new Set<string>()
  return {
    async set(key: string, _value: string, ..._rest: unknown[]) {
      if (seen.has(key)) return null
      seen.add(key)
      return 'OK'
    },
  }
}

async function makeApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.decorate('redis' as never, fakeRedis() as never)
  app.post('/probe', async (request, reply) => {
    const ok = await checkInternalServiceToken(request, reply)
    if (!ok) return reply
    return reply.send({ ok: true, userId: request.userId })
  })
  await app.ready()
  return app
}

/** 按契约构造老通道签名头;`signature: null` 表示"故意不带签名"。 */
function legacyHeaders(
  userId: string,
  opts: {
    timestampSeconds?: number
    signature?: string | null
    timestamp?: string | null
    token?: string
  } = {},
): Record<string, string> {
  const ts = opts.timestampSeconds ?? Math.floor(Date.now() / 1000)
  const expected = createHmac('sha256', TEST_AI_CALLBACK_SECRET)
    .update(`legacy-v1\n${userId}\n${ts}`, 'utf8')
    .digest('hex')
  const headers: Record<string, string> = {
    'x-internal-service-token': opts.token ?? TEST_AI_CALLBACK_SECRET,
    'x-user-id': userId,
  }
  if (opts.timestamp !== null)
    headers['x-internal-service-timestamp'] = opts.timestamp ?? String(ts)
  if (opts.signature !== null) headers['x-internal-service-signature'] = opts.signature ?? expected
  return headers
}

beforeEach(() => {
  delete process.env.INTERNAL_SERVICE_AUTH_MODE
  mockSelect.mockReset()
  activeUser()
  vi.mocked(logger.warn).mockClear()
})

afterEach(() => {
  delete process.env.INTERNAL_SERVICE_AUTH_MODE
  process.env.JWT_SECRET = TEST_JWT_SECRET
})

afterAll(() => {
  if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
})

describe('① 默认态:只认新机制,老通道不可用', () => {
  it('档位解析缺省/未知值一律落 ticket(fail-closed),不是 dual', () => {
    expect(DEFAULT_INTERNAL_AUTH_MODE).toBe('ticket')
    expect(resolveInternalAuthMode(undefined)).toBe('ticket')
    expect(resolveInternalAuthMode('')).toBe('ticket')
    expect(resolveInternalAuthMode('doul')).toBe('ticket')
    expect(resolveInternalAuthMode('dual')).toBe('dual')
    expect(resolveInternalAuthMode('legacy')).toBe('legacy')
  })

  it('默认档:合法全局密钥 + 自报 X-User-Id(未签名)⇒ 401 且零查询', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders(USER_ID, { signature: null, timestamp: null }),
    })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
    await app.close()
  })

  it('默认档:即便老通道签名完全合法,也一律 401(老门真的关住了)', async () => {
    const before = internalAuthLegacyDoorUses()
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders(USER_ID),
    })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
    expect(internalAuthLegacyDoorUses()).toBe(before)
    await app.close()
  })

  it('④ 正常新机制:默认档下合法短期票照常 200 并注入主体', async () => {
    const ticket = await mintInternalServiceTicket({
      userId: USER_ID,
      scope: 'memory',
      jti: 'jti-auth-mode-default',
    })
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, userId: USER_ID })
    expect(mockSelect).toHaveBeenCalledTimes(1)
    await app.close()
  })
})

describe('② 生产 + legacy ⇒ 启动失败(fail-closed)', () => {
  it('生产 + legacy 抛错,错误信息点名档位与原因', () => {
    expect(() => assertInternalAuthModeAtStartup({ mode: 'legacy', isProduction: true })).toThrow(
      /legacy 在生产环境被禁止/,
    )
  })

  it('非生产 + legacy 允许,但启动打显著告警(应急回退不是静默档)', () => {
    const mode = assertInternalAuthModeAtStartup({ mode: 'legacy', isProduction: false })
    expect(mode).toBe('legacy')
    const events = vi
      .mocked(logger.warn)
      .mock.calls.map((c) => (c[1] as { event?: string } | undefined)?.event)
    expect(events).toContain('internal_auth_mode_legacy')
  })

  it('生产 + ticket(默认)静默放行,不制造噪音', () => {
    const mode = assertInternalAuthModeAtStartup({ mode: 'ticket', isProduction: true })
    expect(mode).toBe('ticket')
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('生产 + dual 允许但必须喊出来(显式兼容档)', () => {
    const mode = assertInternalAuthModeAtStartup({ mode: 'dual', isProduction: true })
    expect(mode).toBe('dual')
    const events = vi
      .mocked(logger.warn)
      .mock.calls.map((c) => (c[1] as { event?: string } | undefined)?.event)
    expect(events).toContain('internal_auth_mode_dual')
    expect(String(vi.mocked(logger.warn).mock.calls[0]?.[0])).toContain(
      'INTERNAL_SERVICE_AUTH_MODE=ticket',
    )
  })
})

describe('③ 显式 dual:老通道必须"全局密钥 + 身份签名"双校验', () => {
  beforeEach(() => {
    process.env.INTERNAL_SERVICE_AUTH_MODE = 'dual'
  })

  it('合法密钥 + 合法签名 ⇒ 200,且老门使用量 +1', async () => {
    const before = internalAuthLegacyDoorUses()
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders(USER_ID),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, userId: USER_ID })
    expect(internalAuthLegacyDoorUses() - before).toBe(1)
    await app.close()
  })

  it('合法密钥但身份头未签名 ⇒ 401 且零查询(不再直接采信自报身份)', async () => {
    const before = internalAuthLegacyDoorUses()
    const app = await makeApp()
    const unsigned = legacyHeaders(USER_ID, { signature: null, timestamp: null })
    const res = await app.inject({ method: 'POST', url: '/probe', headers: unsigned })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
    expect(internalAuthLegacyDoorUses()).toBe(before)
    await app.close()
  })

  it('签名错(用另一个密钥签的)⇒ 401 且零查询', async () => {
    const wrongSig = createHmac('sha256', 'another-secret')
      .update(`legacy-v1\n${USER_ID}\n${Math.floor(Date.now() / 1000)}`, 'utf8')
      .digest('hex')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders(USER_ID, { signature: wrongSig }),
    })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
    await app.close()
  })

  it('时间戳超窗(过期签名)⇒ 401 且零查询', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders(USER_ID, { timestampSeconds: Math.floor(Date.now() / 1000) - 3600 }),
    })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
    await app.close()
  })

  it('身份头仍须过 uuid 形状闸(签名合法但主体假)⇒ 401 零查询', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: legacyHeaders('system-worker'),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('UUID')
    expect(mockSelect).not.toHaveBeenCalled()
    await app.close()
  })
})
