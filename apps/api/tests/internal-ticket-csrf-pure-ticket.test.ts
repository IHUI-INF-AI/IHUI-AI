// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 纯票部署(INTERNAL_SERVICE_AUTH_MODE=ticket,且**没有**常驻旧密钥)下的 CSRF 前哨回归。
 *
 * 立因(两个缺口之一):CSRF 钩子注册在 `onRequest`,早于路由鉴权。旧的
 * `isVerifiedInternalMachineCall` 只认「常驻旧密钥 / agent-control 裸密钥」两族,
 * 纯票部署里这三条写接口在**钩子层**就被 403,路由鉴权根本没机会跑。
 *
 * 修法必须同时满足一条听起来矛盾的要求:
 *   - CSRF 要能认出内部票(否则纯票部署 403);
 *   - 又**绝不能**在 CSRF 层消费票 —— 票是 jti 单次使用,若这里 consume,
 *     合法调用方的票会被 CSRF 吃掉,路由层只剩 `replayed` ⇒ 第一发就是 401。
 * 因此判据走 `verifyInternalServiceTicketSignature`(只验签 + 判时效,不登记),
 * 消费只发生在路由侧 `checkInternalServiceToken` 那一次。
 *
 * 本文件把这条性质钉成可观测的三件事(均不只看状态码):
 *  A. 纯票 + 无 CSRF 对 ⇒ POST 写接口 200,且票只被消费 **一次**(set 调用 +1);
 *     (若 CSRF 也消费,+2 ⇒ 本断言先红)
 *  B. 同一张票第二发 ⇒ 401(replay,鉴权层拒),而**不是** 403(CSRF 没误吃、也没二次拦);
 *  C. 伪造签名 / 过期签名 / 用途错 ⇒ CSRF 层必须拒(403)或落到鉴权层拒(401),
 *     且伪造与过期两臂必须证明**路由鉴权一步未进**(零查库)。
 *
 * 夹具:mocked db/config + 内存 Redis 替身,不连生产 PG/Redis(§5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { SignJWT } from 'jose'

const { TEST_JWT_SECRET } = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8803'
  const secret = 'internal-ticket-csrf-pure-secret-at-least-32-chars-0123456789'
  process.env.JWT_SECRET = secret
  process.env.INTERNAL_SERVICE_AUTH_MODE = 'ticket'
  return { TEST_JWT_SECRET: secret }
})

const UUID_PRINCIPAL = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
const SCOPE_MISMATCH_TICKET_SCOPE = 'ai-callback'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  const chain = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockSelect() }) }) }),
  }
  const stub = {
    ...chain,
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
  }
  return { db: stub, dbRead: stub, dbWriter: stub, dbClient: { end: vi.fn() } }
})

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      JWT_SECRET: TEST_JWT_SECRET,
      NODE_ENV: 'test',
      // 关键:**没有常驻旧密钥** —— 这条用例证明票可以单独自足。
      AI_CALLBACK_SECRET: '',
    },
  }
})

import csrfPlugin from '../src/plugins/csrf.js'
import {
  INTERNAL_TICKET_HEADER,
  mintInternalServiceTicket,
  type InternalTicketScope,
} from '../src/plugins/internal-service-ticket.js'
import { checkInternalServiceToken } from '../src/plugins/internal-service-token.js'
import { isVerifiedInternalTicketCall } from '../src/utils/internal-principal.js'

/** 只认 set 的内存 Redis:第一次 SET NX 返回 'OK',同键再来返回 null(与生产语义一致)。 */
function fakeRedis() {
  const setCalls: Array<{ key: string; ttl: number }> = []
  const consumed = new Set<string>()
  return {
    setCalls,
    client: {
      async set(key: string, _value: string, _ex: 'EX', ttl: number) {
        setCalls.push({ key, ttl })
        if (consumed.has(key)) return null
        consumed.add(key)
        return 'OK'
      },
    },
  }
}

let app: FastifyInstance
let redis: ReturnType<typeof fakeRedis>

beforeAll(async () => {
  redis = fakeRedis()
  app = Fastify({ logger: false })
  app.decorate('redis' as never, redis.client as never)
  await app.register(cookie)
  await app.register(csrfPlugin)
  // 用真实路由鉴权出口模拟三条写接口:CSRF 钩子与路径无关,路由侧同一函数才决定消费。
  app.post('/api/memory', async (request, reply) => {
    const ok = await checkInternalServiceToken(request, reply, { scope: 'memory' })
    if (!ok) return reply
    return reply.send({ ok: true })
  })
  app.post('/api/automations', async (_request, reply) => reply.send({ ok: true }))
  app.post('/api/im-gateway/send', async (_request, reply) => reply.send({ ok: true }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mockSelect.mockReset()
  mockSelect.mockResolvedValue([{ id: UUID_PRINCIPAL, status: 1, roleId: 0 }])
  redis.setCalls.length = 0
})

async function mint(
  overrides: { userId?: string; scope?: InternalTicketScope; jti?: string } = {},
) {
  return await mintInternalServiceTicket({
    userId: overrides.userId ?? UUID_PRINCIPAL,
    scope: overrides.scope ?? 'memory',
    jti: overrides.jti,
  })
}

async function signRaw(claims: {
  scope: string
  jti: string
  iat: number
  exp: number
  secret?: string
}) {
  const secret = claims.secret ?? TEST_JWT_SECRET
  return await new SignJWT({
    type: 'internal-service-ticket',
    scope: claims.scope,
    jti: claims.jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(UUID_PRINCIPAL)
    .setAudience('ihui-internal-service')
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .sign(new TextEncoder().encode(secret))
}

describe('A. 纯票部署(无旧密钥)下 POST 写接口不被 CSRF 403', () => {
  it('POST /api/memory 仅带票、无 CSRF 对 ⇒ 200,且票只被消费一次', async () => {
    const ticket = await mint({ jti: 'jti-pure-a-memory' })
    const before = redis.setCalls.length
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: { key: 'k' },
    })
    // 旧现场:这里 403 "CSRF 令牌缺失或无效"。
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    // 路由鉴权确实跑了(用户存在 + 活跃查询一次)
    expect(mockSelect).toHaveBeenCalledTimes(1)
    // 只多一次 SET:CSRF 若也消费会 +2
    expect(redis.setCalls.length).toBe(before + 1)
  })

  it.each(['/api/automations', '/api/im-gateway/send'])(
    'POST %s 仅带票 ⇒ 200(这三个写接口此前同型 403)',
    async (url) => {
      const ticket = await mint({ jti: `jti-pure-${url.replace(/[^a-z0-9]/gi, '-')}` })
      const res = await app.inject({
        method: 'POST',
        url,
        headers: { [INTERNAL_TICKET_HEADER]: ticket },
        payload: {},
      })
      expect(res.statusCode).toBe(200)
    },
  )
})

describe('B. 票被重放:只在鉴权处拒,CSRF 不误吃票', () => {
  it('同一张票连打两发:第一发 200,第二发 401(不是 403),两次 SET 都发生在鉴权层', async () => {
    const ticket = await mint({ jti: 'jti-pure-b-replay' })
    const first = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {},
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {},
    })
    expect(second.statusCode).toBe(401)
    expect(second.statusCode).not.toBe(403)
    expect(second.json().message).toContain('Invalid internal service ticket')
    // 两次请求各消费一次 ⇒ 若 CSRF 也消费,这里会是 3+ 且第一发就已 401
    expect(redis.setCalls.length).toBe(2)
  })
})

describe('C. 伪造 / 过期 / 跨用途:CSRF 与鉴权两层各自归位', () => {
  it('伪造签名(HS256 错密钥)⇒ CSRF 403,且路由鉴权一步未进(零查库、零消费)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const forged = await signRaw({
      scope: 'memory',
      jti: 'jti-pure-c-forged',
      iat: now,
      exp: now + 60,
      secret: 'attacker-controlled-secret-at-least-32-chars-0123456789',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: forged },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
    expect(mockSelect).not.toHaveBeenCalled()
    expect(redis.setCalls).toHaveLength(0)
  })

  it('签名正确但已过期 ⇒ CSRF 403,且路由鉴权一步未进', async () => {
    const now = Math.floor(Date.now() / 1000)
    const expired = await signRaw({
      scope: 'memory',
      jti: 'jti-pure-c-expired',
      iat: now - 600,
      exp: now - 300,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: expired },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
    expect(mockSelect).not.toHaveBeenCalled()
    expect(redis.setCalls).toHaveLength(0)
  })

  it('签真但用途不符(memory 路由收到 ai-callback 票)⇒ 落到鉴权层 401(CSRF 不误拦也不放行)', async () => {
    const ticket = await mint({
      scope: SCOPE_MISMATCH_TICKET_SCOPE as InternalTicketScope,
      jti: 'jti-pure-c-scope',
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {},
    })
    expect(res.statusCode).toBe(401)
    expect(res.statusCode).not.toBe(403)
    expect(res.json().message).toContain('Invalid internal service ticket')
  })

  it('纯票档下只带常驻旧密钥(无票)⇒ CSRF 403:老门已关,票档部署不再靠它', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memory',
      headers: { 'x-internal-service-token': 'legacy-shared-secret' },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })
})

describe('D. 出口函数本体:非消耗式验签四臂(对/伪造/过期/缺)', () => {
  it('有效票 true;伪造签名 false;过期 false;无头 false', async () => {
    const now = Math.floor(Date.now() / 1000)
    const valid = await mint({ jti: 'jti-pure-d-valid' })
    const forged = await signRaw({
      scope: 'memory',
      jti: 'jti-pure-d-forged',
      iat: now,
      exp: now + 60,
      secret: 'attacker-controlled-secret-at-least-32-chars-0123456789',
    })
    const expired = await signRaw({
      scope: 'memory',
      jti: 'jti-pure-d-expired',
      iat: now - 600,
      exp: now - 300,
    })
    const asRequest = (headers: Record<string, string>) =>
      ({ headers }) as unknown as Parameters<typeof isVerifiedInternalTicketCall>[0]

    await expect(
      isVerifiedInternalTicketCall(asRequest({ [INTERNAL_TICKET_HEADER]: valid })),
    ).resolves.toBe(true)
    await expect(
      isVerifiedInternalTicketCall(asRequest({ [INTERNAL_TICKET_HEADER]: forged })),
    ).resolves.toBe(false)
    await expect(
      isVerifiedInternalTicketCall(asRequest({ [INTERNAL_TICKET_HEADER]: expired })),
    ).resolves.toBe(false)
    await expect(isVerifiedInternalTicketCall(asRequest({}))).resolves.toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
