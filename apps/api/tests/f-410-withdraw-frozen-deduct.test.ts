// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-410 回归锁(2026-11-13,缺陷票 docs/tickets/2026-11/findings-api.md#F-410)。
 *
 * 病灶:POST /developer/withdrawals 只把金额加进 frozenQuantity,可用 tokenQuantity 不变;
 * 而 relay 计费/钱包充值路径只认 tokenQuantity ⇒ 同一笔 token 可一边提现打款、一边继续消费。
 *
 * 口径(与 applyWithdrawal F-406 一致):申请即从可用余额扣除并等额转入冻结,
 * 可用余额 = tokenQuantity(冻结额已不在其中);驳回退回,成功确认只清冻结不重复扣。
 *
 * 本文件用状态化假事务驱动真实路由/真实服务(不连 PG):
 *   ① 申请:tokenQuantity -= amount、frozenQuantity += amount,流水 balanceAfter = 扣后余额;
 *   ② 余额不足:400,零写库(冻结额不可再被申请);
 *   ③ 驳回:tokenQuantity += amount、frozenQuantity -= amount,只退一次;
 *   ④ 成功确认:只清 frozenQuantity,tokenQuantity 不再二次扣减;
 *   ⑤ relay 钱包充值:可用额度 = tokenQuantity(已扣冻结),frozenQuantity 不可消费。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const H = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  adminId: '22222222-2222-4222-8222-222222222222',
  apiKeyId: '33333333-3333-4333-8333-333333333333',
  margin: { tokenQuantity: 0, frozenQuantity: 0 },
  flow: null as null | { id: string; userId: string | null; amount: number; status: number },
  apiKey: { id: '33333333-3333-4333-8333-333333333333', tokenBalance: 0, costBalanceCents: 0 },
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
}))

vi.mock('../src/config/index.js', () => ({
  isDevelopmentRuntime: false,
  isProductionRuntime: false,
  isTestRuntime: true,
  config: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = H.userId
  }),
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = H.adminId
  }),
  requireAdminRouteGuard: vi.fn(),
  ADMIN_ROLE_ID: 1,
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn(async () => ({ ok: true, enforced: false })),
}))

vi.mock('../src/db/payment-queries.js', () => ({ createOrder: vi.fn() }))
vi.mock('../src/db/developer-queries.js', () => ({
  findDeveloperInfo: vi.fn(),
  findDeveloperPricingById: vi.fn(),
  activateDeveloperSubscription: vi.fn(),
  getMyDeveloperSubscription: vi.fn(),
}))
vi.mock('../src/db/social-queries.js', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  isFollowing: vi.fn(),
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { notifications: 'notifications', preferences: 'preferences' },
  findUserPreferences: vi.fn(async () => ({ list: [] })),
  upsertUserPreference: vi.fn(),
  deleteUserPreference: vi.fn(),
}))
vi.mock('../src/services/developer-api-keys-service.js', () => ({
  listKeys: vi.fn(async () => []),
  createKey: vi.fn(),
  deleteKey: vi.fn(),
  updateKey: vi.fn(),
  getUsage: vi.fn(),
}))
vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
}))

// relay-billing-service 的重依赖(本文件只用其钱包充值纯链路)
vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn(async () => null),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn(async () => undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn(async () => undefined),
}))
vi.mock('../src/services/tiered-pricing-service.js', () => ({
  getCurrentTierMultiplier: vi.fn(async () => ({ multiplier: 1 })),
}))
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn(async () => ({ multiplier: 1, ruleId: null, ruleName: null })),
}))
vi.mock('../src/services/subscription-window-service.js', () => ({
  checkSubscriptionWindowQuota: vi.fn(async () => ({ allowed: true })),
  consumeSubscriptionWindowUsage: vi.fn(async () => false),
}))
vi.mock('../src/services/key-rate-window-service.js', () => ({
  checkKeyRateWindows: vi.fn(async () => ({ allowed: true })),
  incrKeyRateWindows: vi.fn(async () => undefined),
}))
vi.mock('../src/services/mail-relay-notifier.js', () => ({
  checkAndNotifyLowBalance: vi.fn(async () => false),
  sendLowBalanceMail: vi.fn(async () => false),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserModelMultiplier: vi.fn(async () => 1),
}))
vi.mock('../src/services/api-key-share-service.js', () => ({
  incrementUsage: vi.fn(async () => undefined),
}))

/**
 * 状态化假 DB:按 drizzle 表名分派 select/update/insert,
 * 把 SQL 表达式里的增减量应用到内存账本,模拟 user_margins / withdrawal_flows 语义。
 */
vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const tableName = (table: unknown): string =>
    (table as Record<symbol, string> | undefined)?.[Symbol.for('drizzle:Name')] ?? ''

  function numbersIn(node: unknown): number[] {
    const compiled = dialect.sqlToQuery(node as Parameters<PgDialect['sqlToQuery']>[0])
    return compiled.params.filter((p): p is number => typeof p === 'number')
  }

  /** 把 `列 + ${n}` / `列 - ${n}` 应用到当前值 */
  function applyExpr(expr: unknown, current: number): number {
    if (typeof expr === 'number') return expr
    if (!expr || typeof expr !== 'object') return current
    const compiled = dialect.sqlToQuery(expr as Parameters<PgDialect['sqlToQuery']>[0])
    const nums = compiled.params.filter((p): p is number => typeof p === 'number')
    const amount = nums.length > 0 ? nums[nums.length - 1]! : 0
    if (/\+\s*\$\d+/.test(compiled.sql)) return current + amount
    if (/-\s*\$\d+/.test(compiled.sql)) return current - amount
    return current
  }

  function selectRows(table: string): unknown[] {
    if (table === 'user_margins') return [{ userId: H.userId, ...H.margin }]
    if (table === 'withdrawal_flows') return H.flow ? [{ ...H.flow }] : []
    if (table === 'developer_api_keys') return [{ ...H.apiKey }]
    return []
  }

  function tableQuery(table: string) {
    const settle = {
      for: () => settle,
      limit: async () => selectRows(table),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(selectRows(table)).then(resolve, reject),
    }
    return {
      where: () => settle,
      for: () => settle,
      limit: async () => selectRows(table),
      then: settle.then,
    }
  }

  function applyUpdate(
    table: string,
    values: Record<string, unknown>,
    condition: unknown,
  ): unknown[] {
    if (table === 'user_margins') {
      const guard = numbersIn(condition)
      const threshold = guard.length > 0 ? Math.max(...guard) : 0
      const nextToken =
        values.tokenQuantity === undefined
          ? H.margin.tokenQuantity
          : applyExpr(values.tokenQuantity, H.margin.tokenQuantity)
      const nextFrozen =
        values.frozenQuantity === undefined
          ? H.margin.frozenQuantity
          : applyExpr(values.frozenQuantity, H.margin.frozenQuantity)
      // DB 级 WHERE:扣减维度必须仍有足额余额,否则 0 行(防超发)
      if (nextToken < H.margin.tokenQuantity && H.margin.tokenQuantity < threshold) return []
      if (nextFrozen < H.margin.frozenQuantity && H.margin.frozenQuantity < threshold) return []
      H.margin.tokenQuantity = nextToken
      H.margin.frozenQuantity = nextFrozen
      return [{ userId: H.userId, ...H.margin }]
    }
    if (table === 'withdrawal_flows') {
      if (!H.flow) return []
      const guard = numbersIn(condition)
      if (guard.length > 0 && !guard.includes(H.flow.status)) return []
      H.flow.status = Number(values.status)
      return [{ ...H.flow }]
    }
    if (table === 'developer_api_keys') {
      const next = { ...H.apiKey }
      if (typeof values.tokenBalance === 'number') next.tokenBalance = values.tokenBalance
      if (typeof values.costBalanceCents === 'number')
        next.costBalanceCents = values.costBalanceCents
      H.apiKey = next
      return [{ ...next }]
    }
    return []
  }

  const db = {
    select: () => ({ from: (table: unknown) => tableQuery(tableName(table)) }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          const rows = applyUpdate(tableName(table), values, condition)
          const pending = Promise.resolve(rows) as Promise<unknown[]> & {
            returning: () => Promise<unknown[]>
          }
          pending.returning = async () => rows
          return pending
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const row = { id: `row-${H.inserts.length + 1}`, ...values }
        H.inserts.push({ table: tableName(table), values })
        const pending = Promise.resolve([row]) as Promise<unknown[]> & {
          returning: () => Promise<unknown[]>
        }
        pending.returning = async () => [row]
        return pending
      },
    }),
    delete: () => ({ where: async () => [] }),
    execute: async () => [],
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db, dbRead: db, dbClient: {} }
})

import developerRoutes from '../src/routes/developer.js'
import { financeExtendedRoutes } from '../src/routes/finance-extended.js'
import { rechargeApiKeyFromWallet } from '../src/services/relay-billing-service.js'

describe('F-410 提现冻结必须从可用余额扣除(申请/驳回/成功/relay 全链路)', () => {
  let devApp: FastifyInstance
  let adminApp: FastifyInstance

  beforeAll(async () => {
    devApp = Fastify({ logger: false })
    await devApp.register(developerRoutes, { prefix: '/api/developer' })
    await devApp.ready()

    adminApp = Fastify({ logger: false })
    await adminApp.register(financeExtendedRoutes, { prefix: '/api' })
    await adminApp.ready()
  })

  afterAll(async () => {
    await devApp.close()
    await adminApp.close()
  })

  beforeEach(() => {
    H.margin = { tokenQuantity: 0, frozenQuantity: 0 }
    H.flow = null
    H.apiKey = { id: H.apiKeyId, tokenBalance: 0, costBalanceCents: 0 }
    H.inserts.length = 0
  })

  const withdraw = (amount: number) =>
    devApp.inject({ method: 'POST', url: '/api/developer/withdrawals', payload: { amount } })

  it('① 申请:可用余额立即减少,等额转入冻结,流水 balanceAfter = 扣后余额', async () => {
    H.margin = { tokenQuantity: 1000, frozenQuantity: 0 }

    const res = await withdraw(300)
    expect(res.statusCode).toBe(201)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })

    const flow = H.inserts.find((i) => i.table === 'token_flows')
    expect(flow?.values.quantity).toBe(-300)
    expect(flow?.values.balanceAfter).toBe(700)
  })

  it('② 冻结额不可再用:仅剩 700 可用时申请 800 → 400 且零写库', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }

    const res = await withdraw(800)
    expect(res.statusCode).toBe(400)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })
    expect(H.inserts).toHaveLength(0)
  })

  it('③ 驳回:按申请额退回到可用余额并释放冻结(只退一次)', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }
    H.flow = { id: 'w-1', userId: H.userId, amount: 300, status: 0 }

    const res = await adminApp.inject({
      method: 'POST',
      url: '/api/admin/finance/fund/audit/w-1',
      payload: { action: 'reject' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.margin).toEqual({ tokenQuantity: 1000, frozenQuantity: 0 })
    expect(H.flow.status).toBe(3)
  })

  it('④ 成功确认:只清冻结,tokenQuantity 不再二次扣减', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }
    H.flow = { id: 'w-1', userId: H.userId, amount: 300, status: 1 }

    const res = await adminApp.inject({
      method: 'POST',
      url: '/api/admin/finance/fund/audit/w-1',
      payload: { action: 'approve' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 0 })
    expect(H.flow.status).toBe(2)
  })

  it('⑤ relay 钱包充值:可用额度 = tokenQuantity(冻结不可消费)', async () => {
    // 真实申请链路后:可用 700、冻结 300 —— 冻结额必须不可被 relay/充值路径花掉
    H.margin = { tokenQuantity: 1000, frozenQuantity: 0 }
    expect((await withdraw(300)).statusCode).toBe(201)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })

    // 800 > 可用 700:即使总资产(700+300)够,也必须拒绝
    await expect(rechargeApiKeyFromWallet(H.userId, H.apiKeyId, 800, 0)).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })

    // 只有可用余额可消费,冻结额原样保留
    const result = await rechargeApiKeyFromWallet(H.userId, H.apiKeyId, 100, 0)
    expect(result).toEqual({ tokenBalance: 100, costBalanceCents: 0 })
    expect(H.margin).toEqual({ tokenQuantity: 600, frozenQuantity: 300 })
  })
})
