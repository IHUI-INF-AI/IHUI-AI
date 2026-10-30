// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G4 计费弹性回归测试(2026-10-30 立)。
 *
 * 覆盖面:
 * 1. pricing-engine 纯函数核:档位系数 × 错峰系数组合正确性,含跨日窗口
 *    23:00-07:00 的四点边界(22:59 不中 / 23:00 中 / 06:59 中 / 07:00 不中,
 *    [start,end) 左闭右开)、多窗口命中取最低、非法 tz 回退 Asia/Shanghai;
 * 2. resolvePrice 注入 loadRules:精确 > '*' 兜底、无规则 → null、库异常 → null;
 * 3. AICostTracker 结算改造:开关关 = 逐字节旧行为;开 + 命中 = 组合价 + 明细;
 *    开 + 未命中/解析异常 = 回退旧 calculateCostCents 路径;
 * 4. pricing-rules 路由:用户面 GET 登录可见(未登录 401)、管理面 CRUD 鉴权
 *    (requireAdminRouteGuard 403)、POST 唯一冲突 409、PUT/DELETE version 递增、
 *    DELETE 软下线、不存在 404。
 *
 * Mock 策略(照 devices-g1.test.ts 基建):vi.mock ../src/db/index.js 为最小内存假库
 * (链式 select/insert/update 均按本用例可控形态返回);auth 用 x-test-user 头注入;
 * require-permission 用 x-test-admin 头模拟 admin 守卫。测试文件豁免 any。
 */
 
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// =============================================================================
// 内存假库 + auth / admin 守卫 mock(必须先于被测模块 import)
// =============================================================================

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    /** pricing_rules 行仓库(路由用例直接摆状态) */
    rules: [] as any[],
    /** true ⇒ insert 抛 PG 23505 唯一冲突 */
    throwUnique: false,
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockStore.rules.slice()),
        orderBy: () => Promise.resolve(mockStore.rules.slice()),
      }),
    }),
    insert: () => ({
      values: (v: any) => ({
        returning: async () => {
          if (mockStore.throwUnique) {
            const e: any = new Error('duplicate key value violates unique constraint')
            e.code = '23505'
            throw e
          }
          const row = {
            id: `rule-${Math.random().toString(36).slice(2, 10)}`,
            enabled: true,
            version: 1,
            currency: 'CNY',
            tierMultipliers: {},
            timeOfDayFactor: null,
            effectiveTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...v,
          }
          mockStore.rules.push(row)
          return [row]
        },
      }),
    }),
    update: () => ({
      set: (s: any) => ({
        where: () => ({
          returning: async () => {
            const row = mockStore.rules[0]
            if (!row) return []
            Object.assign(row, s)
            return [row]
          },
        }),
      }),
    }),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    const uid = request.headers?.['x-test-user']
    if (!uid) {
      const e: any = new Error('Authentication required')
      e.statusCode = 401
      throw e
    }
    request.userId = uid
    return { userId: uid }
  }),
  requireActiveUser: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdminRouteGuard: vi.fn(async (request: any, reply: any) => {
    if (!request.headers?.['x-test-admin']) {
      return reply.status(403).send({ code: 403, message: '需要管理员权限' })
    }
  }),
}))

// =============================================================================
// 被测模块
// =============================================================================

import {
  applyRule,
  isInTimeWindow,
  localMinuteOfDay,
  parseWindowKey,
  pickRule,
  resolvePrice,
  resolveTimeOfDayFactor,
} from '../src/services/pricing-engine.js'
import { AICostTracker } from '../src/services/ai-cost-tracker.js'
import { pricingRulesRoutes } from '../src/routes/pricing-rules.js'

// =============================================================================
// 夹具
// =============================================================================

/** Asia/Shanghai = UTC+8 固定偏移(无夏令时),四个错峰锚点 */
const T_2259 = new Date('2026-10-30T14:59:00Z') // 当地 22:59,窗口外
const T_2300 = new Date('2026-10-30T15:00:00Z') // 当地 23:00,窗口起点(左闭,命中)
const T_0659 = new Date('2026-10-30T22:59:00Z') // 当地 06:59,窗口内(命中)
const T_0700 = new Date('2026-10-30T23:00:00Z') // 当地 07:00,窗口终点(右开,不命中)
const T_NOON = new Date('2026-10-30T04:00:00Z') // 当地 12:00,任意窗口外

function makeRule(over: Partial<any> = {}): any {
  return {
    id: 'rule-gpt4o',
    ruleKey: 'gpt-4o',
    displayName: 'GPT-4o 组合价',
    currency: 'CNY',
    mode: 'token',
    basePrice: 5,
    tierMultipliers: { member: 1, vip: 0.8, svip: 0.6 },
    timeOfDayFactor: null,
    enabled: true,
    version: 3,
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: null,
    ...over,
  }
}

const OFF_PEAK = { '23:00-07:00': { factor: 0.5, tz: 'Asia/Shanghai' } }

// =============================================================================
// 1. pricing-engine 纯函数核
// =============================================================================

describe('pricing-engine 纯函数核', () => {
  it('parseWindowKey:合法窗口 → 分钟对;非法形态 → null', () => {
    expect(parseWindowKey('23:00-07:00')).toEqual([1380, 420])
    expect(parseWindowKey(' 09:30-18:00 ')).toEqual([570, 1080])
    expect(parseWindowKey('25:00-07:00')).toBeNull()
    expect(parseWindowKey('7:00-8:00')).toBeNull()
    expect(parseWindowKey('09:30~18:00')).toBeNull()
  })

  it('isInTimeWindow:[start,end) 左闭右开;跨日窗口 start>end 正确环绕', () => {
    // 常规窗口 09:00-11:00
    expect(isInTimeWindow(540, 660, 539)).toBe(false)
    expect(isInTimeWindow(540, 660, 540)).toBe(true)
    expect(isInTimeWindow(540, 660, 659)).toBe(true)
    expect(isInTimeWindow(540, 660, 660)).toBe(false)
    // 跨日窗口 23:00-07:00
    expect(isInTimeWindow(1380, 420, 1379)).toBe(false)
    expect(isInTimeWindow(1380, 420, 1380)).toBe(true)
    expect(isInTimeWindow(1380, 420, 419)).toBe(true)
    expect(isInTimeWindow(1380, 420, 420)).toBe(false)
    // start === end 视为空窗口
    expect(isInTimeWindow(420, 420, 420)).toBe(false)
  })

  it('localMinuteOfDay:UTC 时刻按规则 tz 折算当地时分', () => {
    expect(localMinuteOfDay(T_2300, 'Asia/Shanghai')).toBe(1380)
    expect(localMinuteOfDay(T_2259, 'Asia/Shanghai')).toBe(1379)
    expect(localMinuteOfDay(T_0659, 'Asia/Shanghai')).toBe(419)
    expect(localMinuteOfDay(T_0700, 'Asia/Shanghai')).toBe(420)
  })

  it('错峰跨日窗口 23:00-07:00 四点边界:22:59 不中 / 23:00 中 / 06:59 中 / 07:00 不中', () => {
    expect(resolveTimeOfDayFactor(OFF_PEAK, T_2259)).toEqual({ factor: 1.0, window: null })
    expect(resolveTimeOfDayFactor(OFF_PEAK, T_2300)).toEqual({ factor: 0.5, window: '23:00-07:00' })
    expect(resolveTimeOfDayFactor(OFF_PEAK, T_0659)).toEqual({ factor: 0.5, window: '23:00-07:00' })
    expect(resolveTimeOfDayFactor(OFF_PEAK, T_0700)).toEqual({ factor: 1.0, window: null })
  })

  it('resolveTimeOfDayFactor:空配置=1.0;多窗口重叠命中取最低系数', () => {
    expect(resolveTimeOfDayFactor(null, T_2300)).toEqual({ factor: 1.0, window: null })
    const overlap = {
      '22:00-08:00': { factor: 0.7, tz: 'Asia/Shanghai' },
      '23:00-07:00': { factor: 0.5, tz: 'Asia/Shanghai' },
    }
    expect(resolveTimeOfDayFactor(overlap, T_2300)).toEqual({ factor: 0.5, window: '23:00-07:00' })
  })

  it('resolveTimeOfDayFactor:非法 tz 回退 Asia/Shanghai(不炸结算)', () => {
    const badTz = { '23:00-07:00': { factor: 0.5, tz: 'Not/AZone' } }
    expect(resolveTimeOfDayFactor(badTz, T_2300).factor).toBe(0.5)
  })

  it('applyRule:档位 × 错峰组合单价 = basePrice × tierFactor × todFactor(6 位小数)', () => {
    const r = makeRule({ timeOfDayFactor: OFF_PEAK })
    // vip 0.8 × 错峰 0.5 × 基础 5 = 2
    expect(applyRule(r, { tier: 'vip', timestamp: T_2300 }).unitPrice).toBe(2)
    // svip 0.6 × 非错峰 1.0 × 5 = 3
    expect(applyRule(r, { tier: 'svip', timestamp: T_NOON }).unitPrice).toBe(3)
    // 未知档位 → 系数 1.0
    expect(applyRule(r, { tier: 'trader', timestamp: T_NOON }).unitPrice).toBe(5)
    // 明细链:base / tier / time_of_day 三项
    const bd = applyRule(r, { tier: 'vip', timestamp: T_2300 }).breakdown
    expect(bd.map((b) => b.kind)).toEqual(['base', 'tier', 'time_of_day'])
    expect(bd.map((b) => b.factor)).toEqual([5, 0.8, 0.5])
  })

  it('pickRule:精确 rule_key 优先于 * 兜底;mode 不一致不命中', () => {
    const exact = makeRule()
    const star = makeRule({ id: 'rule-star', ruleKey: '*', basePrice: 2 })
    const image = makeRule({ id: 'rule-img', ruleKey: 'gpt-image-1', mode: 'per_image' })
    expect(pickRule([star, exact], 'token', 'gpt-4o')?.id).toBe('rule-gpt4o')
    expect(pickRule([star, image], 'token', 'unknown-model')?.id).toBe('rule-star')
    expect(pickRule([exact], 'per_image', 'gpt-4o')).toBeUndefined()
  })
})

// =============================================================================
// 2. resolvePrice(注入 loadRules,无真库)
// =============================================================================

describe('resolvePrice 规则命中与回退', () => {
  it('命中精确规则 → ResolvedPrice(带 ruleId/ruleVersion)', async () => {
    const p = await resolvePrice(
      { mode: 'token', modelId: 'gpt-4o', tier: 'vip', timestamp: T_2300 },
      { loadRules: async () => [makeRule({ timeOfDayFactor: OFF_PEAK })] },
    )
    expect(p).not.toBeNull()
    expect(p!.unitPrice).toBe(2)
    expect(p!.ruleId).toBe('rule-gpt4o')
    expect(p!.ruleVersion).toBe(3)
    expect(p!.currency).toBe('CNY')
  })

  it('无生效规则 → null(调用方回退既有定价路径)', async () => {
    const p = await resolvePrice(
      { mode: 'token', modelId: 'gpt-4o', timestamp: T_NOON },
      { loadRules: async () => [] },
    )
    expect(p).toBeNull()
  })

  it('规则装载异常 → null(绝不因新面故障抬高或清零成本)', async () => {
    const p = await resolvePrice(
      { mode: 'token', modelId: 'gpt-4o', timestamp: T_NOON },
      {
        loadRules: async () => {
          throw new Error('db down')
        },
      },
    )
    expect(p).toBeNull()
  })
})

// =============================================================================
// 3. AICostTracker 结算改造(开关纪律)
// =============================================================================

const PRICING = [{ model: 'gpt-4o', inputPer1k: 0.05, outputPer1k: 0.15 }]
const RECORD_INPUT = { userId: 'u1', model: 'gpt-4o', promptTokens: 1500, completionTokens: 500 }

describe('AICostTracker 结算改造', () => {
  it('未注入开关(默认) = 逐字节旧行为:cost = calculateCostCents/100,无 ruleId', async () => {
    const tracker = new AICostTracker(PRICING)
    const rec = await tracker.record(RECORD_INPUT)
    expect(rec.cost).toBe(tracker.calculateCostCents('gpt-4o', 1500, 500) / 100)
    expect(rec.ruleId ?? null).toBeNull()
    expect(rec.breakdown ?? null).toBeNull()
  })

  it('开关关(enabled=false) = 旧行为,resolve 绝不被调用', async () => {
    const resolve = vi.fn(async () => null)
    const tracker = new AICostTracker(PRICING, { pricingRules: { enabled: false, resolve } })
    const rec = await tracker.record(RECORD_INPUT)
    expect(resolve).not.toHaveBeenCalled()
    expect(rec.cost).toBe(tracker.calculateCostCents('gpt-4o', 1500, 500) / 100)
  })

  it('开关开 + 命中规则 → 按组合单价结算并落 ruleId/ruleVersion/breakdown', async () => {
    const resolved = {
      unitPrice: 4, // 分/千 token
      ruleId: 'rule-gpt4o',
      ruleVersion: 3,
      currency: 'CNY',
      mode: 'token' as const,
      breakdown: [{ kind: 'base' as const, label: 'gpt-4o', factor: 5 }],
    }
    const tracker = new AICostTracker(PRICING, {
      pricingRules: { enabled: true, resolve: async () => resolved },
    })
    const rec = await tracker.record({ ...RECORD_INPUT, tier: 'vip' })
    // (1500+500)/1000 × 4 = 8 分 → 0.08 元
    expect(rec.cost).toBe(0.08)
    expect(rec.ruleId).toBe('rule-gpt4o')
    expect(rec.ruleVersion).toBe(3)
    expect(rec.breakdown).toEqual(resolved.breakdown)
    expect(rec.tier).toBe('vip')
  })

  it('开关开 + 未命中 → 回退旧 calculateCostCents 路径', async () => {
    const tracker = new AICostTracker(PRICING, {
      pricingRules: { enabled: true, resolve: async () => null },
    })
    const rec = await tracker.record(RECORD_INPUT)
    expect(rec.cost).toBe(tracker.calculateCostCents('gpt-4o', 1500, 500) / 100)
    expect(rec.ruleId ?? null).toBeNull()
  })

  it('开关开 + 解析抛异常 → 吞掉并回退旧路径(结算不因新面失败)', async () => {
    const tracker = new AICostTracker(PRICING, {
      pricingRules: {
        enabled: true,
        resolve: async () => {
          throw new Error('boom')
        },
      },
    })
    const rec = await tracker.record(RECORD_INPUT)
    expect(rec.cost).toBe(tracker.calculateCostCents('gpt-4o', 1500, 500) / 100)
  })
})

// =============================================================================
// 4. pricing-rules 路由(用户面 + 管理面鉴权/CRUD)
// =============================================================================

describe('pricing-rules 路由', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(pricingRulesRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server?.close()
  })

  beforeEach(() => {
    mockStore.rules = []
    mockStore.throwUnique = false
  })

  const asUser = (method: string, url: string, user?: string) =>
    server.inject({
      method: method as any,
      url,
      headers: user ? { 'x-test-user': user } : {},
    })

  const asAdmin = (method: string, url: string, payload?: unknown, admin = true) =>
    server.inject({
      method: method as any,
      url,
      headers: { 'x-test-user': 'admin-1', ...(admin ? { 'x-test-admin': '1' } : {}) },
      payload: payload as any,
    })

  // ---- 用户面 GET /api/pricing-rules ----

  it('GET /api/pricing-rules 未登录 → 401', async () => {
    const res = await asUser('GET', '/api/pricing-rules')
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/pricing-rules 登录 → 生效规则 + 错峰窗口人话说明', async () => {
    mockStore.rules = [makeRule({ timeOfDayFactor: OFF_PEAK })]
    const res = await asUser('GET', '/api/pricing-rules', 'u1')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ruleKey).toBe('gpt-4o')
    expect(body.data[0].timeOfDayDescriptions[0]).toContain('23:00-07:00')
    expect(body.data[0].timeOfDayDescriptions[0]).toContain('0.5')
  })

  // ---- 管理面鉴权 ----

  it('管理面未带 admin → 403(守卫拦截)', async () => {
    const res = await asAdmin('GET', '/api/admin/pricing-rules', undefined, false)
    expect(res.statusCode).toBe(403)
  })

  it('管理面 GET 全量列表(admin) → 200', async () => {
    mockStore.rules = [makeRule(), makeRule({ id: 'r2', ruleKey: '*' })]
    const res = await asAdmin('GET', '/api/admin/pricing-rules')
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
  })

  // ---- 管理面 POST ----

  it('POST 新建规则 → version=1 落库', async () => {
    const res = await asAdmin('POST', '/api/admin/pricing-rules', {
      ruleKey: 'gpt-4o',
      displayName: 'GPT-4o',
      mode: 'token',
      basePrice: 5,
      tierMultipliers: { vip: 0.8 },
      timeOfDayFactor: OFF_PEAK,
    })
    expect(res.statusCode).toBe(200)
    const row = res.json().data
    expect(row.version).toBe(1)
    expect(row.ruleKey).toBe('gpt-4o')
    expect(mockStore.rules).toHaveLength(1)
  })

  it('POST rule_key 重复(23505) → 409', async () => {
    mockStore.throwUnique = true
    const res = await asAdmin('POST', '/api/admin/pricing-rules', {
      ruleKey: 'gpt-4o',
      displayName: 'dup',
      mode: 'token',
      basePrice: 1,
    })
    expect(res.statusCode).toBe(409)
  })

  it('POST mode 非法枚举 → 400', async () => {
    const res = await asAdmin('POST', '/api/admin/pricing-rules', {
      ruleKey: 'x',
      displayName: 'x',
      mode: 'per_audio',
      basePrice: 1,
    })
    expect(res.statusCode).toBe(400)
  })

  // ---- 管理面 PUT ----

  it('PUT 局部更新 → version+1,未传字段保留', async () => {
    mockStore.rules = [makeRule()]
    const res = await asAdmin('PUT', '/api/admin/pricing-rules/rule-gpt4o', { basePrice: 6 })
    expect(res.statusCode).toBe(200)
    const row = res.json().data
    expect(row.version).toBe(4)
    expect(row.basePrice).toBe(6)
    expect(row.ruleKey).toBe('gpt-4o')
  })

  it('PUT 不存在的规则 → 404', async () => {
    const res = await asAdmin('PUT', '/api/admin/pricing-rules/nope', { basePrice: 6 })
    expect(res.statusCode).toBe(404)
  })

  // ---- 管理面 DELETE(软下线) ----

  it('DELETE → 软下线 enabled=false、version+1(不物理删行)', async () => {
    mockStore.rules = [makeRule()]
    const res = await asAdmin('DELETE', '/api/admin/pricing-rules/rule-gpt4o')
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ disabled: true, version: 4 })
    expect(mockStore.rules).toHaveLength(1)
    expect(mockStore.rules[0].enabled).toBe(false)
  })

  it('DELETE 不存在的规则 → 404', async () => {
    const res = await asAdmin('DELETE', '/api/admin/pricing-rules/nope')
    expect(res.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
