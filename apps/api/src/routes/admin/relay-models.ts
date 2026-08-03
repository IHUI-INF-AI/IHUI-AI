/**
 * /api/admin/relay/models 中转站模型管理(P0-5b,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET    /admin/relay/models         — 中转站模型列表(分页 + 筛选上架/厂商/搜索)
 * 2. POST   /admin/relay/models         — 添加模型到中转站(关联 aiModelConfigModels)
 * 3. PUT    /admin/relay/models/:id     — 更新定价倍率/上下架/可见性/排序
 * 4. DELETE /admin/relay/models/:id     — 下架模型(isRelayPublic=false,不删行)
 * 5. POST   /admin/relay/models/:id/toggle — 快速上下架切换
 * 6. GET    /admin/relay/models/stats   — 统计(总模型数/上架数/厂商分布/近 30 天调用量)
 *
 * 复用 ai_model_config_models 表 + isRelayPublic/relayPriceMultiplier/relaySortOrder/relayDisplayName 字段。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, ilike, desc, sql, gte, isNull, type SQL } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dbRead } from '../../db/index.js'
import {
  aiModelConfigModels,
  aiModelConfig,
  llmCallLogs,
} from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'

const listQuerySchema = paginationSchema.extend({
  /** 上架状态:all / public / private */
  status: z.transform(emptyToUndefined).pipe(z.enum(['all', 'public', 'private']).optional()),
  /** 厂商筛选(providerCode) */
  provider: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  /** configId 筛选(关联到指定 ai_model_config) */
  configId: z.transform(emptyToUndefined).pipe(z.coerce.number().int().optional()),
})

const createBodySchema = z.object({
  /** 关联 aiModelConfigModels.id(将现有模型上架到中转站) */
  modelRowId: z.number().int().positive(),
  /** 中转站定价倍率(1.0=原价,1.2=加价 20%) */
  relayPriceMultiplier: z.string().max(20).optional(),
  /** 中转站展示排序(越小越靠前) */
  relaySortOrder: z.number().int().optional(),
  /** 中转站展示名(为空用 displayName/modelId) */
  relayDisplayName: z.string().max(256).optional(),
})

const updateBodySchema = z.object({
  isRelayPublic: z.boolean().optional(),
  relayPriceMultiplier: z.string().max(20).optional(),
  relaySortOrder: z.number().int().optional(),
  relayDisplayName: z.string().max(256).nullable().optional(),
})

/** BYOK 抽成率更新(0~1,3 位小数;0.10=10%) */
const commissionUpdateSchema = z.object({
  byokCommissionRate: z
    .number()
    .min(0, '抽成率不能小于 0')
    .max(1, '抽成率不能大于 1')
    .refine((v) => Math.round(v * 1000) === v * 1000, '最多 3 位小数'),
})

/** 全局 provider BYOK 抽成配置行(owner_uuid IS NULL) */
interface CommissionRow {
  providerCode: string
  byokCommissionRate: number
  isEnabled: boolean
}

const relayModelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/models — 中转站模型列表 =====
  server.get('/admin/relay/models', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, status, provider, configId } = q.data

    const conds: SQL[] = []
    if (status === 'public') conds.push(eq(aiModelConfigModels.isRelayPublic, true))
    if (status === 'private') conds.push(eq(aiModelConfigModels.isRelayPublic, false))
    if (configId) conds.push(eq(aiModelConfigModels.configId, configId))
    if (provider) conds.push(eq(aiModelConfig.providerCode, provider))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search
      ? or(
          ilike(aiModelConfigModels.modelId, `%${search}%`),
          ilike(aiModelConfigModels.displayName, `%${search}%`),
          ilike(aiModelConfigModels.relayDisplayName, `%${search}%`),
        )
      : undefined

    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: aiModelConfigModels.id,
            configId: aiModelConfigModels.configId,
            modelId: aiModelConfigModels.modelId,
            displayName: aiModelConfigModels.displayName,
            enabled: aiModelConfigModels.enabled,
            inputPricePer1k: aiModelConfigModels.inputPricePer1k,
            outputPricePer1k: aiModelConfigModels.outputPricePer1k,
            contextLength: aiModelConfigModels.contextLength,
            isRelayPublic: aiModelConfigModels.isRelayPublic,
            relayPriceMultiplier: aiModelConfigModels.relayPriceMultiplier,
            relaySortOrder: aiModelConfigModels.relaySortOrder,
            relayDisplayName: aiModelConfigModels.relayDisplayName,
            updatedAt: aiModelConfigModels.updatedAt,
            providerCode: aiModelConfig.providerCode,
            configName: aiModelConfig.name,
            configEnabled: aiModelConfig.enabled,
          })
          .from(aiModelConfigModels)
          .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
          .where(finalWhere)
          .orderBy(desc(aiModelConfigModels.isRelayPublic), aiModelConfigModels.relaySortOrder, aiModelConfigModels.modelId)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiModelConfigModels)
          .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询中转站模型列表失败'))
    }
  })

  // ===== 6. GET /admin/relay/models/stats — 统计(放在 :id 之前避免路由冲突) =====
  server.get('/admin/relay/models/stats', async (_request, reply) => {
    try {
      const [totalRow] = await dbRead
        .select({ total: sql<number>`count(*)::int` })
        .from(aiModelConfigModels)
      const [publicRow] = await dbRead
        .select({ total: sql<number>`count(*)::int` })
        .from(aiModelConfigModels)
        .where(eq(aiModelConfigModels.isRelayPublic, true))

      // 厂商分布
      const providerDist = await dbRead
        .select({
          providerCode: aiModelConfig.providerCode,
          count: sql<number>`count(*)::int`,
        })
        .from(aiModelConfigModels)
        .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
        .where(eq(aiModelConfigModels.isRelayPublic, true))
        .groupBy(aiModelConfig.providerCode)
        .orderBy(desc(sql`count(*)::int`))

      // 近 30 天调用量
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const [callRow] = await dbRead
        .select({
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
        })
        .from(llmCallLogs)
        .where(gte(llmCallLogs.createdAt, thirtyDaysAgo))

      return reply.send(
        success({
          totalModels: totalRow?.total ?? 0,
          publicModels: publicRow?.total ?? 0,
          privateModels: (totalRow?.total ?? 0) - (publicRow?.total ?? 0),
          providerDistribution: providerDist,
          last30dCalls: callRow?.callCount ?? 0,
          last30dTokens: callRow?.totalTokens ?? 0,
        }),
      )
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询中转站统计失败'))
    }
  })

  // ===== 2. POST /admin/relay/models — 添加模型到中转站(上架现有 modelRowId) =====
  server.post('/admin/relay/models', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { modelRowId, relayPriceMultiplier, relaySortOrder, relayDisplayName } = parsed.data

    try {
      const [updated] = await db
        .update(aiModelConfigModels)
        .set({
          isRelayPublic: true,
          relayPriceMultiplier: relayPriceMultiplier ?? '1.0000',
          relaySortOrder: relaySortOrder ?? 0,
          relayDisplayName: relayDisplayName ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfigModels.id, modelRowId))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '模型行不存在'))
      return reply.status(201).send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '添加中转站模型失败'))
    }
  })

  // ===== 3. PUT /admin/relay/models/:id — 更新定价倍率/上下架/可见性/排序 =====
  server.put('/admin/relay/models/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const setData: Record<string, unknown> = { updatedAt: new Date() }
    const d = parsed.data
    if (d.isRelayPublic !== undefined) setData.isRelayPublic = d.isRelayPublic
    if (d.relayPriceMultiplier !== undefined) setData.relayPriceMultiplier = d.relayPriceMultiplier
    if (d.relaySortOrder !== undefined) setData.relaySortOrder = d.relaySortOrder
    if (d.relayDisplayName !== undefined) setData.relayDisplayName = d.relayDisplayName

    try {
      const [updated] = await db
        .update(aiModelConfigModels)
        .set(setData)
        .where(eq(aiModelConfigModels.id, Number(p.data.id)))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '模型行不存在'))
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新中转站模型失败'))
    }
  })

  // ===== 4. DELETE /admin/relay/models/:id — 下架模型(isRelayPublic=false,不删行) =====
  server.delete('/admin/relay/models/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [updated] = await db
        .update(aiModelConfigModels)
        .set({ isRelayPublic: false, updatedAt: new Date() })
        .where(eq(aiModelConfigModels.id, Number(p.data.id)))
        .returning({ id: aiModelConfigModels.id })
      if (!updated) return reply.status(404).send(error(404, '模型行不存在'))
      return reply.send(success({ id: updated.id, unpublished: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '下架中转站模型失败'))
    }
  })

  // ===== 5. POST /admin/relay/models/:id/toggle — 快速上下架切换 =====
  server.post('/admin/relay/models/:id/toggle', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [existing] = await dbRead
        .select({ isRelayPublic: aiModelConfigModels.isRelayPublic })
        .from(aiModelConfigModels)
        .where(eq(aiModelConfigModels.id, Number(p.data.id)))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '模型行不存在'))

      const [updated] = await db
        .update(aiModelConfigModels)
        .set({ isRelayPublic: !existing.isRelayPublic, updatedAt: new Date() })
        .where(eq(aiModelConfigModels.id, Number(p.data.id)))
        .returning({
          id: aiModelConfigModels.id,
          isRelayPublic: aiModelConfigModels.isRelayPublic,
        })
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换上下架失败'))
    }
  })

  // ===== 7. GET /admin/relay/commission — 全局 provider 的 BYOK 抽成率列表 =====
  server.get('/admin/relay/commission', async (_request, reply) => {
    try {
      const rows = await dbRead
        .select({
          providerCode: aiModelConfig.providerCode,
          byokCommissionRate: aiModelConfig.byokCommissionRate,
          isEnabled: aiModelConfig.enabled,
        })
        .from(aiModelConfig)
        .where(isNull(aiModelConfig.ownerUuid))
        .orderBy(aiModelConfig.providerCode)
      const providers: CommissionRow[] = rows.map((r) => ({
        providerCode: r.providerCode,
        byokCommissionRate: Number(r.byokCommissionRate ?? '0.1000'),
        isEnabled: r.isEnabled,
      }))
      return reply.send(success({ providers }))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询 BYOK 抽成列表失败'))
    }
  })

  // ===== 8. PATCH /admin/relay/commission/:providerCode — upsert BYOK 抽成率 =====
  // 行为:全局配置行(provider_code=X AND owner_uuid IS NULL)存在则 UPDATE,
  //       不存在则 INSERT 一行新的全局配置行(owner_uuid=NULL, enabled=true)
  // 响应:HTTP 200(update) / 201(insert),body 保持 { providerCode, byokCommissionRate }
  // 原因:ai_model_config 无 (providerCode, ownerUuid) 联合唯一约束,无法走 onConflictDoUpdate
  server.patch('/admin/relay/commission/:providerCode', async (request, reply) => {
    const providerCode = (request.params as { providerCode?: string }).providerCode ?? ''
    if (!providerCode) return reply.status(400).send(error(400, 'providerCode 不能为空'))
    const parsed = commissionUpdateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { byokCommissionRate } = parsed.data

    try {
      const result = await db.transaction(async (tx) => {
        // 1) SELECT 全局配置行(LIMIT 1;表无联合唯一约束,需应用层兜底)
        const [existing] = await tx
          .select({ id: aiModelConfig.id })
          .from(aiModelConfig)
          .where(
            and(
              eq(aiModelConfig.providerCode, providerCode),
              isNull(aiModelConfig.ownerUuid),
            ),
          )
          .limit(1)

        if (existing) {
          // 2a) 存在 → UPDATE 抽成率
          const [updated] = await tx
            .update(aiModelConfig)
            .set({
              byokCommissionRate: byokCommissionRate.toFixed(4),
              updatedAt: new Date(),
            })
            .where(eq(aiModelConfig.id, existing.id))
            .returning({
              providerCode: aiModelConfig.providerCode,
              byokCommissionRate: aiModelConfig.byokCommissionRate,
            })
          if (!updated) throw new Error('UPDATE returned no row (concurrent delete?)')
          return { row: updated, created: false as const }
        }

        // 2b) 不存在 → INSERT 新全局配置行
        const [inserted] = await tx
          .insert(aiModelConfig)
          .values({
            name: providerCode,
            providerCode,
            isBuiltin: false,
            baseUrl: '',
            apiFormat: 'openai_chat',
            enabled: true,
            ownerUuid: null,
            byokCommissionRate: byokCommissionRate.toFixed(4),
          })
          .returning({
            providerCode: aiModelConfig.providerCode,
            byokCommissionRate: aiModelConfig.byokCommissionRate,
          })
        if (!inserted) throw new Error('INSERT returned no row')
        return { row: inserted, created: true as const }
      })

      return reply
        .status(result.created ? 201 : 200)
        .send(
          success({
            providerCode: result.row.providerCode,
            byokCommissionRate: Number(result.row.byokCommissionRate ?? '0.1000'),
          }),
        )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新 BYOK 抽成率失败'))
    }
  })
}

export default relayModelsRoutes
