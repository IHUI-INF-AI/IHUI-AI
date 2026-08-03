import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import * as shareService from '../services/api-key-share-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const apiKeyIdParamSchema = z.object({
  id: z.uuid({ error: '无效的 API Key ID' }),
})

const shareIdParamSchema = z.object({
  shareId: z.uuid({ error: '无效的分享 ID' }),
})

const endpointSchema = z.enum(['chat', 'embeddings', 'image'])

const createShareBodySchema = z.object({
  /** 被分享给的用户 ID(可选,null = 公开分享链接) */
  sharedWithUserId: z.uuid({ error: '无效的用户 ID' }).nullable().optional(),
  /** 允许调用的模型列表(null/省略 = 继承源 Key) */
  scopeModels: z.array(z.string().min(1)).nullable().optional(),
  /** 允许的端点(null/省略 = 全部) */
  scopeEndpoints: z.array(endpointSchema).nullable().optional(),
  /** 每分钟请求上限(默认 60) */
  rateLimitRpm: z.number().int().min(1).max(10000).optional(),
  /** 每分钟 token 上限(默认 100000) */
  rateLimitTpm: z.number().int().min(1).max(10_000_000).optional(),
  /** 总 token 上限(null = 无限) */
  maxTotalTokens: z.number().int().min(0).nullable().optional(),
  /** 过期时间(必填,ISO 8601 字符串或时间戳,必须晚于当前时间) */
  expiresAt: z
    .union([z.string().datetime(), z.number(), z.date()])
    .refine((v) => {
      const d = v instanceof Date ? v : new Date(v)
      return d.getTime() > Date.now()
    }, '过期时间必须晚于当前时间')
    .transform((v) => (v instanceof Date ? v : new Date(v))),
})

// =============================================================================
// 路由
// =============================================================================

const apiKeySharesRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权:所有分享端点需登录
  server.addHook('preHandler', requireAuth)

  // POST /api/developer/api-keys/:id/shares — 创建分享(只能分享自己的 Key)
  server.post('/api-keys/:id/shares', async (request, reply) => {
    const userId = request.userId!
    const idParsed = apiKeyIdParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createShareBodySchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await shareService.createShare({
      sourceApiKeyId: idParsed.data.id,
      createdBy: userId,
      sharedWithUserId: bodyParsed.data.sharedWithUserId ?? null,
      scopeModels: bodyParsed.data.scopeModels ?? null,
      scopeEndpoints: bodyParsed.data.scopeEndpoints ?? null,
      rateLimitRpm: bodyParsed.data.rateLimitRpm,
      rateLimitTpm: bodyParsed.data.rateLimitTpm,
      maxTotalTokens: bodyParsed.data.maxTotalTokens ?? null,
      expiresAt: bodyParsed.data.expiresAt,
    })
    if (!result) {
      return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))
    }
    // share_token 仅此一次返回完整值(类似 API Key 的 secret 模式)
    request.skipResponseSanitization = true
    return reply.status(201).send(
      success({
        share: result.share,
        shareToken: result.shareToken,
      }),
    )
  })

  // GET /api/developer/api-keys/:id/shares — 列出 Key 的所有分享
  server.get('/api-keys/:id/shares', async (request, reply) => {
    const userId = request.userId!
    const idParsed = apiKeyIdParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await shareService.listSharesBySourceKey(idParsed.data.id, userId)
    if (list === null) {
      return reply.status(404).send(error(404, 'API Key 不存在或无权查看'))
    }
    return reply.send(success({ list }))
  })

  // DELETE /api/developer/shares/:shareId — 撤销分享
  server.delete('/shares/:shareId', async (request, reply) => {
    const userId = request.userId!
    const parsed = shareIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await shareService.revokeShare(parsed.data.shareId, userId)
    if (!ok) return reply.status(404).send(error(404, '分享不存在或无权操作'))
    return reply.send(success({ ok: true }))
  })

  // GET /api/developer/shares — 列出当前用户的所有分享(跨 Key)
  server.get('/shares', async (request, reply) => {
    const userId = request.userId!
    const list = await shareService.listSharesByUser(userId)
    return reply.send(success({ list }))
  })
}

export default apiKeySharesRoutes
