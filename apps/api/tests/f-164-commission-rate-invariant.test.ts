// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-164 回归锁(2026-11-13)。
 *
 * 病灶:返佣费率只校验单级 0..1,缺 level1+level2 ≤ 1 的跨字段约束;
 * `{"level1Rate":1,"level2Rate":1}` 落库后,每笔 relay 消费产生两条各 100% 返佣记录,
 * 冻结期到点由 releaseExpiredCommissions 直接给父级/祖父级 Key 余额加钱,
 * 返佣支出可达消费成本的 200%(超发/铸币口子)。
 *
 * 本文件锁:
 *   ① 纯函数 validateCommissionRates:0.6+0.6 拒、1.0+0 过、负数/NaN/undefined 拒;
 *   ② 写入端点 PATCH /relay-commission/settings:非法组合 400 且一条不写;
 *   ③ 释放端:存量超限冻结行拒付(不加余额、不翻转 status)并告警;合法行照常释放(防过度拦截);
 *   ④ 源锁:releaseExpiredCommissions 内先过超限闸,再走到 costBalanceCents。
 *
 * 只 mock db/dbRead/requireAdmin,不触达真实 PG、Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

interface PendingRow {
  id: string
  sourceCallLogId: string | null
  sourceCostCents: number
  beneficiaryUserId: string
  commissionRate: string
  commissionCents: number
}

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    /** setCommissionConfig 的 upsert 写集 */
    configWrites: [] as Array<{ key: string; value: unknown }>,
    /** system_configs 存量桩 */
    configRows: [
      { key: 'relay_commission.level1_rate', value: '0.05' },
      { key: 'relay_commission.level2_rate', value: '0.01' },
      { key: 'relay_commission.frozen_days', value: '7' },
    ] as Array<{ key: string; value: string }>,
    /** releaseExpiredCommissions 首查返回的冻结行 */
    pendingRows: [] as PendingRow[],
    pendingServed: false,
    /** 余额加钱调用记录(超限时必须是空数组) */
    balanceUpdates: [] as Array<Record<string, unknown>>,
    transactionCount: 0,
  }
})

vi.mock('../src/db/index.js', () => {
  const outConfig = () => h.configRows.map((r) => ({ key: r.key, value: r.value }))

  const selectQuery = (): any => {
    const q: any = {
      from: () => q,
      where: () => q,
      orderBy: () => q,
      limit: () => {
        // 第 1 次 limit 是释放端的冻结行查询;之后是每条记录的 active Key 查询
        if (!h.pendingServed) {
          h.pendingServed = true
          return Promise.resolve(h.pendingRows)
        }
        return Promise.resolve([{ id: 'key-1' }])
      },
    }
    // getCommissionConfig 的真实形态:select().from().where() 无 limit ⇒ 直接 await
    Object.defineProperty(q, 'then', {
      value: (f?: (v: unknown) => unknown) => Promise.resolve(outConfig()).then(f),
    })
    return q
  }

  const insert = () => ({
    values(rows: unknown) {
      const list = Array.isArray(rows)
        ? (rows as Array<Record<string, unknown>>)
        : [rows as Record<string, unknown>]
      for (const r of list) {
        if ('key' in r && 'value' in r) h.configWrites.push({ key: String(r.key), value: r.value })
      }
      return { onConflictDoUpdate: () => Promise.resolve() }
    },
  })

  const update = () => ({
    set(values: Record<string, unknown>) {
      return {
        where: () => {
          if ('costBalanceCents' in values) h.balanceUpdates.push(values)
          return { returning: () => Promise.resolve([{ id: 'r1' }]) }
        },
      }
    },
  })

  const transaction = async (cb: (tx: unknown) => Promise<unknown>) => {
    h.transactionCount++
    return cb({ update })
  }

  return { db: { select: selectQuery, insert, update, transaction }, dbRead: { select: selectQuery } }
})

// 管理员闸门与本票机制无关,放行为注入 userId
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }): Promise<void> => {
    request.userId = 'admin-11111111-1111-4111-8111-111111111111'
  },
}))

import {
  validateCommissionRates,
  releaseExpiredCommissions,
} from '../src/services/relay-commission-service.js'
import adminRelayCommissionRoutes from '../src/routes/admin/relay-commission.js'

function setStoredPair(l1: string, l2: string): void {
  h.configRows = [
    { key: 'relay_commission.level1_rate', value: l1 },
    { key: 'relay_commission.level2_rate', value: l2 },
    { key: 'relay_commission.frozen_days', value: '7' },
  ]
}

function makeRow(overrides: Partial<PendingRow> = {}): PendingRow {
  return {
    id: 'r1',
    sourceCallLogId: 'call-1',
    sourceCostCents: 100,
    beneficiaryUserId: 'u1',
    commissionRate: '0.0500',
    commissionCents: 5,
    ...overrides,
  }
}

beforeEach(() => {
  h.configWrites.length = 0
  h.pendingRows = []
  h.pendingServed = false
  h.balanceUpdates.length = 0
  h.transactionCount = 0
  setStoredPair('0.05', '0.01')
})

describe('F-164 A — validateCommissionRates 纯判据', () => {
  it('0.6+0.6 被拒(合计 120% > 100%)', () => {
    expect(validateCommissionRates(0.6, 0.6)).toBe(false)
  })

  it('1.0+0 通过(恰 100% 边界);0.5+0.5 也通过', () => {
    expect(validateCommissionRates(1, 0)).toBe(true)
    expect(validateCommissionRates(0.5, 0.5)).toBe(true)
  })

  it('负数被拒(任一级)', () => {
    expect(validateCommissionRates(-0.01, 0.5)).toBe(false)
    expect(validateCommissionRates(0.5, -1)).toBe(false)
  })

  it('NaN / undefined 被拒', () => {
    expect(validateCommissionRates(Number.NaN, 0)).toBe(false)
    expect(validateCommissionRates(0, Number.NaN)).toBe(false)
    expect(validateCommissionRates(undefined, 0.1)).toBe(false)
    expect(validateCommissionRates(0.1, undefined)).toBe(false)
  })

  it('单级 >1 被拒', () => {
    expect(validateCommissionRates(1.5, 0)).toBe(false)
    expect(validateCommissionRates(0, 2)).toBe(false)
  })
})

describe('F-164 B — PATCH /relay-commission/settings 写入端 400', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify({ logger: false })
    await app.register(adminRelayCommissionRoutes)
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
  })

  it('level1=1 + level2=1 ⇒ 400 且一条不写', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 1, level2Rate: 1 },
    })
    expect(res.statusCode).toBe(400)
    expect(h.configWrites).toHaveLength(0)
  })

  it('level1=0.6 + level2=0.6 ⇒ 400 且一条不写', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 0.6, level2Rate: 0.6 },
    })
    expect(res.statusCode).toBe(400)
    expect(h.configWrites).toHaveLength(0)
  })

  it('level1=1 + level2=0 ⇒ 200(合法边界可写)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/relay-commission/settings',
      payload: { level1Rate: 1, level2Rate: 0 },
    })
    expect(res.statusCode).toBe(200)
    expect(h.configWrites).toHaveLength(2)
  })
})

describe('F-164 C — 释放端遇超限规则不加钱', () => {
  it('两级各 100%(合计 200%)的存量冻结行 ⇒ 拒付:不翻转、不加余额、skippedInvalidRates=2', async () => {
    h.pendingRows = [
      makeRow({ id: 'r1', commissionRate: '1.0000', commissionCents: 100 }),
      makeRow({ id: 'r2', commissionRate: '1.0000', commissionCents: 100 }),
    ]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await releaseExpiredCommissions(100)
      expect(result.releasedCount).toBe(0)
      expect(result.releasedCents).toBe(0)
      expect(result.skippedInvalidRates).toBe(2)
      expect(h.balanceUpdates).toHaveLength(0)
      expect(h.transactionCount).toBe(0)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('单条金额未超成本但同笔两级合计 120%(60+60/成本 100)⇒ 整组拒付', async () => {
    h.pendingRows = [
      makeRow({ id: 'r1', commissionRate: '0.6000', commissionCents: 60 }),
      makeRow({ id: 'r2', commissionRate: '0.6000', commissionCents: 60 }),
    ]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await releaseExpiredCommissions(100)
      expect(result.releasedCount).toBe(0)
      expect(result.skippedInvalidRates).toBe(2)
      expect(h.balanceUpdates).toHaveLength(0)
      expect(h.transactionCount).toBe(0)
    } finally {
      warn.mockRestore()
    }
  })

  it('单条费率 >1(1.5 / 成本 100 / 金额 150)⇒ 拒付', async () => {
    h.pendingRows = [makeRow({ id: 'r1', commissionRate: '1.5000', commissionCents: 150 })]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await releaseExpiredCommissions(100)
      expect(result.releasedCount).toBe(0)
      expect(result.skippedInvalidRates).toBe(1)
      expect(h.balanceUpdates).toHaveLength(0)
    } finally {
      warn.mockRestore()
    }
  })

  it('合法行(60+40 / 成本 100)⇒ 照常释放,不被过度拦截', async () => {
    h.pendingRows = [
      makeRow({ id: 'r1', commissionRate: '0.6000', commissionCents: 60 }),
      makeRow({ id: 'r2', commissionRate: '0.4000', commissionCents: 40 }),
    ]
    const result = await releaseExpiredCommissions(100)
    expect(result.releasedCount).toBe(2)
    expect(result.releasedCents).toBe(100)
    expect(result.skippedInvalidRates).toBe(0)
    expect(h.transactionCount).toBe(2)
    expect(h.balanceUpdates).toHaveLength(2)
  })
})

describe('F-164 D — 源锁:释放函数先过超限闸再动余额', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/services/relay-commission-service.ts', import.meta.url)),
    'utf8',
  )
  const start = src.indexOf('export async function releaseExpiredCommissions')
  const end = src.indexOf('// 5. listUserCommissions')
  const body = src.slice(start, end)

  it('releaseExpiredCommissions 函数体内存在超限闸 + 告警 + 计数', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(body).toContain('isCommissionRowReleasable(record, groupCommissionCents)')
    expect(body).toContain('console.warn')
    expect(body).toContain('skippedInvalidRates')
  })

  it('超限闸位于余额加钱之前', () => {
    expect(body.indexOf('isCommissionRowReleasable(record, groupCommissionCents)')).toBeLessThan(
      body.indexOf('costBalanceCents'),
    )
  })
})
