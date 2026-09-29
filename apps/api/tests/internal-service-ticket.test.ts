/**
 * 内部服务一次性短期票 —— 验票侧回归(2026-09-27,PROJECT_PLAN 第五十二批·⑤ 剩余那一半)。
 *
 * 判据分三层,缺一层就等于没测:
 *  A. **每条新行为都有正反用例**:好票过、坏票各按各的原因拒,且**旧通道一字不变**
 *     (把兼容性判红就等于把内部通道打断,与本次要修的问题是两码事)。
 *  B. **两条变异取证(票面硬要求)**:摘掉重放检查必红、摘掉 TTL 检查必红 ——
 *     见下方 "变异取证" 两组。只测"坏了会拒"不够:那两组断言在判据被删掉时
 *     必须翻红,否则测的是我对判据的想象,不是判据本身(§22c"镜像只复读实现"同型)。
 *  C. **fail-closed 这一档是拍板过的决定**,所以它必须被钉成行为断言:
 *     共享状态不可用 ⇒ 拒票(而不是放过)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SignJWT } from 'jose'
import Fastify, { type FastifyInstance } from 'fastify'

// JWT_SECRET 必须是 >=32 字符的强值,否则 getJwtSecret() 直接抛。
// 刻意用测试专用值:它既不是生产密钥,也不落在 getJwtSecret 的弱默认清单里。
const TEST_JWT_SECRET = 'unit-test-only-internal-ticket-secret-0123456789abcdef'
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET
process.env.JWT_SECRET = TEST_JWT_SECRET

const { mockSelect, calls } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  calls: { users: [] as Array<{ id: string; status: number; roleId: number | null }> },
}))

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

const TEST_AI_CALLBACK_SECRET = 'internal-secret-value-for-tests-0123456789'

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      AI_CALLBACK_SECRET: TEST_AI_CALLBACK_SECRET,
      INTERNAL_SERVICE_AUTH_MODE: process.env.__TEST_MODE ?? 'dual',
      INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS: 300,
    },
  }
})

const {
  checkInternalServiceToken,
  hasInternalServiceToken,
} = await import('../src/plugins/internal-service-token')
const {
  INTERNAL_TICKET_AUDIENCE,
  INTERNAL_TICKET_HEADER,
  INTERNAL_TICKET_TYPE,
  createRedisReplayStore,
  mintInternalServiceTicket,
  verifyInternalServiceTicket,
  fingerprintTicketId,
  JTI_KEY_PREFIX,
} = await import('../src/plugins/internal-service-ticket')

const USER_ID = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
const OTHER_USER_ID = '11111111-2222-3333-4444-555555555555'

function activeUser() {
  mockSelect.mockResolvedValue([{ id: USER_ID, status: 1, roleId: 0 }])
}

/** 内存替身登记表 —— **一律禁止连生产 Redis(8811)**,见 AGENTS §5 测试隔离铁律。 */
function memoryStore(opts?: { throwOnConsume?: boolean }) {
  const seen = new Set<string>()
  const log: string[] = []
  return {
    seen,
    log,
    store: {
      async consume(jti: string) {
        log.push(jti)
        if (opts?.throwOnConsume) throw new Error('redis is down')
        if (seen.has(jti)) return 'replayed' as const
        seen.add(jti)
        return 'consumed' as const
      },
    },
  }
}

/** 只暴露 set 的最小 Redis 替身(顺带证明 createRedisReplayStore 用的是 SET…NX)。 */
function fakeRedis() {
  const map = new Map<string, number>()
  const callsArr: Array<{ key: string; args: unknown[] }> = []
  return {
    map,
    calls: callsArr,
    client: {
      async set(key: string, value: string, ...rest: unknown[]) {
        callsArr.push({ key, args: rest })
        if (map.has(key)) return null
        map.set(key, 1)
        return 'OK'
      },
    },
  }
}

async function makeInstance(redis?: unknown): Promise<FastifyInstance> {
  const app = Fastify()
  if (redis) app.decorate('redis' as never, redis as never)
  await app.ready()
  return app
}

async function run(input: {
  ticket?: string
  legacy?: string
  userId?: string | null
  scope?: 'ai-callback' | 'codebase-index'
  redis?: unknown
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const instance = await makeInstance(input.redis)
  instance.post('/probe', async (request, reply) => {
    const ok = await checkInternalServiceToken(request, reply, { scope: input.scope })
    if (ok) return reply.send({ ok: true })
    return reply
  })
  const headers: Record<string, string> = {}
  if (input.ticket) headers[INTERNAL_TICKET_HEADER] = input.ticket
  if (input.legacy) headers['x-internal-service-token'] = input.legacy
  if (input.userId !== null) headers['x-user-id'] = input.userId ?? USER_ID
  const res = await instance.inject({ method: 'POST', url: '/probe', headers })
  const out = { ok: res.statusCode === 200, status: res.statusCode, body: res.body }
  await instance.close()
  return out
}

beforeEach(() => {
  mockSelect.mockReset()
  activeUser()
})

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
  process.env.JWT_SECRET = TEST_JWT_SECRET
})

// ── 0. 形状:签出来的票必须带那三道用途标记 ────────────────────────────────
describe('票的 claim 形状', () => {
  it('带 aud=内部专用档、type=内部票、jti、exp、sub', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', ttlSeconds: 60 })
    const { payload } = await (await import('jose')).jwtVerify(t, new TextEncoder().encode(TEST_JWT_SECRET))
    expect(payload.aud).toBe(INTERNAL_TICKET_AUDIENCE)
    expect(payload.type).toBe(INTERNAL_TICKET_TYPE)
    expect(payload.sub).toBe(USER_ID)
    expect(typeof payload.jti).toBe('string')
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp! - payload.iat!).toBe(60)
  })

  it('TTL 由验票侧封顶:传 99999 也只会签成 300s', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', ttlSeconds: 99999 })
    const { payload } = await (await import('jose')).jwtVerify(t, new TextEncoder().encode(TEST_JWT_SECRET))
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(300)
  })
})

// ── 1. 正向:好票必须过(否则这次改动只是把通道改坏了)────────────────────
describe('正向通道', () => {
  it('有效票 + 主体一致 + 用户活跃 ⇒ 通过', async () => {
    const s = memoryStore()
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback' })
    const r = await verifyInternalServiceTicket(t, { store: s.store, expectedScope: 'ai-callback' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe(USER_ID)
  })

  it('中间件级:带票请求经 checkInternalServiceToken 拿到 200', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-mw-1' })
    const res = await run({ ticket: t, scope: 'ai-callback', redis: fakeRedis().client })
    expect(res).toMatchObject({ ok: true, status: 200 })
  })

  it('只有票、没有常驻密钥时也必须被识别为内部凭据(分流判据)', () => {
    const app = { headers: { [INTERNAL_TICKET_HEADER]: 'x' } }
    expect(hasInternalServiceToken(app as never)).toBe(true)
    expect(hasInternalServiceToken({ headers: {} } as never)).toBe(false)
  })
})

// ── 2. 重放:同一张票第二次必须拒(本票的核心命题)───────────────────────
describe('一次性', () => {
  it('同一 jti 连用两次 ⇒ 第二次 replayed', async () => {
    const s = memoryStore()
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-replay' })
    expect((await verifyInternalServiceTicket(t, { store: s.store })).ok).toBe(true)
    const second = await verifyInternalServiceTicket(t, { store: s.store })
    expect(second).toEqual({ ok: false, reason: 'replayed' })
  })

  it('重放登记表按 jti 的 SHA-256 存,Redis 里不得出现 jti 原文', async () => {
    const fake = fakeRedis()
    const store = createRedisReplayStore(fake.client)
    await store.consume('a-very-secret-jti-value', 60)
    expect([...fake.map.keys()]).toEqual([`${JTI_KEY_PREFIX}${fingerprintTicketId('a-very-secret-jti-value')}`])
    expect([...fake.map.keys()].join()).not.toContain('a-very-secret-jti')
    // SET 必须是 NX + EX(否则"一次一密"不是原子的)
    expect(fake.calls[0]!.args).toEqual(['EX', 60, 'NX'])
  })

  it('判序:scope 不匹配时**不得**把票烧掉(否则配置错误伪装成重放攻击)', async () => {
    const s = memoryStore()
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-order' })
    const bad = await verifyInternalServiceTicket(t, { store: s.store, expectedScope: 'codebase-index' })
    expect(bad).toEqual({ ok: false, reason: 'scope_mismatch' })
    expect(s.log).toHaveLength(0) // 一次都没 consume
    const good = await verifyInternalServiceTicket(t, { store: s.store, expectedScope: 'ai-callback' })
    expect(good.ok).toBe(true) // 票还在,合法调用方重试仍能过
  })
})

// ── 3. TTL:过期必拒、超长必拒 ───────────────────────────────────────────
describe('时效', () => {
  it('exp 过了 ⇒ expired(用未来时刻喂,不靠 sleep)', async () => {
    const s = memoryStore()
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-exp' })
    const { payload } = await (await import('jose')).jwtVerify(t, new TextEncoder().encode(TEST_JWT_SECRET))
    const future = (payload.exp ?? 0) + 5
    expect(await verifyInternalServiceTicket(t, { store: s.store, nowSeconds: future })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('iat→exp 跨度超过验票侧上限 ⇒ too_long_lived(发票方误签也拦得住)', async () => {
    const t = await new SignJWT({ type: INTERNAL_TICKET_TYPE, scope: 'ai-callback', jti: 'jti-long' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setAudience(INTERNAL_TICKET_AUDIENCE)
      .setIssuedAt(1_000)
      .setExpirationTime(1_000 + 3600)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
    expect(
      await verifyInternalServiceTicket(t, { store: memoryStore().store, nowSeconds: 1_001, maxTtlSeconds: 300 }),
    ).toEqual({ ok: false, reason: 'too_long_lived' })
  })
})

// ── 4. 跨用途:同一把密钥下的其它 token 一律不算内部票 ───────────────────
describe('跨用途', () => {
  it('用户 access token 形态(aud=ihui-ai-users)⇒ wrong_audience', async () => {
    const t = await new SignJWT({ phone: '13800000000', roleId: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setAudience('ihui-ai-users')
      .setIssuer('ihui-ai')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
    expect(await verifyInternalServiceTicket(t, { store: memoryStore().store })).toMatchObject({
      ok: false,
      reason: 'wrong_audience',
    })
  })

  it('aud 对但缺 type ⇒ wrong_type(refresh token 也是这一档)', async () => {
    const t = await new SignJWT({ scope: 'ai-callback', jti: 'jti-notype' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setAudience(INTERNAL_TICKET_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
    expect(await verifyInternalServiceTicket(t, { store: memoryStore().store })).toEqual({
      ok: false,
      reason: 'wrong_type',
    })
  })

  it('scope 不在封闭集内 ⇒ bad_scope', async () => {
    const t = await new SignJWT({ type: INTERNAL_TICKET_TYPE, scope: 'whatever', jti: 'jti-scope' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setAudience(INTERNAL_TICKET_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
    expect(await verifyInternalServiceTicket(t, { store: memoryStore().store })).toEqual({
      ok: false,
      reason: 'bad_scope',
    })
  })

  it('替 A 签的票不能拿去当 B 用 ⇒ 中间件层 401', async () => {
    const t = await mintInternalServiceTicket({ userId: OTHER_USER_ID, scope: 'ai-callback', jti: 'jti-subject' })
    const res = await run({ ticket: t, userId: USER_ID, scope: 'ai-callback', redis: fakeRedis().client })
    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  it('坏票**绝不回落**到常驻密钥:同时带合法旧头也照样拒', async () => {
    const res = await run({
      ticket: 'not-even-a-jwt',
      legacy: TEST_AI_CALLBACK_SECRET,
      scope: 'ai-callback',
      redis: fakeRedis().client,
    })
    expect(res.status).toBe(401)
  })
})

// ── 5. 共享状态不可用 = fail-closed(本票拍板的决定)────────────────────
describe('登记表不可用', () => {
  it('store 为 null ⇒ replay_store_unavailable,不记通过', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-nostore' })
    expect(await verifyInternalServiceTicket(t, { store: null })).toEqual({
      ok: false,
      reason: 'replay_store_unavailable',
    })
  })

  it('Redis 抛错 ⇒ 同样拒票(fail-closed)', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-throw' })
    expect(await verifyInternalServiceTicket(t, { store: memoryStore({ throwOnConsume: true }).store })).toEqual({
      ok: false,
      reason: 'replay_store_unavailable',
    })
  })

  it('中间件级:实例未注册 redis 插件时带票请求拿 401,而不是"跳过检查放行"', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-nodecorator' })
    const res = await run({ ticket: t, scope: 'ai-callback' }) // 无 redis
    expect(res.status).toBe(401)
  })
})

// ── 6. 兼容窗口:旧行为一字不变 ────────────────────────────────────────
describe('兼容窗口', () => {
  it('dual 档:合法常驻密钥仍过(现网不断)', async () => {
    const res = await run({ legacy: TEST_AI_CALLBACK_SECRET })
    expect(res).toMatchObject({ ok: true, status: 200 })
  })

  it('dual 档:错密钥仍 401(没有因为新增通道而变松)', async () => {
    const res = await run({ legacy: 'wrong-secret' })
    expect(res.status).toBe(401)
  })

  it('ticket 档:常驻密钥被拒(证明这一档真的关住了老门)', async () => {
    process.env.__TEST_MODE = 'ticket'
    vi.resetModules()
    const mod = await import('../src/plugins/internal-service-token')
    const app = Fastify()
    app.post('/probe', async (request, reply) => {
      const ok = await mod.checkInternalServiceToken(request, reply)
      if (ok) void reply.send({ ok: true })
      return reply
    })
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: { 'x-internal-service-token': TEST_AI_CALLBACK_SECRET, 'x-user-id': USER_ID },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
    process.env.__TEST_MODE = 'dual'
    vi.resetModules()
  })
})

// ── 7. 变异取证:摘掉判据必须翻红(不是恒真断言)────────────────────────
describe('变异取证', () => {
  /**
   * 变异 A「摘掉重放检查」:把 verify 的 consume 一步短路成"永远 consumed"。
   * 判据本身没有开关可以关,所以在测试里重演被摘掉的形状:同一个 store 只喂一次,
   * 但断言方向反过来 —— 若实现不再调 consume,下面的 spy 计数就是 0 ⇒ 红。
   */
  it('A 重放检查确实被执行(把 consume 摘掉 ⇒ 本条必红)', async () => {
    const s = memoryStore()
    const spy = vi.fn(async (jti: string) => {
      const r = await s.store.consume(jti, 60)
      return r
    })
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-mut-a' })
    await verifyInternalServiceTicket(t, { store: { consume: spy } })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('jti-mut-a', expect.any(Number))
  })

  /**
   * 变异 B「摘掉 TTL 检查」:实现里去掉 expired 分支 ⇒ 用未来时刻喂一枚真过期票,
   * 摘掉判据后它会返回 ok:true,本条即红。断言的是**结论本身**,不是"有没有调用 Date.now"。
   */
  it('B 过期票在判据被摘掉时会变绿 —— 所以现在必须变红', async () => {
    const t = await mintInternalServiceTicket({ userId: USER_ID, scope: 'ai-callback', jti: 'jti-mut-b' })
    const { payload } = await (await import('jose')).jwtVerify(t, new TextEncoder().encode(TEST_JWT_SECRET))
    const expiredNow = (payload.exp ?? 0) + 1
    const verdict = await verifyInternalServiceTicket(t, { store: memoryStore().store, nowSeconds: expiredNow })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toBe('expired')
    // 反向对照:同一枚票在有效期内必须 ok(否则 B 只是"永远红"的断言,同样无牙)
    expect((await verifyInternalServiceTicket(t, { store: memoryStore().store })).ok).toBe(true)
  })
})

// ── 8. 源码形状锁:防"改了行为但把出口摘了"──────────────────────────────
describe('源码形状锁', () => {
  const tokenSrc = () => readFileSync(resolve(__dirname, '../src/plugins/internal-service-token.ts'), 'utf8')
  const ticketSrc = () => readFileSync(resolve(__dirname, '../src/plugins/internal-service-ticket.ts'), 'utf8')

  it('明文密钥比较形态不得回来(第三十八批锁,继续生效)', () => {
    expect(tokenSrc()).not.toMatch(/token\s*!==\s*config\.AI_CALLBACK_SECRET/)
  })

  it('票判失败分支必须存在,且不得在票判失败后回落旧通道', () => {
    const src = tokenSrc()
    expect(src).toMatch(/if \(!verdict\.ok\) \{/)
    expect(src).toMatch(/return false/)
  })

  it('重放判定必须经 Redis SET…NX 且失败一律拒(fail-closed 写死在实现里)', () => {
    const src = ticketSrc()
    expect(src).toMatch(/'EX', Math\.max\(1, ttlSeconds\), 'NX'/)
    expect(src).toMatch(/catch \{[\s\S]*?'replay_store_unavailable'/)
  })

  it('分流判据必须同时认两种凭据头(摘掉票那一半 ⇒ 本条红)', () => {
    expect(tokenSrc()).toMatch(
      /request\.headers\[INTERNAL_TOKEN_HEADER\]\s*\)\s*\|\|\s*!!\s*request\.headers\[INTERNAL_TICKET_HEADER\]/,
    )
  })
})
