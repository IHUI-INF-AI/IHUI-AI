// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 模型管理 /ai/models(5 个端点:GET 列表/详情 + POST/PUT/DELETE CRUD)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, or, isNull, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { aiModelConfig } from '@ihui/database'
import { authenticate } from '../../plugins/auth.js'
import { isSystemAdmin } from '../../plugins/require-permission.js'
import { parseIdParam } from './_shared.js'

const aiModelCreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().min(1).max(64),
  description: z.string().optional(),
  baseUrl: z.url().optional(),
  type: z.string().max(32).optional(),
  status: z.number().int().min(0).max(1).optional(),
  sort: z.number().int().optional(),
  /** F-96:显式申请创建全局配置(owner_uuid = NULL),仅系统管理员可用。 */
  isGlobal: z.boolean().optional(),
})

const aiModelUpdateSchema = aiModelCreateSchema.partial()

/** 解析 bigint 型模型 ID:非数字返回 null 并发送 400(避免 NaN 查询 500) */
function parseBigintId(request: FastifyRequest, reply: FastifyReply): number | null {
  const rawId = parseIdParam(request, reply)
  if (rawId === null) return null
  if (!/^\d+$/.test(rawId)) {
    reply.status(400).send(error(400, '无效的模型 ID'))
    return null
  }
  return Number(rawId)
}

const aiModelsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai/models', async (request, reply) => {
    // 公开读口径:未带登录态(挂载链兜底)只看到全局配置(owner_uuid IS NULL);
    // 已登录用户额外看到本人的私有配置。鉴权由 routes/user/index.ts 的 preHandler 统一完成。
    // F-96:此前按 enabled 全量返回,任意人可读他人 baseUrl / modelIdForTest。
    const viewerId = request.userId ?? null
    const rows = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        provider: aiModelConfig.providerCode,
        description: aiModelConfig.description,
        type: aiModelConfig.apiFormat,
        status: sql<number>`CASE WHEN ${aiModelConfig.enabled} THEN 1 ELSE 0 END`,
        sort: aiModelConfig.sortOrder,
        baseUrl: aiModelConfig.baseUrl,
        modelIdForTest: aiModelConfig.modelIdForTest,
        ownerUuid: aiModelConfig.ownerUuid,
      })
      .from(aiModelConfig)
      .where(
        and(
          eq(aiModelConfig.enabled, true),
          viewerId
            ? or(isNull(aiModelConfig.ownerUuid), eq(aiModelConfig.ownerUuid, viewerId))
            : isNull(aiModelConfig.ownerUuid),
        ),
      )
      .orderBy(asc(aiModelConfig.sortOrder), asc(aiModelConfig.id))
    return reply.send(
      success({
        list: rows.map(({ ownerUuid, baseUrl, modelIdForTest, ...row }) =>
          viewerId && ownerUuid === viewerId ? { ...row, baseUrl, modelIdForTest } : row,
        ),
      }),
    )
  })

  server.get('/ai/models/:id', async (request, reply) => {
    const id = parseBigintId(request, reply)
    if (id === null) return
    const viewerId = request.userId ?? null
    const [row] = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        provider: aiModelConfig.providerCode,
        description: aiModelConfig.description,
        type: aiModelConfig.apiFormat,
        status: sql<number>`CASE WHEN ${aiModelConfig.enabled} THEN 1 ELSE 0 END`,
        sort: aiModelConfig.sortOrder,
        baseUrl: aiModelConfig.baseUrl,
        modelIdForTest: aiModelConfig.modelIdForTest,
        ownerUuid: aiModelConfig.ownerUuid,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, id))
    // 他人私有配置一律按不存在处理:不泄露存在性,也不回传其 baseUrl / modelIdForTest
    if (!row || (row.ownerUuid !== null && row.ownerUuid !== viewerId)) {
      return reply.status(404).send(error(404, '模型不存在'))
    }
    const { ownerUuid, baseUrl, modelIdForTest, ...safe } = row
    // 本人配置保留完整字段;全局配置只回传公共字段
    if (viewerId && ownerUuid === viewerId) {
      return reply.send(success({ model: { ...safe, baseUrl, modelIdForTest } }))
    }
    return reply.send(success({ model: safe }))
  })

  server.post('/ai/models', async (request, reply) => {
    await authenticate(request)
    const parsed = aiModelCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const d = parsed.data
    // F-96:创建默认落成「本人私有配置」;全局配置(owner_uuid = NULL)必须过管理端闸,
    // 复用全仓唯一的管理员判据(只认人用 JWT),不自造第二把尺子。
    const wantsGlobal = d.isGlobal === true
    if (wantsGlobal && !isSystemAdmin(request, { includeInternalChannel: false })) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
    const ownerUuid = wantsGlobal ? null : (request.userId ?? null)
    if (!wantsGlobal && !ownerUuid) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [row] = await db
      .insert(aiModelConfig)
      .values({
        name: d.name,
        providerCode: d.provider,
        description: d.description,
        apiFormat: d.type ?? 'openai_chat',
        baseUrl: d.baseUrl ?? 'https://api.openai.com',
        enabled: d.status === undefined ? true : d.status === 1,
        sortOrder: d.sort ?? 0,
        ownerUuid,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建 AI 模型失败'))
    return reply.send(
      success({
        id: row.id,
        name: row.name,
        provider: row.providerCode,
        description: row.description,
        type: row.apiFormat,
        status: row.enabled ? 1 : 0,
        sort: row.sortOrder,
      }),
    )
  })

  server.put('/ai/models/:id', async (request, reply) => {
    await authenticate(request)
    const id = parseBigintId(request, reply)
    if (id === null) return
    const parsed = aiModelUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const d = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (d.name !== undefined) updates.name = d.name
    if (d.provider !== undefined) updates.providerCode = d.provider
    if (d.description !== undefined) updates.description = d.description
    if (d.baseUrl !== undefined) updates.baseUrl = d.baseUrl
    if (d.type !== undefined) updates.apiFormat = d.type
    if (d.status !== undefined) updates.enabled = d.status === 1
    if (d.sort !== undefined) updates.sortOrder = d.sort
    const [row] = await db
      .update(aiModelConfig)
      .set(updates)
      .where(
        and(
          eq(aiModelConfig.id, id),
          // 防越权：仅允许 owner 修改自己的自定义模型（内置模型 ownerUuid 为空，同样被挡）
          eq(aiModelConfig.ownerUuid, request.userId!),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send(error(404, '模型不存在'))
    return reply.send(
      success({
        id: row.id,
        name: row.name,
        provider: row.providerCode,
        description: row.description,
        type: row.apiFormat,
        status: row.enabled ? 1 : 0,
        sort: row.sortOrder,
      }),
    )
  })

  server.delete('/ai/models/:id', async (request, reply) => {
    await authenticate(request)
    const id = parseBigintId(request, reply)
    if (id === null) return
    // 防越权：查询与删除均限定 owner，他人模型与内置模型统一返回 404，不泄露存在性
    const [row] = await db
      .select({ id: aiModelConfig.id, isBuiltin: aiModelConfig.isBuiltin })
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, request.userId!)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '模型不存在'))
    if (row.isBuiltin) return reply.status(403).send(error(403, '内置模型不可删除'))
    await db
      .delete(aiModelConfig)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, request.userId!)))
    return reply.send(success({ success: true }))
  })
}

export default aiModelsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
