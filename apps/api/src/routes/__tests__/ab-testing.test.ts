// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A/B 测试引擎路由测试。
 *
 * db 以链式 thenable builder mock:
 *   - db.select() 按调用顺序消费 selectQueue 中预置结果
 *   - db.insert() 的 returning() 消费 insertQueue;onConflictDoUpdate() 返回 [] 并记录调用
 *   - db.transaction() 直接执行回调,把 mock db 当作事务客户端
 * 幂等缓存由路由导出的 __clearAssignmentCacheForTests() 在每个用例前清空。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:admin 鉴权层(直接放行)
// ─────────────────────────────────────────────────────────────
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAuth: vi.fn(async () => {}),
  requirePermission: vi.fn(() => vi.fn(async () => {})),
  requireAnyPermission: vi.fn(() => vi.fn(async () => {})),
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 链式 thenable builder,按队列消费预置结果
// ─────────────────────────────────────────────────────────────
const {
  selectQueue,
  insertQueue,
  updateQueue,
  pushSelect,
  pushInsertReturning,
  resetQueues,
  insertCalls,
  updateCalls,
  transactionCalls,
  selectCallCount,
} = vi.hoisted(() => {
  const selectQueue: Array<unknown[] | Error> = []
  const insertQueue: Array<unknown[]> = []
  const updateQueue: Array<unknown[]> = []
  const insertCalls: Array<{ values: unknown; onConflict?: boolean }> = []
  const updateCalls: Array<{ set: unknown }> = []
  const transactionCalls: number[] = []
  const selectCallCount = { value: 0 }
  return {
    selectQueue,
    insertQueue,
    updateQueue,
    insertCalls,
    updateCalls,
    transactionCalls,
    selectCallCount,
    pushSelect: (r: unknown[] | Error) => selectQueue.push(r),
    pushInsertReturning: (r: unknown[]) => insertQueue.push(r),
    resetQueues: () => {
      selectQueue.length = 0
      insertQueue.length = 0
      updateQueue.length = 0
      insertCalls.length = 0
      updateCalls.length = 0
      transactionCalls.length = 0
      selectCallCount.value = 0
    },
  }
})

vi.mock('../../db/index.js', () => {
  // 链式 thenable builder:每次 db.select() 消费一条预置结果
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
        const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
        return p.then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  // insert 链:values → (returning | onConflictDoUpdate)
  const makeInsertChain = () => {
    const chain: Record<string, unknown> = {
      values: (values: unknown) => {
        insertCalls.push({ values })
        return chain
      },
      returning: () => Promise.resolve(insertQueue.shift() ?? []),
      onConflictDoUpdate: () => {
        const last = insertCalls[insertCalls.length - 1]
        if (last) last.onConflict = true
        return Promise.resolve([])
      },
      then(onFulfilled?: (v: unknown) => unknown) {
        return Promise.resolve([]).then(onFulfilled)
      },
    }
    return chain
  }

  const makeUpdateChain = () => {
    const chain: Record<string, unknown> = {
      set: (set: unknown) => {
        updateCalls.push({ set })
        return chain
      },
      where: () => chain,
      returning: () => Promise.resolve(updateQueue.shift() ?? []),
      then(onFulfilled?: (v: unknown) => unknown) {
        return Promise.resolve([]).then(onFulfilled)
      },
    }
    return chain
  }

  const dbMock = {
    select: () => {
      selectCallCount.value += 1
      return makeSelectBuilder()
    },
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    delete: () => ({
      where: () => Promise.resolve([]),
    }),
    execute: () => Promise.resolve([]),
    transaction: (cb: (tx: unknown) => Promise<unknown>) => {
      transactionCalls.push(1)
      return cb(dbMock)
    },
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { abTestingRoutes, __clearAssignmentCacheForTests } from '../ab-testing.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

const EXP_ID = '11111111-1111-4111-8111-111111111111'
const VARIANT_A = '22222222-2222-4222-8222-222222222222'
const VARIANT_B = '33333333-3333-4333-8333-333333333333'

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    name: '首页改版实验',
    description: null,
    status: 'draft',
    trafficPercent: 100,
    targetMetric: 'conversion',
    startedAt: null,
    endedAt: null,
    winningVariantId: null,
    config: {},
    autoPromote: false,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  }
}

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: VARIANT_A,
    testId: EXP_ID,
    name: '变体 A',
    description: null,
    isControl: true,
    trafficWeight: 30,
    payload: {},
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// 套件
// ─────────────────────────────────────────────────────────────

describe('A/B Testing 路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟生产 setErrorHandler:AppError(statusCode=400 等) → { code, message }
    app.setErrorHandler((error, _request, reply) => {
      const err = error as Error & { statusCode?: number }
      const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message || '服务器错误' })
    })
    await app.register(abTestingRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetQueues()
    __clearAssignmentCacheForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────
  // 1. 创建实验(含权重总和 100 校验)
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/ab-testing/experiments', () => {
    it('创建实验:事务内建 ab_tests + 变体,返回实验与变体', async () => {
      pushInsertReturning([makeExperiment({ status: 'draft', startedAt: null, endedAt: null })])
      const createdVariants = [
        makeVariant({ name: '变体 A', isControl: true, trafficWeight: 30 }),
        makeVariant({ id: VARIANT_B, name: '变体 B', isControl: false, trafficWeight: 70 }),
      ]

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/experiments',
        payload: {
          name: '首页改版实验',
          status: 'draft',
          variants: [
            { name: '变体 A', weight: 30 },
            { name: '变体 B', weight: 70 },
          ],
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      // 事务内 id 由服务端生成,不固定
      expect(typeof body.data.experiment.id).toBe('string')
      expect(transactionCalls).toHaveLength(1)
      // 主表 + 变体批量插入
      expect(insertCalls.filter((c) => !c.onConflict)).toHaveLength(2)
      const variantInsert = insertCalls.find((c) => {
        const v = c.values as Array<Record<string, unknown>>
        return Array.isArray(v) && v.length === 2
      })
      expect(variantInsert).toBeDefined()
      const insertedVariants = variantInsert!.values as Array<Record<string, unknown>>
      expect(insertedVariants).toHaveLength(2)
      // 同一实验的变体共用同一 testId(随机生成,只验证一致性)
      expect(insertedVariants[0]!.testId).toBe(insertedVariants[1]!.testId)
      expect(insertedVariants[0]).toMatchObject({
        name: '变体 A',
        isControl: true,
        trafficWeight: 30,
      })
      expect(insertedVariants[1]).toMatchObject({
        name: '变体 B',
        isControl: false,
        trafficWeight: 70,
      })
      expect(createdVariants).toHaveLength(2)
    })

    it('权重总和不为 100 时返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/experiments',
        payload: {
          name: '权重错误实验',
          variants: [
            { name: '变体 A', weight: 30 },
            { name: '变体 B', weight: 50 },
          ],
        },
      })

      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(String(body.message)).toContain('100')
      expect(dbInsertCount()).toBe(0)
    })

    it('status 缺省为 draft', async () => {
      pushInsertReturning([makeExperiment()])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/experiments',
        payload: { name: '默认状态实验', variants: [{ name: '唯一变体', weight: 100 }] },
      })
      expect(res.statusCode).toBe(201)
      const values = insertCalls[0]?.values as Record<string, unknown>
      expect(values.status).toBe('draft')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. assign 加权分布(mock 固定随机数)
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/ab-testing/assign 加权分布', () => {
    function mockActiveExperimentWithVariants() {
      pushSelect([makeExperiment({ status: 'active', startedAt: new Date() })])
      pushSelect([
        makeVariant({ id: VARIANT_A, name: '变体 A', trafficWeight: 30 }),
        makeVariant({ id: VARIANT_B, name: '变体 B', trafficWeight: 70 }),
      ])
    }

    it('random=0 落入权重 30 的变体 A', async () => {
      mockActiveExperimentWithVariants()
      vi.spyOn(Math, 'random').mockReturnValue(0)

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-0' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({
        variantId: VARIANT_A,
        variantName: '变体 A',
      })
    })

    it('random=0.5 落入权重 70 的变体 B', async () => {
      mockActiveExperimentWithVariants()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-50' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({
        variantId: VARIANT_B,
        variantName: '变体 B',
      })
    })

    it('random=0.9 落入变体 B', async () => {
      mockActiveExperimentWithVariants()
      vi.spyOn(Math, 'random').mockReturnValue(0.9)

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-90' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.variantId).toBe(VARIANT_B)
    })

    it('分配时记录 exposure 曝光(bucket=exposure,samples 累加)', async () => {
      mockActiveExperimentWithVariants()
      vi.spyOn(Math, 'random').mockReturnValue(0)

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-exp' },
      })

      expect(res.statusCode).toBe(200)
      const exposureInsert = insertCalls.find((c) => {
        const v = c.values as Record<string, unknown>
        return v && v.bucket === 'exposure'
      })
      expect(exposureInsert).toBeDefined()
      expect(exposureInsert!.onConflict).toBe(true)
      expect(exposureInsert!.values).toMatchObject({
        testId: EXP_ID,
        variantId: VARIANT_A,
        bucket: 'exposure',
        samples: 1,
      })
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. assign 幂等(同 session 两次相同)
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/ab-testing/assign 幂等', () => {
    it('同一 userId/sessionId 重复调用返回相同变体,且不重复写曝光', async () => {
      // 第一次:查实验 + 查变体 → 分配 A
      pushSelect([makeExperiment({ status: 'active', startedAt: new Date() })])
      pushSelect([
        makeVariant({ id: VARIANT_A, name: '变体 A', trafficWeight: 30 }),
        makeVariant({ id: VARIANT_B, name: '变体 B', trafficWeight: 70 }),
      ])
      vi.spyOn(Math, 'random').mockReturnValue(0)

      const first = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, userId: 'u-1', sessionId: 'sess-idem' },
      })
      expect(first.statusCode).toBe(200)
      expect(first.json().data.variantId).toBe(VARIANT_A)

      // 第二次:命中缓存,不查库、不写曝光
      const second = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, userId: 'u-1', sessionId: 'sess-idem' },
      })
      expect(second.statusCode).toBe(200)
      expect(second.json().data).toEqual(first.json().data)

      const selectCountAfter = selectCalls()
      const exposureWrites = insertCalls.filter(
        (c) => (c.values as Record<string, unknown>)?.bucket === 'exposure',
      )
      expect(selectCountAfter).toBe(2) // 第二次未发起查询
      expect(exposureWrites).toHaveLength(1)
    })

    it('不同 session 各分配一次,互不影响', async () => {
      for (let i = 0; i < 2; i++) {
        pushSelect([makeExperiment({ status: 'active', startedAt: new Date() })])
        pushSelect([
          makeVariant({ id: VARIANT_A, name: '变体 A', trafficWeight: 30 }),
          makeVariant({ id: VARIANT_B, name: '变体 B', trafficWeight: 70 }),
        ])
      }
      vi.spyOn(Math, 'random').mockReturnValue(0.9)

      const first = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-1' },
      })
      const second = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-2' },
      })

      expect(first.json().data.variantId).toBe(VARIANT_B)
      expect(second.json().data.variantId).toBe(VARIANT_B)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. track 转化
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/ab-testing/track', () => {
    it('记录 conversion 事件(conversions+1 upsert)', async () => {
      pushSelect([makeVariant({ id: VARIANT_A, testId: EXP_ID })])

      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/track',
        payload: {
          experimentId: EXP_ID,
          variantId: VARIANT_A,
          sessionId: 'sess-track',
          event: 'conversion',
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ ok: true })
      const conversionInsert = insertCalls.find((c) => {
        const v = c.values as Record<string, unknown>
        return v && v.bucket === 'conversion'
      })
      expect(conversionInsert).toBeDefined()
      expect(conversionInsert!.onConflict).toBe(true)
      expect(conversionInsert!.values).toMatchObject({
        testId: EXP_ID,
        variantId: VARIANT_A,
        bucket: 'conversion',
        conversions: 1,
      })
    })

    it('click 事件写入 bucket=click', async () => {
      pushSelect([makeVariant({ id: VARIANT_A, testId: EXP_ID })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/track',
        payload: { experimentId: EXP_ID, variantId: VARIANT_A, sessionId: 's', event: 'click' },
      })
      expect(res.statusCode).toBe(200)
      const clickInsert = insertCalls.find((c) => {
        const v = c.values as Record<string, unknown>
        return v && v.bucket === 'click'
      })
      expect(clickInsert).toBeDefined()
    })

    it('变体不属于实验返回 400', async () => {
      pushSelect([makeVariant({ id: VARIANT_A, testId: '99999999-9999-4999-8999-999999999999' })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/track',
        payload: {
          experimentId: EXP_ID,
          variantId: VARIANT_A,
          sessionId: 's',
          event: 'conversion',
        },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. stats 聚合计算
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/ab-testing/stats', () => {
    it('按变体聚合曝光/转化,并计算转化率(四舍五入 2 位)', async () => {
      // 1) 实验存在校验
      pushSelect([makeExperiment({ status: 'active' })])
      // 2) 聚合行
      pushSelect([
        { variantId: VARIANT_A, bucket: 'exposure', samples: 100, conversions: 0 },
        { variantId: VARIANT_A, bucket: 'conversion', samples: 0, conversions: 10 },
        { variantId: VARIANT_B, bucket: 'exposure', samples: 200, conversions: 0 },
        { variantId: VARIANT_B, bucket: 'click', samples: 0, conversions: 50 },
      ])
      // 3) 变体名
      pushSelect([
        { id: VARIANT_A, name: '变体 A' },
        { id: VARIANT_B, name: '变体 B' },
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/api/ab-testing/stats?experimentId=${EXP_ID}`,
      })

      expect(res.statusCode).toBe(200)
      const { stats } = res.json().data
      expect(stats).toHaveLength(2)
      expect(stats[0]).toEqual({
        variantId: VARIANT_A,
        variantName: '变体 A',
        exposureCount: 100,
        conversionCount: 10,
        conversionRate: 0.1,
      })
      expect(stats[1]).toEqual({
        variantId: VARIANT_B,
        variantName: '变体 B',
        exposureCount: 200,
        conversionCount: 0, // click 不计转化
        conversionRate: 0,
      })
    })

    it('无曝光时转化率为 0', async () => {
      pushSelect([makeExperiment({ status: 'active' })])
      pushSelect([{ variantId: VARIANT_A, bucket: 'conversion', samples: 0, conversions: 5 }])
      pushSelect([{ id: VARIANT_A, name: '变体 A' }])

      const res = await app.inject({
        method: 'GET',
        url: `/api/ab-testing/stats?experimentId=${EXP_ID}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.stats[0]).toEqual({
        variantId: VARIANT_A,
        variantName: '变体 A',
        exposureCount: 0,
        conversionCount: 5,
        conversionRate: 0,
      })
    })

    it('转化率四舍五入 2 位', async () => {
      pushSelect([makeExperiment({ status: 'active' })])
      pushSelect([
        { variantId: VARIANT_A, bucket: 'exposure', samples: 3, conversions: 0 },
        { variantId: VARIANT_A, bucket: 'conversion', samples: 0, conversions: 1 },
      ])
      pushSelect([{ id: VARIANT_A, name: '变体 A' }])

      const res = await app.inject({
        method: 'GET',
        url: `/api/ab-testing/stats?experimentId=${EXP_ID}`,
      })
      expect(res.statusCode).toBe(200)
      // 1/3 = 0.3333 → 0.33
      expect(res.json().data.stats[0].conversionRate).toBe(0.33)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 6. 非 active 实验 assign 400
  // ─────────────────────────────────────────────────────────────
  describe('assign 实验状态校验', () => {
    it('draft 实验 assign 返回 400', async () => {
      pushSelect([makeExperiment({ status: 'draft' })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-draft' },
      })
      expect(res.statusCode).toBe(400)
      expect(String(res.json().message)).toContain('active')
    })

    it('ended 实验 assign 返回 400', async () => {
      pushSelect([makeExperiment({ status: 'ended', startedAt: new Date(), endedAt: new Date() })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-ended' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('不存在的实验 assign 返回 404', async () => {
      pushSelect([])
      const res = await app.inject({
        method: 'POST',
        url: '/api/ab-testing/assign',
        payload: { experimentId: EXP_ID, sessionId: 'sess-none' },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

/** db.select() 已发起的调用次数(mock 层计数)。 */
function selectCalls(): number {
  return selectCallCount.value
}

/** db.insert() 已发起的调用次数。 */
function dbInsertCount(): number {
  return insertCalls.length
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
