/**
 * AI 模型管理 /ai/models(5 个端点:GET 列表/详情 + POST/PUT/DELETE CRUD)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { aiModelConfig } from '@ihui/database'
import { authenticate } from '../../plugins/auth.js'
import { parseIdParam } from './_shared.js'

const aiModelCreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().min(1).max(64),
  description: z.string().optional(),
  baseUrl: z.string().url().optional(),
  type: z.string().max(32).optional(),
  status: z.number().int().min(0).max(1).optional(),
  sort: z.number().int().optional(),
})

const aiModelUpdateSchema = aiModelCreateSchema.partial()

const aiModelsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai/models', async (_request, reply) => {
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
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.enabled, true))
      .orderBy(asc(aiModelConfig.sortOrder), asc(aiModelConfig.id))
    return reply.send(success({ list: rows }))
  })

  server.get('/ai/models/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
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
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, Number(id)))
    if (!row) return reply.status(404).send(error(404, '模型不存在'))
    return reply.send(success({ model: row }))
  })

  server.post('/ai/models', async (request, reply) => {
    await authenticate(request)
    const parsed = aiModelCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const d = parsed.data
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
        ownerUuid: request.userId,
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
    const id = parseIdParam(request, reply)
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
      .where(eq(aiModelConfig.id, Number(id)))
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
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await db
      .select({ id: aiModelConfig.id, isBuiltin: aiModelConfig.isBuiltin })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, Number(id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '模型不存在'))
    if (row.isBuiltin) return reply.status(403).send(error(403, '内置模型不可删除'))
    await db.delete(aiModelConfig).where(eq(aiModelConfig.id, Number(id)))
    return reply.send(success({ success: true }))
  })
}

export default aiModelsRoutes
