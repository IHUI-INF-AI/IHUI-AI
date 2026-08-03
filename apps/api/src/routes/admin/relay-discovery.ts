/**
 * /api/admin/relay/discovery 中转站动态发现审批(P0-5c,2026-07-29 立)。
 *
 * 端点清单:
 * 1. POST   /admin/relay/discovery/scan       — 触发从指定 provider 拉取上游模型列表
 * 2. GET    /admin/relay/discovery/pending    — 待审批模型列表(分页 + 筛选 provider/status)
 * 3. POST   /admin/relay/discovery/:id/approve — 审批通过(写入 aiModelConfigModels + 标记 approved)
 * 4. POST   /admin/relay/discovery/:id/reject  — 驳回
 *
 * 复用 ai_relay_discovery 表;扫描时从 ai-service /api/llm/models 或 provider 上游拉取。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dbRead } from '../../db/index.js'
import { aiRelayDiscovery, aiModelConfig, aiModelConfigModels } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { config } from '../../config/index.js'
import { paginationSchema, idParamSchema } from './_shared.js'

const scanBodySchema = z.object({
  /** 来源 provider 编码(如 'stepfun' / 'openrouter') */
  providerCode: z.string().min(1).max(64),
  /** 关联到 ai_model_config.id(写入 aiModelConfigModels 时用) */
  configId: z.number().int().positive(),
})

const listQuerySchema = paginationSchema.extend({
  provider: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  status: z.transform(emptyToUndefined).pipe(
    z.enum(['discovered', 'pending', 'approved', 'rejected']).optional(),
  ),
})

const approveBodySchema = z.object({
  /** 审批通过时可选:覆盖中转站定价倍率(默认 1.0) */
  relayPriceMultiplier: z.string().max(20).optional(),
  /** 审批通过时可选:覆盖展示名 */
  relayDisplayName: z.string().max(256).optional(),
  /** 审批备注 */
  reviewNote: z.string().optional(),
})

const rejectBodySchema = z.object({
  reviewNote: z.string().min(1).max(500, '驳回原因不能为空'),
})

const relayDiscoveryRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. POST /admin/relay/discovery/scan — 触发从 provider 拉取上游模型列表 =====
  server.post('/admin/relay/discovery/scan', async (request, reply) => {
    const parsed = scanBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { providerCode, configId } = parsed.data

    // 验证 configId 存在且 providerCode 匹配
    const [configRow] = await dbRead
      .select({ id: aiModelConfig.id, providerCode: aiModelConfig.providerCode })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, configId))
      .limit(1)
    if (!configRow) return reply.status(404).send(error(404, 'ai_model_config 行不存在'))
    if (configRow.providerCode !== providerCode)
      return reply.status(400).send(error(400, 'providerCode 与 configId 不匹配'))

    // 从 ai-service 拉取上游模型列表
    let upstreamModels: Array<{
      id: string
      name?: string
      context_length?: number
      input_price?: number
      output_price?: number
      description?: string
      capabilities?: string[]
    }> = []
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, { method: 'GET' })
      if (resp.ok) {
        const data = (await resp.json()) as unknown
        if (Array.isArray(data)) upstreamModels = data as typeof upstreamModels
        else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>
          if (Array.isArray(obj.data)) upstreamModels = obj.data as typeof upstreamModels
          else if (Array.isArray(obj.models)) upstreamModels = obj.models as typeof upstreamModels
        }
      }
    } catch (e) {
      request.log.error(e)
      return reply.status(503).send(error(503, '拉取上游模型列表失败(ai-service 不可用)'))
    }

    if (upstreamModels.length === 0) {
      return reply.send(success({ scanned: 0, newDiscovered: 0, message: '上游返回空模型列表' }))
    }

    // 写入 ai_relay_discovery(ON CONFLICT 不重复插入)
    let newDiscovered = 0
    for (const m of upstreamModels) {
      if (!m.id) continue
      try {
        await db
          .insert(aiRelayDiscovery)
          .values({
            providerCode,
            modelId: m.id,
            modelName: m.name ?? null,
            contextLength: m.context_length ?? null,
            upstreamPrice: m.input_price || m.output_price
              ? {
                  input: m.input_price ?? 0,
                  output: m.output_price ?? 0,
                  currency: 'CNY',
                }
              : null,
            capabilities: m.capabilities ?? [],
            description: m.description ?? null,
            status: 'discovered',
            rawMetadata: m as unknown as Record<string, unknown>,
          })
          .onConflictDoNothing({
            target: [aiRelayDiscovery.providerCode, aiRelayDiscovery.modelId],
          })
        newDiscovered++
      } catch {
        // 已存在则跳过(onConflictDoNothing 应已处理)
      }
    }

    return reply.send(
      success({
        scanned: upstreamModels.length,
        newDiscovered,
        providerCode,
        configId,
      }),
    )
  })

  // ===== 2. GET /admin/relay/discovery/pending — 待审批模型列表 =====
  server.get('/admin/relay/discovery/pending', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, provider, status } = q.data

    const conds: ReturnType<typeof eq>[] = []
    if (provider) conds.push(eq(aiRelayDiscovery.providerCode, provider))
    if (status) conds.push(eq(aiRelayDiscovery.status, status))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search
      ? or(
          ilike(aiRelayDiscovery.modelId, `%${search}%`),
          ilike(aiRelayDiscovery.modelName, `%${search}%`),
        )
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select()
          .from(aiRelayDiscovery)
          .where(finalWhere)
          .orderBy(desc(aiRelayDiscovery.discoveredAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayDiscovery)
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询待审批模型列表失败'))
    }
  })

  // ===== 3. POST /admin/relay/discovery/:id/approve — 审批通过(写入 aiModelConfigModels + 上架) =====
  server.post('/admin/relay/discovery/:id/approve', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = approveBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const [discovery] = await dbRead
        .select()
        .from(aiRelayDiscovery)
        .where(eq(aiRelayDiscovery.id, p.data.id))
        .limit(1)
      if (!discovery) return reply.status(404).send(error(404, '待审批记录不存在'))
      if (discovery.status === 'approved')
        return reply.status(400).send(error(400, '该记录已审批通过'))

      // 查关联的 aiModelConfig(configId 由 scan 时记录,这里通过 providerCode 反查第一个 enabled 的 config)
      const [configRow] = await dbRead
        .select({ id: aiModelConfig.id })
        .from(aiModelConfig)
        .where(
          and(
            eq(aiModelConfig.providerCode, discovery.providerCode),
            eq(aiModelConfig.enabled, true),
          ),
        )
        .orderBy(aiModelConfig.sortOrder)
        .limit(1)
      if (!configRow)
        return reply
          .status(400)
          .send(error(400, `未找到 providerCode=${discovery.providerCode} 的启用配置`))

      // 查 aiModelConfigModels 是否已有该 modelId(避免 unique 冲突)
      const [existingModel] = await dbRead
        .select({ id: aiModelConfigModels.id, isRelayPublic: aiModelConfigModels.isRelayPublic })
        .from(aiModelConfigModels)
        .where(
          and(
            eq(aiModelConfigModels.configId, configRow.id),
            eq(aiModelConfigModels.modelId, discovery.modelId),
          ),
        )
        .limit(1)

      let approvedModelRowId: number
      if (existingModel) {
        // 已存在,只更新 isRelayPublic=true + 中转站字段
        const [updated] = await db
          .update(aiModelConfigModels)
          .set({
            isRelayPublic: true,
            relayPriceMultiplier: parsed.data.relayPriceMultiplier ?? '1.0000',
            relayDisplayName: parsed.data.relayDisplayName ?? null,
            updatedAt: new Date(),
          })
          .where(eq(aiModelConfigModels.id, existingModel.id))
          .returning({ id: aiModelConfigModels.id })
        approvedModelRowId = updated!.id
      } else {
        // 不存在,插入新行
        const upstreamPrice = discovery.upstreamPrice as
          | { input?: number; output?: number }
          | null
        const [inserted] = await db
          .insert(aiModelConfigModels)
          .values({
            configId: configRow.id,
            modelId: discovery.modelId,
            displayName: discovery.modelName ?? discovery.modelId,
            contextLength: discovery.contextLength ?? 32000,
            inputPricePer1k: upstreamPrice?.input ?? 0,
            outputPricePer1k: upstreamPrice?.output ?? 0,
            enabled: true,
            isRelayPublic: true,
            relayPriceMultiplier: parsed.data.relayPriceMultiplier ?? '1.0000',
            relayDisplayName: parsed.data.relayDisplayName ?? null,
            extraMetadata: { discoveredFrom: discovery.id, capabilities: discovery.capabilities },
          })
          .returning({ id: aiModelConfigModels.id })
        approvedModelRowId = inserted!.id
      }

      // 更新 discovery 状态为 approved
      const userId = request.userId
      const [updated] = await db
        .update(aiRelayDiscovery)
        .set({
          status: 'approved',
          reviewedBy: userId ?? null,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reviewNote ?? null,
          approvedModelRowId,
          updatedAt: new Date(),
        })
        .where(eq(aiRelayDiscovery.id, p.data.id))
        .returning()

      return reply.send(success({ discovery: updated, approvedModelRowId }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '审批通过失败'))
    }
  })

  // ===== 4. POST /admin/relay/discovery/:id/reject — 驳回 =====
  server.post('/admin/relay/discovery/:id/reject', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = rejectBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const userId = request.userId
      const [updated] = await db
        .update(aiRelayDiscovery)
        .set({
          status: 'rejected',
          reviewedBy: userId ?? null,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reviewNote,
          updatedAt: new Date(),
        })
        .where(eq(aiRelayDiscovery.id, p.data.id))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '待审批记录不存在'))
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '驳回失败'))
    }
  })
}

export default relayDiscoveryRoutes
