// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-705 回归:GET /api/ab-testing/stats 的 exposureCount / conversionCount 必须是 number。
 *
 * pg 驱动把 SUM 结果以 string 返回,`0 + '100'` 会拼成 "0100"。
 * 本用例不连 DB/Redis:
 *   1) 源码形状:所有 SUM 聚合都带 `::bigint`,累加处显式 `Number(...)`;
 *   2) 行为:mock db 返回 string 型 samples/conversions,断言响应为 number 且转化率口径不变。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAuth: vi.fn(async () => {}),
  requirePermission: vi.fn(() => vi.fn(async () => {})),
  requireAnyPermission: vi.fn(() => vi.fn(async () => {})),
}))

const { selectQueue, pushSelect, resetQueue } = vi.hoisted(() => {
  const selectQueue: unknown[][] = []
  return {
    selectQueue,
    pushSelect: (rows: unknown[]) => selectQueue.push(rows),
    resetQueue: () => {
      selectQueue.length = 0
    },
  }
})

vi.mock('../src/db/index.js', () => {
  const makeSelectBuilder = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      from: () => builder,
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      groupBy: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const queued = selectQueue.shift() ?? []
        return Promise.resolve(queued).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  const dbMock = {
    select: () => makeSelectBuilder(),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => Promise.resolve([]) }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    delete: () => ({ where: () => Promise.resolve([]) }),
    execute: () => Promise.resolve([]),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { abTestingRoutes } from '../src/routes/ab-testing.js'

const EXP_ID = '11111111-1111-4111-8111-111111111111'
const VARIANT_A = '22222222-2222-4222-8222-222222222222'

function makeExperiment() {
  return {
    id: EXP_ID,
    name: '统计数值实验',
    description: null,
    status: 'active',
    trafficPercent: 100,
    targetMetric: 'conversion',
    startedAt: new Date('2026-08-01T00:00:00Z'),
    endedAt: null,
    winningVariantId: null,
    config: {},
    autoPromote: false,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  }
}

async function fetchStats(app: FastifyInstance, rows: unknown[]) {
  pushSelect([makeExperiment()])
  pushSelect(rows)
  pushSelect([{ id: VARIANT_A, name: '变体 A' }])
  return app.inject({ method: 'GET', url: `/api/ab-testing/stats?experimentId=${EXP_ID}` })
}

describe('F-705 stats SUM 结果转 number', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(abTestingRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetQueue()
  })

  describe('源码形状', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/routes/ab-testing.ts', import.meta.url)),
      'utf8',
    )
    const sumAggregates = source.match(/SUM\([^`]*/g) ?? []

    it('所有 SUM 聚合都显式转 ::bigint', () => {
      expect(sumAggregates.length).toBeGreaterThanOrEqual(2)
      for (const aggregate of sumAggregates) {
        expect(aggregate).toContain('::bigint')
      }
    })

    it('聚合累加处显式 Number(...) 转换', () => {
      expect(source).toMatch(/exposureCount \+= Number\(row\.samples\)/)
      expect(source).toMatch(/conversionCount \+= Number\(row\.conversions\)/)
    })
  })

  describe('行为', () => {
    it("samples:'100' / conversions:'12' 时返回 number 100/12,而非 '0100'", async () => {
      // 两个曝光桶累加,验证跨行累加也不会退化成字符串拼接
      const res = await fetchStats(app, [
        { variantId: VARIANT_A, bucket: 'exposure', samples: '60', conversions: '0' },
        { variantId: VARIANT_A, bucket: 'exposure', samples: '40', conversions: '0' },
        { variantId: VARIANT_A, bucket: 'conversion', samples: '0', conversions: '12' },
      ])

      expect(res.statusCode).toBe(200)
      const [stat] = res.json().data.stats
      expect(stat.exposureCount).toBe(100)
      expect(stat.conversionCount).toBe(12)
      expect(typeof stat.exposureCount).toBe('number')
      expect(typeof stat.conversionCount).toBe('number')
      expect(stat.exposureCount).not.toBe('0100')
      expect(stat.conversionCount).not.toBe('012')
      // 转化率口径不变:12 / 100 = 0.12
      expect(stat.conversionRate).toBe(0.12)
    })

    it('转化率仍为 conversionCount / exposureCount 四舍五入 2 位', async () => {
      const res = await fetchStats(app, [
        { variantId: VARIANT_A, bucket: 'exposure', samples: '3', conversions: '0' },
        { variantId: VARIANT_A, bucket: 'conversion', samples: '0', conversions: '1' },
      ])

      expect(res.statusCode).toBe(200)
      const [stat] = res.json().data.stats
      expect(stat.exposureCount).toBe(3)
      expect(stat.conversionCount).toBe(1)
      expect(stat.conversionRate).toBe(0.33)
    })

    it('无统计行时计数为 number 0、转化率为 0', async () => {
      const res = await fetchStats(app, [])

      expect(res.statusCode).toBe(200)
      const [stat] = res.json().data.stats
      expect(stat.exposureCount).toBe(0)
      expect(stat.conversionCount).toBe(0)
      expect(stat.conversionRate).toBe(0)
    })
  })
})
