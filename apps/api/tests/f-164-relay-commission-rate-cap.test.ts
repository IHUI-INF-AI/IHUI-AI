// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-164 返佣两级费率合计可超成本(套现口子)的回归测试(2026-11-13 立)。
 *
 * 判据不复制(§22c):setCommissionConfig / recordRelayCommission /
 * validateCombinedRates / CommissionInvalidRatesError 全部走生产实现;
 * 取数边界只打到 **db/dbRead 桩**(生产模块的内部调用不经 vi.mock 改写,
 * 所以桩形态必须在源头给对 —— 配置行按 category 分诊,邀请链按查询序分诊)。
 *
 * 四个面:
 * A. 纯函数组合校验(布尔判据 + 浮点边界容差)
 * B. setCommissionConfig 生效组合终闸:只改一级按存量组合判定;合法写、非法 0 写并抛
 * C. recordRelayCommission 记账封顶:每笔来源消费的返佣之和 ≤ sourceCostCents
 * D. PATCH /relay-commission/settings 端到端(同一真 service 在链上):双字段非法 400;
 *    单字段与存量组合非法 ⇒ 400;frozenDays-only 不误拦;合法组合 200 落库
 *
 * 测试隔离:全程 vi.mock 打桩 db/dbRead,不连生产库(§5 测试隔离铁律)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    /** setCommissionConfig 生产路径的 upsert 写集(载荷含 value+key ⇒ 配置行) */
    configWrites: [] as Array<{ key: string; value: unknown }>,
    /** recordRelayCommission 生产路径的 insert 行(载荷含 commissionCents) */
    commissionRows: [] as Array<Record<string, unknown>>,
    /** system_configs 存量桩(默认=事故现场:两级各 0.6,和 1.2 > 1) */
    configRows: [
      { key: 'relay_commission.level1_rate', value: '0.6' },
      { key: 'relay_commission.level2_rate', value: '0.6' },
      { key: 'relay_commission.frozen_days', value: '7' },
    ] as Array<{ key: string; value: string }>,
    /** 邀请链查询序:src→父(u1)→祖父(u2)→无 */
    chainQueue: [] as Array<Array<{ parentId: string | null }>>,
    chainCursor: 0,
  }
})

vi.mock('../src/db/index.js', () => {
  const insert = () => ({
    values(rows: unknown) {
      const list = Array.isArray(rows)
        ? (rows as Record<string, unknown>[])
        : [rows as Record<string, unknown>]
      for (const r of list) {
        if ('value' in r && 'key' in r) h.configWrites.push({ key: String(r.key), value: r.value })
        else if ('commissionCents' in r) h.commissionRows.push(r)
      }
      // 链式返回(drizzle 形态: values() 同步步返回带 onConflictDoUpdate 的 thenable)
      return { onConflictDoUpdate: () => Promise.resolve() }
    },
  })
  const readChain = (): any => ({
    select: (shape?: Record<string, unknown>) => {
      const isParentProjection = !!shape && 'parentId' in shape
      const inner: any = {
        from: () => inner,
        where: (cond?: unknown) => {
          // 配置查询的 where 携带 category ⇒ 标记本次为配置读
          void cond
          return inner
        },
        orderBy: () => inner,
        limit: () => {
          if (isParentProjection) {
            const out = h.chainQueue[h.chainCursor] ?? [{ parentId: null }]
            h.chainCursor++
            return Promise.resolve(out)
          }
          return Promise.resolve(out_config())
        },
      }
      // getCommissionConfig 的真实形态: select(...).from(...).where(category=...) **无 limit**
      // ⇒ thenable 兜底:inner 本身要可 await
      Object.defineProperty(inner, 'then', {
        value: (f?: (v: unknown) => unknown) => Promise.resolve(out_config()).then(f),
      })
      return inner
    },
    from: () => readChain(),
    where: () => readChain(),
  })
  const out_config = () => h.configRows.map((r) => ({ key: r.key, value: r.value }))
  const db = readChain()
  db.insert = insert
  return { db, dbRead: readChain() }
})

// 管理员闸门与本票机制无关,放行为注入 userId
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }): Promise<void> => {
    request.userId = 'admin-11111111-1111-4111-8111-111111111111'
  },
}))

import {
  validateCombinedRates,
  setCommissionConfig,
  recordRelayCommission,
  getCommissionConfig,
  CommissionInvalidRatesError,
} from '../src/services/relay-commission-service.js'
import adminRelayCommissionRoutes from '../src/routes/admin/relay-commission.js'

function setStoredPair(l1: string, l2: string): void {
  h.configRows = [
    { key: 'relay_commission.level1_rate', value: l1 },
    { key: 'relay_commission.level2_rate', value: l2 },
    { key: 'relay_commission.frozen_days', value: '7' },
  ]
}

describe('F-164 A — validateCombinedRates 纯判据', () => {
  it('0.6+0.3 合法;0.5+0.5 边界合法', () => {
    expect(validateCombinedRates(0.6, 0.3)).toBe(true)
    expect(validateCombinedRates(0.5, 0.5)).toBe(true)
  })
  it('1+1(事故形态)非法;0.6+0.6 非法(超 1)', () => {
    expect(validateCombinedRates(1, 1)).toBe(false)
    expect(validateCombinedRates(0.6, 0.6)).toBe(false)
  })
  it('负值 / NaN 非法;>1 非法', () => {
    expect(validateCombinedRates(-0.1, 0.5)).toBe(false)
    expect(validateCombinedRates(Number.NaN, 0.5)).toBe(false)
    expect(validateCombinedRates(1.5, 0)).toBe(false)
  })
  it('二进制小数容差:0.7+0.3 与 0.3+0.7 都合法(1±1e-9 不误杀)', () => {
    expect(validateCombinedRates(0.7, 0.3)).toBe(true) // 0.7+0.3 === 0.9999999999999999
    expect(validateCombinedRates(0.3, 0.7)).toBe(true) // 恰 1.0
  })
})

describe('F-164 B — setCommissionConfig 生效组合终闸(生产实现)', () => {
  beforeEach(() => {
    h.configWrites.length = 0
    setStoredPair('0.6', '0.6')
  })

  it('只改 level1=0.4(存量 level2=0.6 ⇒ 恰 1)⇒ 放行,只写一行 0.4', async () => {
    await setCommissionConfig({ level1Rate: 0.4 })
    expect(h.configWrites).toEqual([{ key: 'relay_commission.level1_rate', value: '0.4' }])
  })

  it('只改 level1=0.8(存量 level2=0.6 ⇒ 合计 1.4)⇒ 抛 CommissionInvalidRatesError 且 0 写', async () => {
    await expect(setCommissionConfig({ level1Rate: 0.8 })).rejects.toBeInstanceOf(
      CommissionInvalidRatesError,
    )
    expect(h.configWrites).toHaveLength(0)
  })

  it('双字段 1+1 ⇒ 抛错且 0 写(事故形态直接复现)', async () => {
    await expect(setCommissionConfig({ level1Rate: 1, level2Rate: 1 })).rejects.toBeInstanceOf(
      CommissionInvalidRatesError,
    )
    expect(h.configWrites).toHaveLength(0)
  })

  it('只改 frozenDays ⇒ 不触发费率校验,直写一行', async () => {
    await setCommissionConfig({ frozenDays: 30 })
    expect(h.configWrites).toEqual([{ key: 'relay_commission.frozen_days', value: '30' }])
  })

  it('现网存量本身非法(0.6+0.6)不拦只读路径:getCommissionConfig 正常返回', async () => {
    await expect(getCommissionConfig()).resolves.toMatchObject({ level1Rate: 0.6, level2Rate: 0.6 })
  })
})

describe('F-164 C — recordRelayCommission 记账封顶:每笔之和 ≤ 成本(生产实现)', () => {
  beforeEach(() => {
    h.commissionRows.length = 0
    h.chainQueue = [[{ parentId: 'u1' }], [{ parentId: 'u2' }], [{ parentId: null }]]
    h.chainCursor = 0
  })

  it('非法组合(存量 0.6+0.6)sourceCost=100 ⇒ level1 取 60、level2 预算截到 40,合计恰等于成本', async () => {
    setStoredPair('0.6', '0.6')
    await recordRelayCommission({
      sourceUserId: 'src',
      sourceCallLogId: 'call-1',
      sourceCostCents: 100,
    })
    expect(h.commissionRows).toHaveLength(2)
    const total = h.commissionRows.reduce((s, r) => s + Number(r.commissionCents), 0)
    expect(total).toBe(100)
    expect(Number(h.commissionRows[0].commissionCents)).toBe(60)
    expect(Number(h.commissionRows[1].commissionCents)).toBe(40)
    expect(h.commissionRows[0].beneficiaryLevel).toBe(1)
    expect(h.commissionRows[1].beneficiaryLevel).toBe(2)
  })

  it('合法组合(0.6+0.3)sourceCost=1000 ⇒ 600+300,不被误截', async () => {
    setStoredPair('0.6', '0.3')
    await recordRelayCommission({
      sourceUserId: 'src',
      sourceCallLogId: 'call-2',
      sourceCostCents: 1000,
    })
    const total = h.commissionRows.reduce((s, r) => s + Number(r.commissionCents), 0)
    expect(total).toBe(900)
  })

  it('单层链(chain 只到父级)不受封顶影响', async () => {
    setStoredPair('0.05', '0.01')
    h.chainQueue = [[{ parentId: 'u1' }], [{ parentId: null }]]
    await recordRelayCommission({
      sourceUserId: 'src',
      sourceCallLogId: 'call-3',
      sourceCostCents: 1000,
    })
    expect(h.commissionRows).toHaveLength(1)
    expect(Number(h.commissionRows[0].commissionCents)).toBe(50)
  })

  it('sourceCost ≤ 0 ⇒ 完全跳过,不查链不写行', async () => {
    await recordRelayCommission({
      sourceUserId: 'src',
      sourceCallLogId: 'call-4',
      sourceCostCents: 0,
    })
    expect(h.commissionRows).toHaveLength(0)
    expect(h.chainCursor).toBe(0)
  })
})

describe('F-164 D — PATCH /relay-commission/settings 路由闸(同一真 service 在链上)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    h.configWrites.length = 0
    setStoredPair('0.6', '0.6')
    app = Fastify({ logger: false })
    await app.register(adminRelayCommissionRoutes)
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
  })

  it('双字段 1+1 ⇒ 400(schema 跨字段闸),真 service 一条不写', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 1, level2Rate: 1 },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toMatch(/不得超过/)
    expect(h.configWrites).toHaveLength(0)
  })

  it('单字段与存量组合非法(0.8 + 存量 0.6)⇒ 真 service 抛组合错 ⇒ 路由回 400(不混 500)且不写', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 0.8 },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toMatch(/不得超过 1/)
    expect(h.configWrites).toHaveLength(0)
  })

  it('合法组合(0.4 + 存量 0.6)⇒ 200 且一行落库', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 0.4 },
    })
    expect(res.statusCode).toBe(200)
    expect(h.configWrites).toEqual([{ key: 'relay_commission.level1_rate', value: '0.4' }])
  })

  it('frozenDays-only 修改不被跨字段闸误拦 ⇒ 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { frozenDays: 30 },
    })
    expect(res.statusCode).toBe(200)
    expect(h.configWrites).toEqual([{ key: 'relay_commission.frozen_days', value: '30' }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
