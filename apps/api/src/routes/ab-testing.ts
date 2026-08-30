/**
 * A/B 测试引擎(管理 + 运行时)路由。
 *
 * 表结构(packages/database/src/schema/ab-tests.ts):
 *   ab_tests            实验主表(draft / active / ended)
 *   ab_test_variants    实验变体(traffic_weight 为百分比权重)
 *   ab_test_results     变体统计聚合表(非事件日志表)
 *                       —— bucket 列承载事件类型(exposure / conversion / click),
 *                          samples 累计曝光次数,conversions 累计转化次数。
 *
 * assign 幂等:同一 userId/sessionId 1 小时内重复分配返回相同变体,
 * 由模块级内存 Map 缓存实现(key = `exp:{userId}:{sessionId}`,TTL 1h)。
 * user_id / session_id 仅作为幂等键参与缓存,不落库(表无对应列)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, desc, count, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { abTests, abTestVariants, abTestResults } from '@ihui/database'

// =============================================================================
// 常量
// =============================================================================

const EXPERIMENT_STATUSES = ['draft', 'active', 'ended'] as const
type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

const TRACK_EVENTS = ['conversion', 'click'] as const

/** ab_test_results.bucket 中 exposure 桶(曝光计数)。 */
const BUCKET_EXPOSURE = 'exposure'

/** 幂等分配缓存 TTL:1 小时。 */
const ASSIGN_CACHE_TTL_MS = 60 * 60 * 1000

// =============================================================================
// 幂等分配缓存(模块级内存 Map)
// =============================================================================

interface AssignmentCacheEntry {
  variantId: string
  variantName: string
  expiresAt: number
}

const assignmentCache = new Map<string, AssignmentCacheEntry>()

function cacheKey(userId: string | undefined, sessionId: string): string {
  return `exp:${userId ?? ''}:${sessionId}`
}

function readCachedAssignment(key: string): AssignmentCacheEntry | undefined {
  const entry = assignmentCache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    assignmentCache.delete(key)
    return undefined
  }
  return entry
}

function writeCachedAssignment(key: string, value: Omit<AssignmentCacheEntry, 'expiresAt'>): void {
  // 惰性清理过期条目,避免 Map 无限增长
  if (assignmentCache.size >= 10_000) {
    const now = Date.now()
    for (const [k, v] of assignmentCache) {
      if (v.expiresAt <= now) assignmentCache.delete(k)
    }
  }
  assignmentCache.set(key, {
    ...value,
    expiresAt: Date.now() + ASSIGN_CACHE_TTL_MS,
  })
}

/** 仅供测试清空幂等缓存。 */
export function __clearAssignmentCacheForTests(): void {
  assignmentCache.clear()
}

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const variantInputSchema = z.object({
  name: z.string().min(1).max(255, { error: '变体名称不能超过 255 字符' }),
  weight: z.number().int().min(1).max(100, { error: '权重必须为 1-100 的整数百分比' }),
})

const createExperimentSchema = z.object({
  name: z.string().min(1).max(255, { error: '实验名称不能为空' }),
  description: z.string().max(2000).optional(),
  status: z.enum(EXPERIMENT_STATUSES).default('draft'),
  variants: z
    .array(variantInputSchema)
    .min(1, { error: '至少需要 1 个变体' })
    .max(50, { error: '变体数量不能超过 50' })
    .refine((variants) => variants.reduce((sum, v) => sum + v.weight, 0) === 100, {
      message: '变体权重总和必须为 100',
    }),
})

const updateExperimentSchema = z.object({
  name: z.string().min(1).max(255, { error: '实验名称不能为空' }).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const appendVariantSchema = z.object({
  name: z.string().min(1).max(255, { error: '变体名称不能为空' }),
  weight: z.number().int().min(1).max(100, { error: '权重必须为 1-100 的整数百分比' }),
})

const assignSchema = z.object({
  experimentId: z.uuid({ error: '无效的实验 ID' }),
  userId: z.string().max(64).optional(),
  sessionId: z.string().min(1).max(128, { error: 'sessionId 不能为空' }),
})

const trackSchema = z.object({
  experimentId: z.uuid({ error: '无效的实验 ID' }),
  variantId: z.uuid({ error: '无效的变体 ID' }),
  userId: z.string().max(64).optional(),
  sessionId: z.string().min(1).max(128, { error: 'sessionId 不能为空' }),
  event: z.enum(TRACK_EVENTS, { error: 'event 必须为 conversion 或 click' }),
})

const statsQuerySchema = z.object({
  experimentId: z.uuid({ error: '无效的实验 ID' }),
})

// =============================================================================
// 内部查询
// =============================================================================

function pickStatusTimes(status: ExperimentStatus, previous?: ExperimentStatus) {
  const now = new Date()
  const times: { startedAt?: Date; endedAt?: Date } = {}
  if (status === 'active' && previous !== 'active') times.startedAt = now
  if (status === 'ended' && previous !== 'ended') {
    if (previous === 'draft') times.startedAt = now
    times.endedAt = now
  }
  return times
}

function serializeVariant(v: {
  id: string
  testId: string
  name: string
  description: string | null
  isControl: boolean
  trafficWeight: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: v.id,
    testId: v.testId,
    name: v.name,
    description: v.description,
    isControl: v.isControl,
    weight: v.trafficWeight,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}

// =============================================================================
// 路由
// =============================================================================

export const abTestingRoutes: FastifyPluginAsync = async (server) => {
  // ---------------------------------------------------------------------------
  // POST /ab-testing/experiments — 创建实验(事务:ab_tests + ab_test_variants)
  // ---------------------------------------------------------------------------
  server.post('/ab-testing/experiments', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createExperimentSchema, request.body)
    const testId = randomUUID()
    const status = body.status

    const experiment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(abTests)
        .values({
          id: testId,
          name: body.name.trim(),
          description: body.description ?? null,
          status,
          trafficPercent: 100,
          targetMetric: 'conversion',
          startedAt: status === 'active' ? new Date() : null,
          endedAt: status === 'ended' ? new Date() : null,
        })
        .returning()
      const variants = body.variants.map((v, index) => ({
        id: randomUUID(),
        testId,
        name: v.name.trim(),
        isControl: index === 0,
        trafficWeight: v.weight,
      }))
      await tx.insert(abTestVariants).values(variants)
      return { experiment: created, variants }
    })

    return reply.status(201).send(
      success({
        experiment: experiment.experiment,
        variants: experiment.variants,
      }),
    )
  })

  // ---------------------------------------------------------------------------
  // GET /ab-testing/experiments — 实验列表(分页,含变体数)
  // ---------------------------------------------------------------------------
  server.get('/ab-testing/experiments', { preHandler: requireAdmin }, async (request, reply) => {
    const { page, pageSize } = parseOrThrow(listQuerySchema, request.query)

    const totalRows = await db.select({ value: count() }).from(abTests)
    const total = totalRows[0]?.value ?? 0
    const list = await db
      .select({
        id: abTests.id,
        name: abTests.name,
        description: abTests.description,
        status: abTests.status,
        startedAt: abTests.startedAt,
        endedAt: abTests.endedAt,
        createdAt: abTests.createdAt,
        updatedAt: abTests.updatedAt,
      })
      .from(abTests)
      .orderBy(desc(abTests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    // 变体数(按 testId 分组)
    const ids = list.map((item) => item.id)
    let variantCounts: Array<{ testId: string; variantCount: number }> = []
    if (ids.length > 0) {
      variantCounts = await db
        .select({ testId: abTestVariants.testId, variantCount: count() })
        .from(abTestVariants)
        .where(inArray(abTestVariants.testId, ids))
        .groupBy(abTestVariants.testId)
    }
    const countMap = new Map(variantCounts.map((c) => [c.testId, c.variantCount]))

    return reply.send(
      success({
        items: list.map((item) => ({
          ...item,
          variantCount: countMap.get(item.id) ?? 0,
        })),
        total,
        page,
        pageSize,
      }),
    )
  })

  // ---------------------------------------------------------------------------
  // GET /ab-testing/experiments/:id — 实验详情(含变体)
  // ---------------------------------------------------------------------------
  server.get(
    '/ab-testing/experiments/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const experiments = await db.select().from(abTests).where(eq(abTests.id, id))
      const experiment = experiments[0]
      if (!experiment) return reply.status(404).send(error(404, '实验不存在'))

      const variants = await db
        .select()
        .from(abTestVariants)
        .where(eq(abTestVariants.testId, id))
        .orderBy(desc(abTestVariants.createdAt))

      return reply.send(
        success({
          experiment,
          variants: variants.map((v) => serializeVariant(v)),
        }),
      )
    },
  )

  // ---------------------------------------------------------------------------
  // PATCH /ab-testing/experiments/:id — 更新实验(name/description/status)
  // ---------------------------------------------------------------------------
  server.patch(
    '/ab-testing/experiments/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const rawBody = (request.body ?? {}) as Record<string, unknown>
      // 权重只能通过创建/追加变体维护,禁止通过更新实验接口修改(含 active/ended 后)
      if (rawBody.variants !== undefined) {
        return reply.status(400).send(error(400, '不允许通过更新实验修改变体权重'))
      }
      const body = parseOrThrow(updateExperimentSchema, rawBody)

      const experiments = await db.select().from(abTests).where(eq(abTests.id, id))
      const existing = experiments[0]
      if (!existing) return reply.status(404).send(error(404, '实验不存在'))

      const set: Record<string, unknown> = {}
      if (body.name !== undefined) set.name = body.name.trim()
      if (body.description !== undefined) set.description = body.description ?? null
      if (body.status !== undefined) {
        set.status = body.status
        Object.assign(set, pickStatusTimes(body.status, existing.status as ExperimentStatus))
      }

      const [updated] = await db
        .update(abTests)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(abTests.id, id))
        .returning()
      if (!updated) return reply.status(500).send(error(500, '更新实验失败'))

      return reply.send(success({ experiment: updated }))
    },
  )

  // ---------------------------------------------------------------------------
  // POST /ab-testing/experiments/:id/variants — 追加变体(仅 draft 状态)
  // ---------------------------------------------------------------------------
  server.post(
    '/ab-testing/experiments/:id/variants',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(appendVariantSchema, request.body)

      const experiments = await db.select().from(abTests).where(eq(abTests.id, id))
      const existing = experiments[0]
      if (!existing) return reply.status(404).send(error(404, '实验不存在'))
      if (existing.status !== 'draft') {
        return reply.status(400).send(error(400, '仅 draft 状态的实验允许追加变体'))
      }

      // 校验追加后权重总和不超过 100
      const currentVariants = await db
        .select({ trafficWeight: abTestVariants.trafficWeight })
        .from(abTestVariants)
        .where(eq(abTestVariants.testId, id))
      const currentTotal = currentVariants.reduce((sum, v) => sum + (v.trafficWeight ?? 0), 0)
      if (currentTotal + body.weight > 100) {
        return reply
          .status(400)
          .send(error(400, `追加后变体权重总和不能超过 100(当前 ${currentTotal})`))
      }

      const [variant] = await db
        .insert(abTestVariants)
        .values({
          id: randomUUID(),
          testId: id,
          name: body.name.trim(),
          isControl: false,
          trafficWeight: body.weight,
        })
        .returning()
      if (!variant) return reply.status(500).send(error(500, '追加变体失败'))

      return reply.status(201).send(success({ variant: serializeVariant(variant) }))
    },
  )

  // ---------------------------------------------------------------------------
  // POST /ab-testing/assign — 加权随机分配(幂等,记录 exposure)
  // ---------------------------------------------------------------------------
  server.post('/ab-testing/assign', async (request, reply) => {
    const body = parseOrThrow(assignSchema, request.body)
    const key = cacheKey(body.userId, body.sessionId)

    // 幂等:同一 userId/sessionId 1 小时内返回相同变体
    const cached = readCachedAssignment(key)
    if (cached) {
      return reply.send(success({ variantId: cached.variantId, variantName: cached.variantName }))
    }

    const experiments = await db.select().from(abTests).where(eq(abTests.id, body.experimentId))
    const experiment = experiments[0]
    if (!experiment) return reply.status(404).send(error(404, '实验不存在'))
    if (experiment.status !== 'active') {
      return reply.status(400).send(error(400, '实验未处于 active 状态,无法分配流量'))
    }

    const variants = await db
      .select()
      .from(abTestVariants)
      .where(eq(abTestVariants.testId, body.experimentId))
    if (variants.length === 0) {
      return reply.status(500).send(error(500, '实验没有任何变体'))
    }

    // 按权重加权随机
    const totalWeight = variants.reduce((sum, v) => sum + (v.trafficWeight ?? 0), 0)
    let rand = Math.random() * (totalWeight > 0 ? totalWeight : 100)
    let selected = variants[0]!
    for (const v of variants) {
      rand -= v.trafficWeight ?? 0
      if (rand < 0) {
        selected = v
        break
      }
    }

    // 记录曝光(ab_test_results 聚合表:bucket='exposure',samples+1)
    await db
      .insert(abTestResults)
      .values({
        id: randomUUID(),
        testId: body.experimentId,
        variantId: selected.id,
        bucket: BUCKET_EXPOSURE,
        samples: 1,
        conversions: 0,
        revenue: 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [abTestResults.variantId, abTestResults.bucket],
        set: {
          samples: sql`${abTestResults.samples} + 1`,
          updatedAt: new Date(),
        },
      })

    writeCachedAssignment(key, { variantId: selected.id, variantName: selected.name })

    return reply.send(success({ variantId: selected.id, variantName: selected.name }))
  })

  // ---------------------------------------------------------------------------
  // POST /ab-testing/track — 记录转化/点击事件
  // ---------------------------------------------------------------------------
  server.post('/ab-testing/track', async (request, reply) => {
    const body = parseOrThrow(trackSchema, request.body)

    // 校验变体属于该实验
    const variants = await db
      .select()
      .from(abTestVariants)
      .where(eq(abTestVariants.id, body.variantId))
    const variant = variants[0]
    if (!variant) return reply.status(404).send(error(404, '变体不存在'))
    if (variant.testId !== body.experimentId) {
      return reply.status(400).send(error(400, '变体不属于该实验'))
    }

    // 记录事件(conversion / click),conversions 列累计
    await db
      .insert(abTestResults)
      .values({
        id: randomUUID(),
        testId: body.experimentId,
        variantId: body.variantId,
        bucket: body.event,
        samples: 0,
        conversions: 1,
        revenue: 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [abTestResults.variantId, abTestResults.bucket],
        set: {
          conversions: sql`${abTestResults.conversions} + 1`,
          updatedAt: new Date(),
        },
      })

    return reply.send(success({ ok: true }))
  })

  // ---------------------------------------------------------------------------
  // GET /ab-testing/stats — 按变体聚合统计
  // ---------------------------------------------------------------------------
  server.get('/ab-testing/stats', async (request, reply) => {
    const { experimentId } = parseOrThrow(statsQuerySchema, request.query)

    const experiments = await db.select().from(abTests).where(eq(abTests.id, experimentId))
    if (!experiments[0]) return reply.status(404).send(error(404, '实验不存在'))

    const [rows, variants] = await Promise.all([
      db
        .select({
          variantId: abTestResults.variantId,
          bucket: abTestResults.bucket,
          samples: sql<number>`COALESCE(SUM(${abTestResults.samples}), 0)`,
          conversions: sql<number>`COALESCE(SUM(${abTestResults.conversions}), 0)`,
        })
        .from(abTestResults)
        .where(eq(abTestResults.testId, experimentId))
        .groupBy(abTestResults.variantId, abTestResults.bucket),
      db
        .select({ id: abTestVariants.id, name: abTestVariants.name })
        .from(abTestVariants)
        .where(eq(abTestVariants.testId, experimentId)),
    ])

    const perVariant = new Map<string, { exposureCount: number; conversionCount: number }>()
    for (const row of rows) {
      const current = perVariant.get(row.variantId) ?? {
        exposureCount: 0,
        conversionCount: 0,
      }
      if (row.bucket === BUCKET_EXPOSURE) current.exposureCount += row.samples
      else if (row.bucket === 'conversion') current.conversionCount += row.conversions
      perVariant.set(row.variantId, current)
    }

    const stats = variants.map((v) => {
      const s = perVariant.get(v.id) ?? { exposureCount: 0, conversionCount: 0 }
      return {
        variantId: v.id,
        variantName: v.name,
        exposureCount: s.exposureCount,
        conversionCount: s.conversionCount,
        conversionRate:
          s.exposureCount > 0 ? Number((s.conversionCount / s.exposureCount).toFixed(2)) : 0,
      }
    })

    return reply.send(success({ stats }))
  })
}

export default abTestingRoutes
