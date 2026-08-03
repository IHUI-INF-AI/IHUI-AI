/**
 * /api/admin/model-mappings 模型映射管理(P0-4 降本神器,2026-07-31 立)。
 *
 * 端点清单:
 * 1. GET    /admin/model-mappings         — 映射列表(可筛选 userId/apiKeyId/enabled/scope=global)
 * 2. POST   /admin/model-mappings         — 创建映射(全局/用户/Key 级,userId+apiKeyId=null 配全局)
 * 3. PATCH  /admin/model-mappings/:id     — 更新 targetModel/priority/enabled
 * 4. DELETE /admin/model-mappings/:id     — 删除映射
 *
 * 全部 requireAdmin。复用 model-mapping-service。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiModelMappings } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'
import { createMapping, listMappings } from '../../services/model-mapping-service.js'

const listQuerySchema = z.object({
  /** undefined=不筛选,null=全局,string=具体用户。scope=global 等价于 userId=null */
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  /** undefined=不筛选,null=全局,string=具体 Key。scope=global 等价于 apiKeyId=null */
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  /** scope=global 快捷筛选全局映射(userId+apiKeyId 均 null) */
  scope: z.transform(emptyToUndefined).pipe(z.enum(['global']).optional()),
  /** 只返回启用的映射 */
  enabled: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
})

const createBodySchema = z.object({
  /** null 或不传 = 全局/Key 级映射(非 Key 级时为全局) */
  userId: z.uuid().nullable().optional(),
  /** null 或不传 = 用户级或全局 */
  apiKeyId: z.uuid().nullable().optional(),
  sourceModel: z.string().min(1, 'source_model 不能为空').max(128),
  targetModel: z.string().min(1, 'target_model 不能为空').max(128),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
})

const updateBodySchema = z.object({
  targetModel: z.string().min(1).max(128).optional(),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
})

const modelMappingsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/model-mappings — 映射列表 =====
  server.get('/admin/model-mappings', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { userId, apiKeyId, scope, enabled } = q.data

    // scope=global 快捷筛选全局映射
    const isGlobalScope = scope === 'global'
    const list = await listMappings({
      userId: isGlobalScope ? null : userId,
      apiKeyId: isGlobalScope ? null : apiKeyId,
      enabledOnly: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    })
    return reply.send(success({ list, total: list.length }))
  })

  // ===== 2. POST /admin/model-mappings — 创建映射 =====
  server.post('/admin/model-mappings', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const row = await createMapping({
        userId: parsed.data.userId ?? null,
        apiKeyId: parsed.data.apiKeyId ?? null,
        sourceModel: parsed.data.sourceModel,
        targetModel: parsed.data.targetModel,
        priority: parsed.data.priority ?? 0,
        enabled: parsed.data.enabled ?? true,
      })
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '创建失败'
      // unique constraint violation → 409 冲突
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('冲突')) {
        return reply.status(409).send(error(409, '该作用域内 source_model 已存在映射'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // ===== 3. PATCH /admin/model-mappings/:id — 更新映射 =====
  server.patch('/admin/model-mappings/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = updateBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (Object.keys(parsed.data).length === 0)
      return reply.status(400).send(error(400, '至少更新一个字段'))

    const [row] = await db
      .update(aiModelMappings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(aiModelMappings.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '映射不存在'))
    return reply.send(success(row))
  })

  // ===== 4. DELETE /admin/model-mappings/:id — 删除映射 =====
  server.delete('/admin/model-mappings/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const [row] = await db
      .delete(aiModelMappings)
      .where(eq(aiModelMappings.id, p.data.id))
      .returning({ id: aiModelMappings.id })
    if (!row) return reply.status(404).send(error(404, '映射不存在'))
    return reply.send(success({ id: row.id }))
  })
}

export default modelMappingsRoutes
