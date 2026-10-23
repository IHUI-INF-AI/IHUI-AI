// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反代号池 · 出口代理池管理面(2026-10-22 立):此前池表无写入入口。
// DB 走仓内 Proxy chainable mock 模式(夹具写法参考 tests/relay-usage-ledger.test.ts)。

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
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
  },
}))

const {
  mockVerifyAccessToken,
  mockSelectResult,
  mockInsertResult,
  mockUpdateResult,
  mockDeleteResult,
  sinks,
  rearmDbMockDefaults,
} = vi.hoisted(() => {
  type Armed = { mockResolvedValue(value: unknown): unknown; mockReset(): unknown }
  const rearmers: Array<() => void> = []
  function armed<F extends Armed>(fn: F, value: unknown): F {
    fn.mockResolvedValue(value)
    rearmers.push(() => {
      fn.mockReset()
      fn.mockResolvedValue(value)
    })
    return fn
  }
  const mockVerifyAccessToken = vi.fn()
  const mockSelectResult = armed(vi.fn(), [])
  const mockInsertResult = armed(vi.fn(), [])
  const mockUpdateResult = armed(vi.fn(), [])
  const mockDeleteResult = armed(vi.fn(), [])
  const sinks = {
    insert: { value: undefined as unknown },
    update: { value: undefined as unknown },
    delete: { value: undefined as unknown },
  }
  return {
    mockVerifyAccessToken,
    mockSelectResult,
    mockInsertResult,
    mockUpdateResult,
    mockDeleteResult,
    sinks,
    rearmDbMockDefaults: () => {
      rearmers.forEach((rearm) => rearm())
      sinks.insert.value = undefined
      sinks.update.value = undefined
      sinks.delete.value = undefined
    },
  }
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn().mockResolvedValue({}),
  refreshOne: vi.fn().mockResolvedValue(true),
}))
vi.mock('../src/services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))

vi.mock('../src/db/index.js', () => {
  function selectChain(): unknown {
    return new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === 'then')
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            mockSelectResult().then(resolve, reject)
        return () => selectChain()
      },
    })
  }
  function writeChain(sink: { value: unknown }, resultMock: () => Promise<unknown>): unknown {
    const make = (): unknown =>
      new Proxy({} as Record<string, unknown>, {
        get(_t, prop) {
          if (typeof prop !== 'string') return undefined
          if (prop === 'then')
            return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              resultMock().then(resolve, reject)
          if (prop === 'returning') return () => make()
          if (prop === 'values' || prop === 'set')
            return (v: unknown) => {
              sink.value = v
              return make()
            }
          return () => make()
        },
      })
    return make()
  }
  return {
    db: {
      select: () => selectChain(),
      insert: () => writeChain(sinks.insert, () => mockInsertResult()),
      update: () => writeChain(sinks.update, () => mockUpdateResult()),
      delete: () => writeChain(sinks.delete, () => mockDeleteResult()),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: () => selectChain() },
    dbClient: {},
  }
})

import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'
import { getRelayAdapter } from '../src/services/relay-upstream-adapters.js'
import { refreshOne } from '../src/services/relay-account-pool-scheduler.js'
import { encryptField } from '../src/utils/crypto.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'
const PROXY_ID = '00000000-0000-4000-8000-0000000000b1'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

function proxyRow(over: Record<string, unknown> = {}) {
  return {
    id: PROXY_ID,
    proxyUrl: 'http://user:pass@10.0.0.9:8080',
    providerCode: 'trae',
    status: 'active',
    failCount: 0,
    lastCheckedAt: null,
    boundAccountId: null,
    lastPickedAt: null,
    createdAt: new Date('2026-10-22T00:00:00Z'),
    updatedAt: new Date('2026-10-22T00:00:00Z'),
    ...over,
  }
}

describe('relay-admin-proxy-pool', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeEach(() => {
    rearmDbMockDefaults()
  })

  beforeAll(async () => {
    await server.register(relayAccountPoolRoutes, { prefix: '/api' })
    await server.ready()
  }, 60_000)

  afterAll(async () => {
    await server.close()
  })

  describe('GET /api/admin/relay/proxy-pool', () => {
    it('返回 list + total,proxyUrl 原样(管理员可见内嵌账密)', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([proxyRow()]).mockResolvedValueOnce([{ c: 1 }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/proxy-pool?page=1&pageSize=10&status=active',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(1)
      expect(body.data.list[0].proxyUrl).toBe('http://user:pass@10.0.0.9:8080')
      expect(body.data.page).toBe(1)
    })

    it('非管理员 403', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        userId: '00000000-0000-4000-8000-000000000002',
        roleId: 0,
      })
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/proxy-pool',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('POST /api/admin/relay/proxy-pool', () => {
    it('新增成功 → 201,写入 proxyUrl/providerCode/boundAccountId', async () => {
      mockAdmin()
      mockInsertResult.mockResolvedValueOnce([proxyRow()])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/proxy-pool',
        body: {
          proxyUrl: 'http://user:pass@10.0.0.9:8080',
          providerCode: 'trae',
          boundAccountId: '00000000-0000-4000-8000-0000000000c1',
        },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      const values = sinks.insert.value as Record<string, unknown>
      expect(values.proxyUrl).toBe('http://user:pass@10.0.0.9:8080')
      expect(values.providerCode).toBe('trae')
      expect(values.boundAccountId).toBe('00000000-0000-4000-8000-0000000000c1')
    })

    it('proxyUrl 唯一冲突(23505)→ 409', async () => {
      mockAdmin()
      mockInsertResult.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }))
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/proxy-pool',
        body: { proxyUrl: 'http://user:pass@10.0.0.9:8080' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(409)
    })

    it('非 http(s)/socks5 协议 → 400', async () => {
      mockAdmin()
      for (const url of ['ftp://10.0.0.1:21', 'not-a-url']) {
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/relay/proxy-pool',
          body: { proxyUrl: url },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(400)
      }
    })

    it('socks5 协议合法', async () => {
      mockAdmin()
      mockInsertResult.mockResolvedValueOnce([proxyRow({ proxyUrl: 'socks5://10.0.0.1:1080' })])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/proxy-pool',
        body: { proxyUrl: 'socks5://10.0.0.1:1080' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
    })
  })

  describe('PATCH /api/admin/relay/proxy-pool/:id', () => {
    it('更新 status/boundAccountId → 200', async () => {
      mockAdmin()
      // 预读现行须与被改字段不同,否则 updateProxy 的无变化短路会把 UPDATE 整条省掉
      mockSelectResult.mockResolvedValueOnce([proxyRow({ boundAccountId: 'acc-old' })])
      mockUpdateResult.mockResolvedValueOnce([proxyRow({ status: 'dead', boundAccountId: null })])
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}`,
        body: { status: 'dead', boundAccountId: null },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('dead')
      expect(set.boundAccountId).toBeNull()
      expect(set.updatedAt).toBeInstanceOf(Date)
    })

    it('0 行 → 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}`,
        body: { status: 'active' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(sinks.update.value).toBeUndefined()
    })

    it('空 body → 400(至少一个字段)', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}`,
        body: {},
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/admin/relay/proxy-pool/:id', () => {
    it('删除命中 → 200', async () => {
      mockAdmin()
      mockDeleteResult.mockResolvedValueOnce([{ id: PROXY_ID }])
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })

    it('0 行 → 404', async () => {
      mockAdmin()
      mockDeleteResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /api/admin/relay/proxy-pool/:id/check', () => {
    it('查行后标记 dead', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([proxyRow()])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}/check`,
        body: { alive: false },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.alive).toBe(false)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('dead')
    })

    it('代理不存在 → 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}/check`,
        body: { alive: true },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('缺 alive → 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/proxy-pool/${PROXY_ID}/check`,
        body: {},
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // 余额路由与代理池同属 relay-account-pool 路由文件;本文件是本仓唯一的 Fastify
  // inject 承载体,故在此锁它,不再复制第二套 DB 桩(§0.6 单一真相源)。
  describe('POST /api/admin/relay/accounts/:id/quota — 按需余额', () => {
    const ACC_ID = '00000000-0000-4000-8000-0000000000c1'
    const quotaUrl = `/api/admin/relay/accounts/${ACC_ID}/quota`

    it('账号不存在 → 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('适配器未注册 → 400 且点名平台', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: ACC_ID, providerCode: 'trae', proxyUrl: null }])
      vi.mocked(getRelayAdapter).mockReturnValueOnce(null)
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('未注册')
    })

    it('平台无已实证余额端点 → 400「未支持」(不解密凭证、不猜余额)', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([
        { id: ACC_ID, providerCode: 'workbuddy', proxyUrl: null },
      ])
      // 该桩刻意不带 getQuota,也不带 decrypt 需要的任何密文字段:
      // 命中"未支持"分支必须在取凭证之前,否则这里会因解不开 tokenEnc 而 500。
      vi.mocked(getRelayAdapter).mockReturnValueOnce({ providerCode: 'workbuddy' } as never)
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('未支持')
    })

    it('上游判鉴权失效 → 走调度器同一把刷新出口重试一次,第二次用的是新票', async () => {
      mockAdmin()
      const stale = {
        id: ACC_ID,
        providerCode: 'trae',
        proxyUrl: null,
        tokenEnc: encryptField('jwt-stale'),
        refreshTokenEnc: null,
        cookiesEnc: null,
        secretsEnc: null,
        // 刻意写成"未来才过期":库里这枚字段不可信,自愈必须由上游的 401 触发,不由时间戳触发
        tokenExpiresAt: new Date(Date.now() + 7200_000),
      }
      const fresh = { ...stale, tokenEnc: encryptField('jwt-fresh') }
      mockSelectResult.mockResolvedValueOnce([stale]).mockResolvedValueOnce([fresh])
      const seenTokens: string[] = []
      vi.mocked(getRelayAdapter).mockReturnValueOnce({
        providerCode: 'trae',
        refreshToken: vi.fn(),
        getQuota: vi.fn(async (ctx: { credentials: { token: string } }) => {
          seenTokens.push(ctx.credentials.token)
          return seenTokens.length === 1
            ? { ok: false, authFailed: true, error: 'web_user_ent_usage HTTP 401' }
            : { ok: true, quota: { remaining: 97.9 } }
        }),
      } as never)
      vi.mocked(refreshOne).mockClear().mockResolvedValueOnce(true)
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(refreshOne).toHaveBeenCalledTimes(1)
      expect(seenTokens).toEqual(['jwt-stale', 'jwt-fresh'])
      expect(res.json().data.attemptedRefresh).toBe(true)
      expect(res.json().data.ok).toBe(true)
    })

    it('首查即成功 → 一次都不刷新(正向对照:刷新不是无条件路过)', async () => {
      mockAdmin()
      const live = {
        id: ACC_ID,
        providerCode: 'qoder',
        proxyUrl: null,
        tokenEnc: encryptField('dt-live'),
        refreshTokenEnc: null,
        cookiesEnc: null,
        secretsEnc: null,
        tokenExpiresAt: new Date(Date.now() + 7200_000),
      }
      mockSelectResult.mockResolvedValueOnce([live])
      const seenTokens: string[] = []
      vi.mocked(getRelayAdapter).mockReturnValueOnce({
        providerCode: 'qoder',
        refreshToken: vi.fn(),
        getQuota: vi.fn(async (ctx: { credentials: { token: string } }) => {
          seenTokens.push(ctx.credentials.token)
          return { ok: true, quota: { remaining: 120 } }
        }),
      } as never)
      vi.mocked(refreshOne).mockClear()
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(refreshOne).not.toHaveBeenCalled()
      expect(seenTokens).toEqual(['dt-live'])
      expect(res.json().data.attemptedRefresh).toBe(false)
    })

    it('失败但不是鉴权(如上游 500)⇒ 不换票、只重试零次(防把任何失败都当票问题)', async () => {
      mockAdmin()
      const live = {
        id: ACC_ID,
        providerCode: 'qoder',
        proxyUrl: null,
        tokenEnc: encryptField('dt-live'),
        refreshTokenEnc: null,
        cookiesEnc: null,
        secretsEnc: null,
        tokenExpiresAt: null,
      }
      mockSelectResult.mockResolvedValueOnce([live])
      let calls = 0
      vi.mocked(getRelayAdapter).mockReturnValueOnce({
        providerCode: 'qoder',
        refreshToken: vi.fn(),
        getQuota: vi.fn(async () => {
          calls += 1
          return { ok: false, error: 'quota HTTP 500' }
        }),
      } as never)
      vi.mocked(refreshOne).mockClear()
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(calls).toBe(1)
      expect(refreshOne).not.toHaveBeenCalled()
      expect(res.json().data.attemptedRefresh).toBe(false)
      expect(res.json().data.ok).toBe(false)
    })

    it('非管理员身份 → 403(余额不出非管理面)', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: ACC_ID, providerCode: 'trae' }])
      mockVerifyAccessToken.mockResolvedValue({
        userId: '00000000-0000-4000-8000-000000000002',
        roleId: 0,
      })
      const res = await server.inject({
        method: 'POST',
        url: quotaUrl,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
