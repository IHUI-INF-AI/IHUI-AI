import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default([]),
  rateLimit: z.number().int().min(1).max(10000).optional(),
})

const updateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'revoked']).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const developerRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有开发者 API 密钥端点需登录
  server.addHook('preHandler', requireAuth)

  // GET /api-keys — 列出当前用户的 API 密钥
  server.get('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const list = await db
      .select({
        id: developerApiKeys.id,
        name: developerApiKeys.name,
        key: developerApiKeys.key,
        permissions: developerApiKeys.permissions,
        status: developerApiKeys.status,
        lastUsedAt: developerApiKeys.lastUsedAt,
        rateLimit: developerApiKeys.rateLimit,
        createdAt: developerApiKeys.createdAt,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.userId, userId))
      .orderBy(desc(developerApiKeys.createdAt))
    return reply.send(success({ list }))
  })

  // POST /api-keys — 创建 API 密钥
  server.post('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const parsed = createKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 生成 key（公开标识）与 secret（仅创建时返回）
    const apiKey = `ihui_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const apiSecret = `sk_${randomUUID().replace(/-/g, '')}`
    const [record] = await db
      .insert(developerApiKeys)
      .values({
        userId,
        name: parsed.data.name,
        key: apiKey,
        secret: apiSecret,
        permissions: parsed.data.permissions,
        rateLimit: parsed.data.rateLimit ?? 60,
      })
      .returning()
    // 仅此一次返回完整 secret，后续不再提供
    return reply.status(201).send(
      success({
        apiKey: record,
        secret: apiSecret,
      }),
    )
  })

  // DELETE /api-keys/:id — 删除 API 密钥
  server.delete('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(developerApiKeys)
      .where(eq(developerApiKeys.id, parsed.data.id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, 'API 密钥不存在'))
    // 仅允许删除自己的密钥
    if (deleted.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除此 API 密钥'))
    }
    return reply.send(success({ ok: true }))
  })

  // PATCH /api-keys/:id — 更新权限
  server.patch('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 校验归属权
    const [existing] = await db
      .select()
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, 'API 密钥不存在'))
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权修改此 API 密钥'))
    }
    const [updated] = await db
      .update(developerApiKeys)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(developerApiKeys.id, idParsed.data.id))
      .returning()
    return reply.send(success({ apiKey: updated }))
  })
}

export default developerRoutes
