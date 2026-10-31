// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 12 批(2026-10-31)修复钉住。
 *
 * 覆盖:
 * - devices pair-exchange 失败计数闸:码即凭据的公开端点,TTL 窗口内每 IP 第 6 次
 *   失败起 429(此前无限速,10^8 码空间可在线爆破);成功兑换清零;redis 不可用时
 *   fail-open 放行(限流是增强,不得掐死正常兑换)。
 * - developer-relay-keys-admin:插件级 authenticate —— 此前读 request.userId 却无
 *   任何注入源,对所有调用者(含合法归属者)恒 401;挂上后匿名仍 401,形态从
 *   "结构性坏死"归位到正常鉴权面。
 */

import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (req: { headers?: Record<string, unknown> }) => {
    if (!req.headers?.authorization) {
      const e = new Error('未登录') as Error & { statusCode?: number }
      e.statusCode = 401
      throw e
    }
    ;(req as unknown as { userId: string }).userId = '00000000-0000-4000-8000-000000000001'
  }),
}))

class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message)
  }
}

let exchangeShouldSucceed = false
vi.mock('../src/services/device-service.js', async () => {
  const actual = (await vi.importActual('../src/services/device-service.js')) as Record<
    string,
    unknown
  >
  return {
    ...actual,
    exchangePairCode: vi.fn(async () => {
      if (exchangeShouldSucceed) {
        return { deviceToken: 'tok', device: { id: 'dev-1' } }
      }
      throw new AppError('配对码无效', 400, 'PAIR_CODE_INVALID')
    }),
  }
})

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), execute: vi.fn() },
  dbRead: { select: vi.fn() },
}))

import { devicesRoutes } from '../src/routes/devices.js'
import developerRelayKeysAdminRoutes from '../src/routes/developer-relay-keys-admin.js'

const VALID_BODY = { code: '12345678', capabilities: {} }

function fakeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    incr: async (k: string) => {
      const n = (Number.parseInt(store.get(k) ?? '0', 10) || 0) + 1
      store.set(k, String(n))
      return n
    },
    expire: async () => 1,
    del: async (k: string) => {
      store.delete(k)
      return 1
    },
  }
}

describe('pair-exchange 失败计数闸(第 12 批 H-2)', () => {
  it('连续 5 次失败后第 6 次 → 429', async () => {
    const app = Fastify({ logger: false })
    app.decorate('redis', fakeRedis())
    await app.register(devicesRoutes)
    await app.ready()
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/devices/pair-exchange',
        payload: VALID_BODY,
      })
      expect(res.statusCode).toBe(400)
    }
    const res = await app.inject({
      method: 'POST',
      url: '/devices/pair-exchange',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(429)
    expect(res.json().errorCode).toBe('PAIR_EXCHANGE_RATE_LIMITED')
    await app.close()
  })

  it('成功兑换清零计数,之后可再次失败', async () => {
    const app = Fastify({ logger: false })
    const redis = fakeRedis()
    app.decorate('redis', redis)
    await app.register(devicesRoutes)
    await app.ready()
    // 先失败 2 次
    for (let i = 0; i < 2; i++) {
      await app.inject({ method: 'POST', url: '/devices/pair-exchange', payload: VALID_BODY })
    }
    exchangeShouldSucceed = true
    const ok = await app.inject({
      method: 'POST',
      url: '/devices/pair-exchange',
      payload: VALID_BODY,
    })
    expect(ok.statusCode).toBe(200)
    expect([...redis.store.keys()].filter((k) => k.startsWith('pairx:fail:'))).toHaveLength(0)
    // 计数已清零:再次失败 5 次以内不应 429
    exchangeShouldSucceed = false
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/devices/pair-exchange',
        payload: VALID_BODY,
      })
      expect(res.statusCode).toBe(400)
    }
    await app.close()
  })

  it('redis 不可用(fail-open)→ 不因限流拒绝', async () => {
    const app = Fastify({ logger: false })
    await app.register(devicesRoutes)
    await app.ready()
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/devices/pair-exchange',
        payload: VALID_BODY,
      })
      expect(res.statusCode).toBe(400)
    }
    await app.close()
  })
})

describe('developer-relay-keys-admin 鉴权归位(第 12 批 H-3)', () => {
  it('匿名 → 401(挂 authenticate 后形态)', async () => {
    const app = Fastify({ logger: false })
    await app.register(developerRelayKeysAdminRoutes)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/developer/relay/keys/bulk',
      payload: { ids: ['00000000-0000-4000-8000-00000000aa01'], patch: { rateLimit: 10 } },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
