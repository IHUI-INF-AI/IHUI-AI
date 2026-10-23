// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反代号池 · 用量台账(2026-10-22 立):relay-account-usage 服务 + 管理面用量/巡检/认领端点。
// DB 走仓内 Proxy chainable mock 模式(夹具写法参考 tests/admin-missing-routes.test.ts),
// select 链每次 await 依序弹取 mockSelectResult 的 Once 队列(路由内查询顺序确定)。

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
  mockSweepAccountPool,
  sinks,
  limitArgs,
  offsetArgs,
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
  const mockUpdateResult = armed(vi.fn(), [{ id: 'acc-1' }])
  const mockDeleteResult = armed(vi.fn(), [{ id: 'mock-id' }])
  const mockSweepAccountPool = vi.fn().mockResolvedValue({
    refreshed: 1,
    refreshFailed: 0,
    refreshSkipped: 0,
    healthChecked: 2,
    healthRecovered: 0,
  })
  const sinks = {
    insert: { value: undefined as unknown },
    update: { value: undefined as unknown },
    delete: { value: undefined as unknown },
  }
  // 分页参数探针:limit/offset 是链式方法,记录实际下推值
  const limitArgs: number[] = []
  const offsetArgs: number[] = []
  return {
    mockVerifyAccessToken,
    mockSelectResult,
    mockInsertResult,
    mockUpdateResult,
    mockDeleteResult,
    mockSweepAccountPool,
    sinks,
    limitArgs,
    offsetArgs,
    rearmDbMockDefaults: () => {
      rearmers.forEach((rearm) => rearm())
      sinks.insert.value = undefined
      sinks.update.value = undefined
      sinks.delete.value = undefined
      limitArgs.length = 0
      offsetArgs.length = 0
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

// scheduler/适配器仅被路由 import(sweep/health 端点用),mock 掉避免真实巡检与适配器加载
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: mockSweepAccountPool,
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
        if (prop === 'limit')
          return (v: number) => {
            limitArgs.push(v)
            return selectChain()
          }
        if (prop === 'offset')
          return (v: number) => {
            offsetArgs.push(v)
            return selectChain()
          }
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
import {
  recordAccountUsage,
  getAccountUsageSummaries,
  getAccountUsage,
  purgeAccountUsage,
} from '../src/services/relay-account-usage.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: ADMIN_USER_ID,
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

function mockRegularUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
}

/** 账号池列表投影行(与 safeProjection 字段对齐) */
function poolRow(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1',
    providerCode: 'trae',
    uid: 'u-1',
    name: 'Trae 主账号 #1',
    deviceId: null,
    machineId: null,
    tokenExpiresAt: null,
    refreshExpiresAt: null,
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'healthy',
    healthCheckedAt: null,
    lastErrorMessage: null,
    lastUsedAt: null,
    lastRefreshAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    hasProxy: false,
    totalCalls: 10,
    claimStatus: 'unclaimed',
    claimedBy: null,
    claimedAt: null,
    claimNote: null,
    extraMetadata: {},
    createdAt: new Date('2026-10-22T00:00:00Z'),
    updatedAt: new Date('2026-10-22T00:00:00Z'),
    ...over,
  }
}

describe('relay-usage-ledger', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeEach(() => {
    rearmDbMockDefaults()
    mockSweepAccountPool.mockClear()
  })

  beforeAll(async () => {
    await server.register(relayAccountPoolRoutes, { prefix: '/api' })
    await server.ready()
  }, 60_000)

  afterAll(async () => {
    await server.close()
  })

  // ===========================================================================
  // 1. 服务层:recordAccountUsage(fire-and-forget,永不抛)
  // ===========================================================================
  describe('recordAccountUsage', () => {
    it('正常写入台账行(字段透传 + ts 缺省补当前时刻)', async () => {
      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'trae',
        model: 'kimi-k2',
        promptTokens: 100,
        completionTokens: 50,
        ok: true,
        latencyMs: 1234,
      })
      const values = sinks.insert.value as Record<string, unknown>
      expect(values.accountId).toBe('acc-1')
      expect(values.providerCode).toBe('trae')
      expect(values.model).toBe('kimi-k2')
      expect(values.promptTokens).toBe(100)
      expect(values.completionTokens).toBe(50)
      expect(values.ok).toBe(true)
      expect(values.latencyMs).toBe(1234)
      expect(values.ts).toBeInstanceOf(Date)
    })

    it('latencyMs 落库前归一为整数(小数/NaN/负数都不会打挂 integer 列)', async () => {
      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'workbuddy',
        model: 'hy3',
        promptTokens: 17,
        completionTokens: 34,
        ok: true,
        latencyMs: 761.6792,
      })
      expect((sinks.insert.value as Record<string, unknown>).latencyMs).toBe(762)

      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'workbuddy',
        model: 'hy3',
        promptTokens: 1,
        completionTokens: 1,
        ok: true,
        latencyMs: Number.NaN,
      })
      expect((sinks.insert.value as Record<string, unknown>).latencyMs).toBe(0)

      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'workbuddy',
        model: 'hy3',
        promptTokens: 1,
        completionTokens: 1,
        ok: true,
        latencyMs: -5,
      })
      expect((sinks.insert.value as Record<string, unknown>).latencyMs).toBe(0)
    })

    it('显式 ts 原样使用', async () => {
      const ts = new Date('2026-10-22T08:00:00Z')
      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'trae',
        model: 'm',
        promptTokens: 1,
        completionTokens: 1,
        ok: false,
        latencyMs: 0,
        ts,
      })
      expect((sinks.insert.value as Record<string, unknown>).ts).toBe(ts)
    })

    it('reasoning/cached 透传落库,缺省补 0', async () => {
      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'trae',
        model: 'doubao-seed-code',
        promptTokens: 100,
        completionTokens: 50,
        reasoningTokens: 20,
        cachedTokens: 80,
        ok: true,
        latencyMs: 10,
      })
      const v = sinks.insert.value as Record<string, unknown>
      expect(v.reasoningTokens).toBe(20)
      expect(v.cachedTokens).toBe(80)

      await recordAccountUsage({
        accountId: 'acc-1',
        providerCode: 'workbuddy',
        model: 'hy3',
        promptTokens: 1,
        completionTokens: 1,
        ok: true,
        latencyMs: 0,
      })
      const v2 = sinks.insert.value as Record<string, unknown>
      expect(v2.reasoningTokens).toBe(0)
      expect(v2.cachedTokens).toBe(0)
    })

    it('DB 写入异常被吞掉,只记 warn,永不抛', async () => {
      mockInsertResult.mockRejectedValueOnce(new Error('db down'))
      await expect(
        recordAccountUsage({
          accountId: 'acc-1',
          providerCode: 'trae',
          model: 'm',
          promptTokens: 1,
          completionTokens: 1,
          ok: true,
          latencyMs: 1,
        }),
      ).resolves.toBeUndefined()
    })
  })

  // ===========================================================================
  // 2. 服务层:24h 聚合与明细
  // ===========================================================================
  describe('getAccountUsageSummaries / getAccountUsage', () => {
    it('空 id 列表不发起查询', async () => {
      const map = await getAccountUsageSummaries([])
      expect(map.size).toBe(0)
      expect(mockSelectResult).not.toHaveBeenCalled()
    })

    it('聚合行映射为 calls/tokens/failRate', async () => {
      mockSelectResult.mockResolvedValueOnce([
        { accountId: 'a1', calls: 12, tokens: 3456, fails: 3 },
      ])
      const map = await getAccountUsageSummaries(['a1'])
      expect(map.get('a1')).toEqual({ calls24h: 12, tokens24h: 3456, failRate24h: 0.25 })
    })

    it('聚合查询异常降级为空 Map,永不抛', async () => {
      mockSelectResult.mockRejectedValueOnce(new Error('db down'))
      const map = await getAccountUsageSummaries(['a1'])
      expect(map.size).toBe(0)
    })

    it('getAccountUsage 返回 24h 汇总 + days 窗口明细', async () => {
      mockSelectResult.mockResolvedValueOnce([{ accountId: 'a1', calls: 2, tokens: 100, fails: 1 }])
      mockSelectResult.mockResolvedValueOnce([
        { id: 'l1', accountId: 'a1', model: 'kimi-k2', ok: false, ts: new Date() },
      ])
      const result = await getAccountUsage('a1', 7)
      expect(result.days).toBe(7)
      expect(result.summary).toEqual({ calls24h: 2, tokens24h: 100, failRate24h: 0.5 })
      expect(result.detail).toHaveLength(1)
    })

    it('默认分页 limit=500/offset=0,detailTotal 取明细总数', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([{ id: 'l1', accountId: 'a1' }])
      mockSelectResult.mockResolvedValueOnce([{ c: 42 }])
      const result = await getAccountUsage('a1')
      expect(limitArgs.at(-1)).toBe(500)
      expect(offsetArgs.at(-1)).toBe(0)
      expect(result.detailTotal).toBe(42)
    })

    it('传入 limit/offset 透传下推,limit 超上限 clamp 到 1000', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }])
      await getAccountUsage('a1', 7, { limit: 5000, offset: 20 })
      expect(limitArgs.at(-1)).toBe(1000)
      expect(offsetArgs.at(-1)).toBe(20)
    })
  })

  // ===========================================================================
  // 2b. 服务层:台账保留期清理(purgeAccountUsage)
  // ===========================================================================
  describe('purgeAccountUsage', () => {
    it('按 beforeDays 截止删除并返回删除行数', async () => {
      mockDeleteResult.mockResolvedValueOnce([{ id: 'l1' }, { id: 'l2' }])
      await expect(purgeAccountUsage()).resolves.toBe(2)
    })

    it('删除异常被吞,返回 0 且永不抛', async () => {
      mockDeleteResult.mockRejectedValueOnce(new Error('db down'))
      await expect(purgeAccountUsage(30)).resolves.toBe(0)
    })
  })

  // ===========================================================================
  // 3. 管理面:GET /admin/relay/accounts(list 富化 usageSummary/claim/poolHealth)
  // ===========================================================================
  describe('GET /api/admin/relay/accounts — list 富化', () => {
    // 查询顺序:list → total → expired → available → 用量聚合
    it('每项带 usageSummary/expiresSoon/认领列,响应带 poolHealth', async () => {
      mockAdmin()
      const soon = new Date(Date.now() + 5 * 60 * 1000)
      mockSelectResult.mockResolvedValueOnce([poolRow({ tokenExpiresAt: soon })])
      mockSelectResult.mockResolvedValueOnce([{ c: 1 }])
      mockSelectResult.mockResolvedValueOnce([{ c: 2 }])
      mockSelectResult.mockResolvedValueOnce([{ c: 1 }])
      mockSelectResult.mockResolvedValueOnce([
        { accountId: 'acc-1', calls: 12, tokens: 3456, fails: 3 },
      ])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/accounts',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      const item = body.data.list[0]
      expect(item.usageSummary).toEqual({ calls24h: 12, tokens24h: 3456, failRate24h: 0.25 })
      expect(item.expiresSoon).toBe(true)
      expect(item.circuitBreakReason).toBeNull()
      expect(item.claimStatus).toBe('unclaimed')
      expect(body.data.poolHealth).toEqual({
        expiredCount: 2,
        availableCount: 1,
        needRefill: true,
      })
    })

    it('circuitBreakReason 推导:刷新熔断摘除与转发熔断冷却', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([
        poolRow({
          id: 'acc-break-1',
          tempUnschedulable: true,
          refreshFailureCount: 3,
          healthStatus: 'down',
        }),
        poolRow({ id: 'acc-break-2', consecutiveFailures: 6 }),
      ])
      mockSelectResult.mockResolvedValueOnce([{ c: 2 }])
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }])
      mockSelectResult.mockResolvedValueOnce([{ c: 2 }])
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/accounts',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.list[0].circuitBreakReason).toBe('连续 3 次 token 刷新失败,已自动摘除')
      expect(body.data.list[1].circuitBreakReason).toBe('连续 6 次转发失败,熔断冷却中')
      expect(body.data.list[0].expiresSoon).toBe(false)
      expect(body.data.list[0].usageSummary).toEqual({
        calls24h: 0,
        tokens24h: 0,
        failRate24h: 0,
      })
      expect(body.data.poolHealth.needRefill).toBe(false)
    })

    it('未登录 401 / 非管理员 403', async () => {
      const anon = await server.inject({ method: 'GET', url: '/api/admin/relay/accounts' })
      expect(anon.statusCode).toBe(401)
      mockRegularUser()
      const forbidden = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/accounts',
        headers: { authorization: USER_TOKEN },
      })
      expect(forbidden.statusCode).toBe(403)
    })
  })

  // ===========================================================================
  // 4. 管理面:POST /admin/relay/account-pool/sweep
  // ===========================================================================
  describe('POST /api/admin/relay/account-pool/sweep', () => {
    it('admin 触发巡检,透传 scheduler 结果', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/account-pool/sweep',
        body: { ids: ['acc-1'] },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.refreshed).toBe(1)
      expect(body.data.healthChecked).toBe(2)
      expect(mockSweepAccountPool).toHaveBeenCalledTimes(1)
    })

    it('空 body 也合法(ids 可缺省)', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/account-pool/sweep',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('ids 非数组 → 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/account-pool/sweep',
        body: { ids: 'not-an-array' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非管理员 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/account-pool/sweep',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // ===========================================================================
  // 5. 管理面:GET /admin/relay/account-pool/usage/:id?days=7
  // ===========================================================================
  describe('GET /api/admin/relay/account-pool/usage/:id', () => {
    it('默认 days=7,返回 summary + detail + detailTotal', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([
        { accountId: 'acc-1', calls: 2, tokens: 100, fails: 1 },
      ])
      mockSelectResult.mockResolvedValueOnce([{ id: 'l1', accountId: 'acc-1', ok: true }])
      mockSelectResult.mockResolvedValueOnce([{ c: 1 }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/account-pool/usage/acc-1',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accountId).toBe('acc-1')
      expect(body.data.days).toBe(7)
      expect(body.data.summary.calls24h).toBe(2)
      expect(body.data.detail).toHaveLength(1)
      expect(body.data.detailTotal).toBe(1)
      expect(limitArgs.at(-1)).toBe(500)
      expect(offsetArgs.at(-1)).toBe(0)
    })

    it('limit=9999 被 clamp 到 1000(不 400);offset 透传', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/account-pool/usage/acc-1?limit=9999&offset=100',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(limitArgs.at(-1)).toBe(1000)
      expect(offsetArgs.at(-1)).toBe(100)
    })

    it('limit=0 / offset=-1 越界 → 400', async () => {
      mockAdmin()
      for (const qs of ['limit=0', 'offset=-1']) {
        const res = await server.inject({
          method: 'GET',
          url: `/api/admin/relay/account-pool/usage/acc-1?${qs}`,
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(400)
      }
    })

    it('days=30 透传窗口', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/account-pool/usage/acc-1?days=30',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.days).toBe(30)
    })

    it('days=0 越界 → 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/account-pool/usage/acc-1?days=0',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('未登录 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/account-pool/usage/acc-1',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ===========================================================================
  // 6. 管理面:认领工作流 claim / release
  // ===========================================================================
  describe('POST /api/admin/relay/accounts/:id/claim 与 /release', () => {
    const claimId = '00000000-0000-4000-8000-0000000000a1'

    it('认领成功:单条条件 UPDATE 写认领列,认领人取 JWT 主体', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([
        {
          id: claimId,
          claimStatus: 'claimed',
          claimedBy: ADMIN_USER_ID,
          claimedAt: new Date(),
          claimNote: '我来维护',
        },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/claim`,
        body: { note: '我来维护' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.claimStatus).toBe('claimed')
      expect(body.data.claimedBy).toBe(ADMIN_USER_ID)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.claimStatus).toBe('claimed')
      expect(set.claimedBy).toBe(ADMIN_USER_ID)
      expect(set.claimNote).toBe('我来维护')
      // 原子化后不再先读后写:认领路径不应有前置 SELECT
      expect(mockSelectResult).not.toHaveBeenCalled()
    })

    it('原子 UPDATE 0 行 + 行存在且被他人持有 → 409', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([{ claimedBy: 'other-admin' }])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/claim`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(409)
    })

    it('原子 UPDATE 0 行 + 行不存在 → 404', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/claim`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('JWT 无 userId → 400(绝不写 claimedBy=null)', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: undefined, roleId: 1 })
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/claim`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(sinks.update.value).toBeUndefined()
    })

    it('释放认领(本人):清空认领列', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([
        {
          id: claimId,
          claimStatus: 'unclaimed',
          claimedBy: null,
          claimedAt: null,
          claimNote: null,
        },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/release`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.claimStatus).toBe('unclaimed')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.claimStatus).toBe('unclaimed')
      expect(set.claimedBy).toBeNull()
      expect(set.claimedAt).toBeNull()
      expect(set.claimNote).toBeNull()
    })

    it('释放非本人认领 → 409(条件 UPDATE 0 行)', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([])
      mockSelectResult.mockResolvedValueOnce([{ claimedBy: 'other-admin' }])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/release`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(409)
    })

    it('force=true 允许强放并留 warn 记录', async () => {
      mockAdmin()
      mockUpdateResult.mockResolvedValueOnce([
        {
          id: claimId,
          claimStatus: 'unclaimed',
          claimedBy: null,
          claimedAt: null,
          claimNote: null,
        },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/release`,
        body: { force: true },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.claimStatus).toBe('unclaimed')
    })

    it('释放时 JWT 无 userId → 400', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: '', roleId: 1 })
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/release`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('未登录 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${claimId}/claim`,
        body: {},
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
