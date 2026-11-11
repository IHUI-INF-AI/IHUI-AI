// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'

const { dbQueue, mockAuthenticate, mockRequireAdmin } = vi.hoisted(() => ({
  dbQueue: { items: [] as unknown[][] },
  mockAuthenticate: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requireAuth: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  function createReadChain() {
    const chain: {
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'groupBy']) {
      chain[m] = vi.fn(() => chain)
    }
    return chain
  }
  return {
    db: {
      select: vi.fn(() => createReadChain()),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: {
      select: vi.fn(() => createReadChain()),
    },
    dbClient: {},
  }
})

import { adminWalletRoutes, toCount } from '../src/routes/wallet.js'

const WALLET_SRC = readFileSync(
  fileURLToPath(new URL('../src/routes/wallet.ts', import.meta.url)),
  'utf8',
)

const PREFIX = '/api/admin/wallet'
const ADMIN_USER = '00000000-0000-4000-8000-000000000001'

describe('F-700 钱包统计 bigint 溢出', () => {
  describe('SQL 形状', () => {
    it('聚合不再强转 ::int(count/sum 全部改为 ::bigint)', () => {
      // 任何 `)::int` 强转(含 sum(...)::int / count(*)::int)都不允许残留
      expect(WALLET_SRC).not.toMatch(/\)\s*::int\b/)
      expect(WALLET_SRC).not.toMatch(/sum\([^)]*\)\s*::int/)
      expect(WALLET_SRC).not.toMatch(/count\(\*\)\s*::int/)
    })

    it('聚合使用 ::bigint 且 admin /stats 7 个口径齐全', () => {
      const bigintCount = (WALLET_SRC.match(/::bigint/g) ?? []).length
      // /stats 7 处 + 用户余额/记录用户侧 count 等同样收敛为 bigint
      expect(bigintCount).toBeGreaterThanOrEqual(15)
    })
  })

  describe('toCount 归一化', () => {
    it("PG int8 字符串 '3000000000' → number 3000000000", () => {
      const v = toCount('3000000000')
      expect(typeof v).toBe('number')
      expect(v).toBe(3_000_000_000)
    })

    it('0 行(null/undefined)兜底 0', () => {
      expect(toCount(undefined)).toBe(0)
      expect(toCount(null)).toBe(0)
      expect(toCount(0)).toBe(0)
    })

    it('number 原样返回,NaN 兜底 0', () => {
      expect(toCount(42)).toBe(42)
      expect(toCount('not-a-number')).toBe(0)
    })
  })

  describe('GET /stats 透传(number 契约)', () => {
    const server = Fastify({ logger: false })

    beforeAll(async () => {
      await server.register(adminWalletRoutes, { prefix: PREFIX })
      await server.ready()
    })

    afterAll(async () => {
      await server.close()
    })

    beforeEach(() => {
      vi.clearAllMocks()
      dbQueue.items.length = 0
      mockRequireAdmin
        .mockReset()
        .mockImplementation(async (request: { userId?: string }) => {
          request.userId = ADMIN_USER
        })
    })

    it('超大累计值以字符串返回时,响应仍为 number 且不溢出', async () => {
      dbQueue.items.push(
        [{ total: '3000000000' }], // rechargeSum
        [{ total: '2147483648' }], // withdrawSum
        [{ total: '4000000000' }], // commissionSum
        [{ total: '5000000000' }], // adjustSum
        [{ count: '2147483649', amount: '3000000000' }], // todayRecharge
        [{ count: '12345678901', amount: '3000000001' }], // todayWithdraw
        [{ date: '2026-11-11', recharge: '3000000000', withdraw: '2147483648', commission: '4000000000' }], // daily
        [{ count: '3000000000' }], // activeWallets
      )
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/stats` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.totalRecharge).toBe(3_000_000_000)
      expect(body.data.totalWithdraw).toBe(2_147_483_648)
      expect(body.data.totalCommission).toBe(4_000_000_000)
      expect(body.data.totalAdminAdjust).toBe(5_000_000_000)
      expect(body.data.todayRecharge).toEqual({ count: 2_147_483_649, amount: 3_000_000_000 })
      expect(body.data.todayWithdraw).toEqual({ count: 12_345_678_901, amount: 3_000_000_001 })
      expect(body.data.daily).toEqual([
        {
          date: '2026-11-11',
          recharge: 3_000_000_000,
          withdraw: 2_147_483_648,
          commission: 4_000_000_000,
        },
      ])
      expect(body.data.activeWallets).toBe(3_000_000_000)
      for (const v of [
        body.data.totalRecharge,
        body.data.totalWithdraw,
        body.data.totalCommission,
        body.data.totalAdminAdjust,
        body.data.todayRecharge.count,
        body.data.todayRecharge.amount,
        body.data.todayWithdraw.count,
        body.data.todayWithdraw.amount,
        body.data.daily[0].recharge,
        body.data.daily[0].withdraw,
        body.data.daily[0].commission,
        body.data.activeWallets,
      ]) {
        expect(typeof v).toBe('number')
      }
    })

    it('空表时所有字段仍为 0 / 空数组', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/stats` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.totalRecharge).toBe(0)
      expect(body.data.todayRecharge).toEqual({ count: 0, amount: 0 })
      expect(body.data.todayWithdraw).toEqual({ count: 0, amount: 0 })
      expect(body.data.daily).toEqual([])
      expect(body.data.activeWallets).toBe(0)
    })
  })
})
