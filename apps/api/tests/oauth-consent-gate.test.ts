// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 OAuth 通用回调 · 用户协议同意闸(2026-10-27 立)。
 *
 * 背景:web 与 RN 端只在**前端**采集"已同意用户协议与隐私政策",服务端此前没有任何
 * 记录。于是绕过前端、直接对 `POST /api/auth/:platform/callback` 打一个合法的
 * code/state,就能在从未同意条款的情况下完成查/建用户并拿到 token ——
 * 「认证不等于授权」在第三方登录这条链上没有落地。
 *
 * 机制:客户端在跳转厂商前调用 `POST /api/auth/oauth/consent`,把同意结果按 state
 * 写入 Redis(`oauth:consent:<state>`,TTL 600s);回调在查/建用户与签发 token 之前
 * 一次性 get + del 消费。缺失 / 过期 / 平台不符 / 未同意一律 403 + OAUTH_AGREEMENT_REQUIRED。
 *
 * 本文件覆盖:无记录、未同意、平台不符、过期、一次性消费、发起端参数校验、
 * Redis 不可用时 fail-closed(503)。判据单源见 `src/services/oauth-consent.ts`。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type { Redis } from 'ioredis'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8812/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8813/0'
})

import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import {
  OAUTH_AGREEMENT_REQUIRED,
  OAUTH_CONSENT_KEY_PREFIX,
  OAUTH_CONSENT_TTL_SECONDS,
} from '../src/services/oauth-consent.js'

/** Redis 内存替身:只实现同意记录用到的 set(EX)/get/del/ttl。 */
class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>()

  async set(key: string, value: string, _ex?: string, ttlSeconds?: number): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : null,
    })
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return -2
    if (entry.expiresAt === null) return -1
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
  }

  /** 写一条已过期的记录:真实 Redis 里就是 EX 到期后的样子。 */
  setExpired(key: string, value: string): void {
    this.store.set(key, { value, expiresAt: Date.now() - 1_000 })
  }

  clear(): void {
    this.store.clear()
  }
}

const redis = new FakeRedis()

/** 预置一条发起期同意记录(等价于客户端跳转厂商前调过 /auth/oauth/consent)。 */
async function seedConsent(
  state: string,
  record: { platform?: string; agreementAccepted?: boolean },
  ttlSeconds = OAUTH_CONSENT_TTL_SECONDS,
): Promise<void> {
  await redis.set(
    OAUTH_CONSENT_KEY_PREFIX + state,
    JSON.stringify({ createdAt: new Date().toISOString(), ...record }),
    'EX',
    ttlSeconds,
  )
}

/** 直接写一条已过期的记录(模拟"用户停留在 IdP 授权页超过 10 分钟")。 */
function seedExpiredConsent(state: string, platform: string): void {
  redis.setExpired(
    OAUTH_CONSENT_KEY_PREFIX + state,
    JSON.stringify({ platform, agreementAccepted: true, createdAt: new Date().toISOString() }),
  )
}

function buildApp(withRedis: boolean): FastifyInstance {
  const app = Fastify({ logger: false })
  if (withRedis) app.decorate('redis', redis as unknown as Redis)
  return app
}

describe('第三方 OAuth 通用回调 · 用户协议同意闸', () => {
  let app: FastifyInstance
  let appWithoutRedis: FastifyInstance

  beforeAll(async () => {
    app = buildApp(true)
    await app.register(cookie)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()

    // Redis 不可用的实例:用来验证"没有地方落同意记录"时宁可拒绝也不放行
    appWithoutRedis = buildApp(false)
    await appWithoutRedis.register(cookie)
    await appWithoutRedis.register(authExtendedRoutes, { prefix: '/api' })
    await appWithoutRedis.ready()
  })

  afterAll(async () => {
    await app.close()
    await appWithoutRedis.close()
  })

  beforeEach(() => {
    redis.clear()
  })

  function callback(
    instance: FastifyInstance,
    platform: string,
    state: string,
    code = 'fixture-code',
  ) {
    return instance.inject({
      method: 'POST',
      url: `/api/auth/${platform}/callback`,
      payload: { code, state },
    })
  }

  it('① 无发起期记录 ⇒ 403 + OAUTH_AGREEMENT_REQUIRED,不得进入厂商交换', async () => {
    // 为什么必须有这道闸:没有记录就说明客户端从未调过同意端点,
    // 此时任何 code 交换/建号/发 token 都等于让未同意的用户登录。
    const res = await callback(app, 'wechat', 'no-record-state-0123456789')
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(res.json().errorCode).toBe(OAUTH_AGREEMENT_REQUIRED)
    expect(res.json().message).toBe('请先同意用户协议与隐私政策')
  })

  it('② 记录里 agreementAccepted 不是 true ⇒ 403(缺省/脏值一律按未同意)', async () => {
    const state = 'not-agreed-state-0123456789'
    await seedConsent(state, { platform: 'wechat', agreementAccepted: false })
    const res = await callback(app, 'wechat', state)
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe(OAUTH_AGREEMENT_REQUIRED)
  })

  it('③ state 记的是 A 平台,却拿来 B 平台回调 ⇒ 403', async () => {
    // 防止换平台复用同一个 state:同意是针对具体发起方记录的
    const state = 'platform-mismatch-state-0123456789'
    await seedConsent(state, { platform: 'github', agreementAccepted: true })
    const res = await callback(app, 'wechat', state)
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe(OAUTH_AGREEMENT_REQUIRED)
  })

  it('④ 记录已过期 / 键不存在 ⇒ 403(发起态不能无限期复用)', async () => {
    const state = 'expired-state-0123456789'
    seedExpiredConsent(state, 'wechat')
    expect(await redis.get(OAUTH_CONSENT_KEY_PREFIX + state)).toBeNull()
    const res = await callback(app, 'wechat', state)
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe(OAUTH_AGREEMENT_REQUIRED)
  })

  it('⑤ 通过一次后再用同一 state 回调 ⇒ 403(一次性消费,防重放)', async () => {
    const state = 'one-time-state-0123456789'
    await seedConsent(state, { platform: 'wechat', agreementAccepted: true })

    // 第一次过了同意闸:微信未配置 ⇒ 400,证明请求已走到平台分支(不是 403 闸门)
    const first = await callback(app, 'wechat', state)
    expect(first.statusCode).toBe(400)
    expect(first.json().message).toContain('微信')
    // 同意记录已被消费
    expect(await redis.get(OAUTH_CONSENT_KEY_PREFIX + state)).toBeNull()

    const second = await callback(app, 'wechat', state)
    expect(second.statusCode).toBe(403)
    expect(second.json().errorCode).toBe(OAUTH_AGREEMENT_REQUIRED)
  })

  it('⑥ 发起端点参数校验:缺 state / state 过短 / 未勾选 / 平台非法 ⇒ 400', async () => {
    const url = '/api/auth/oauth/consent'
    const missingState = await app.inject({
      method: 'POST',
      url,
      payload: { platform: 'wechat', agreementAccepted: true },
    })
    expect(missingState.statusCode).toBe(400)

    const shortState = await app.inject({
      method: 'POST',
      url,
      payload: { state: 'too-short', platform: 'wechat', agreementAccepted: true },
    })
    expect(shortState.statusCode).toBe(400)

    const notAccepted = await app.inject({
      method: 'POST',
      url,
      payload: {
        state: 'consent-state-0123456789abcdef',
        platform: 'wechat',
        agreementAccepted: false,
      },
    })
    expect(notAccepted.statusCode).toBe(400)

    const badPlatform = await app.inject({
      method: 'POST',
      url,
      payload: {
        state: 'consent-state-0123456789abcdef',
        platform: 'facebook',
        agreementAccepted: true,
      },
    })
    expect(badPlatform.statusCode).toBe(400)

    const okState = 'consent-ok-state-0123456789abcdef'
    const ok = await app.inject({
      method: 'POST',
      url,
      payload: { state: okState, platform: 'wechat', agreementAccepted: true },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ code: 0, message: 'success', data: { ok: true } })
    // 落库内容与 TTL 必须与回调侧的判据对得上
    const stored = JSON.parse((await redis.get(OAUTH_CONSENT_KEY_PREFIX + okState)) ?? '{}') as {
      platform?: string
      agreementAccepted?: boolean
      createdAt?: string
    }
    expect(stored.platform).toBe('wechat')
    expect(stored.agreementAccepted).toBe(true)
    expect(typeof stored.createdAt).toBe('string')
    const ttl = await redis.ttl(OAUTH_CONSENT_KEY_PREFIX + okState)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(OAUTH_CONSENT_TTL_SECONDS)
  })

  it('⑦ Redis 不可用 ⇒ 发起端点 503(fail-closed,不假装记录成功)', async () => {
    const res = await appWithoutRedis.inject({
      method: 'POST',
      url: '/api/auth/oauth/consent',
      payload: {
        state: 'redis-down-state-0123456789',
        platform: 'wechat',
        agreementAccepted: true,
      },
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe(503)
    expect(res.json().errorCode).toBe('OAUTH_CONSENT_UNAVAILABLE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
