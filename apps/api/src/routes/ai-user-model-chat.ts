import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { zhsAiUserModelChatConfig, zhsAiUserModelChatHistory } from '@ihui/database'

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createModelConfigSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  vendor: z.enum(['openai', 'anthropic', 'google', 'azure', 'custom']),
  modelId: z.string().min(1, '模型 ID 不能为空').max(128),
  baseUrl: z.string().url('baseUrl 必须为合法 URL').optional(),
  apiKey: z.string().min(1, 'apiKey 不能为空').max(256),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
})

const updateModelConfigSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(128).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).max(256).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  enabled: z.boolean().optional(),
})

const chatSchema = z.object({
  configId: z.string().uuid('请指定模型配置 ID'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(32000),
      }),
    )
    .min(1, 'messages 不能为空')
    .max(50),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  stream: z.boolean().optional(),
})

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

export const aiUserModelChatRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  server.get('/configs', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const offset = (page - 1) * pageSize

    const rows = await db
      .select()
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.userId, userId))
      .orderBy(desc(zhsAiUserModelChatConfig.createdAt))
      .limit(pageSize)
      .offset(offset)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.userId, userId))
    const total = countRows[0]?.count ?? 0
    const list = rows.map(({ apiKey, ...rest }) => ({
      ...rest,
      apiKey: maskKey(apiKey),
    }))
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/configs', async (request, reply) => {
    const parsed = createModelConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const [config] = await db
      .insert(zhsAiUserModelChatConfig)
      .values({
        userId,
        name: parsed.data.name,
        vendor: parsed.data.vendor,
        modelId: parsed.data.modelId,
        baseUrl: parsed.data.baseUrl ?? null,
        apiKey: parsed.data.apiKey,
        temperature: parsed.data.temperature ?? null,
        maxTokens: parsed.data.maxTokens ?? null,
      })
      .returning()
    const { apiKey, ...rest } = config!
    return reply.status(201).send(success({ config: { ...rest, apiKey: maskKey(apiKey) } }))
  })

  server.put('/configs/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateModelConfigSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.id, paramParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '配置不存在'))
    if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))

    const updateData: Record<string, unknown> = {}
    if (body.data.name !== undefined) updateData.name = body.data.name
    if (body.data.modelId !== undefined) updateData.modelId = body.data.modelId
    if (body.data.baseUrl !== undefined) updateData.baseUrl = body.data.baseUrl
    if (body.data.apiKey !== undefined) updateData.apiKey = body.data.apiKey
    if (body.data.temperature !== undefined) updateData.temperature = body.data.temperature
    if (body.data.maxTokens !== undefined) updateData.maxTokens = body.data.maxTokens
    if (body.data.enabled !== undefined) updateData.enabled = body.data.enabled

    let result = existing
    if (Object.keys(updateData).length > 0) {
      const [updated] = await db
        .update(zhsAiUserModelChatConfig)
        .set(updateData)
        .where(eq(zhsAiUserModelChatConfig.id, paramParsed.data.id))
        .returning()
      result = updated!
    }
    const { apiKey, ...rest } = result
    return reply.send(success({ config: { ...rest, apiKey: maskKey(apiKey) } }))
  })

  server.delete('/configs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ userId: zhsAiUserModelChatConfig.userId })
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '配置不存在'))
    if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
    await db.delete(zhsAiUserModelChatConfig).where(eq(zhsAiUserModelChatConfig.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  server.post('/chat', async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [config] = await db
      .select()
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.id, parsed.data.configId))
      .limit(1)
    if (!config) return reply.status(404).send(error(404, '模型配置不存在'))
    if (config.userId !== request.userId)
      return reply.status(403).send(error(403, '无权使用该配置'))
    if (!config.enabled) return reply.status(400).send(error(400, '该模型配置已禁用'))

    const reply_content = `[mock 响应] 已通过 ${config.vendor}/${config.modelId} 处理 ${parsed.data.messages.length} 条消息。请接入真实模型网关。`
    const now = new Date()
    const [history] = await db
      .insert(zhsAiUserModelChatHistory)
      .values({
        userId: request.userId!,
        configId: parsed.data.configId,
        model: config.modelId,
        content: reply_content,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      })
      .returning({
        id: zhsAiUserModelChatHistory.id,
        createdAt: zhsAiUserModelChatHistory.createdAt,
      })

    return reply.send(
      success({
        configId: config.id,
        model: config.modelId,
        content: reply_content,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        mock: true,
        reason: '模型网关未接入，返回 mock 响应',
        createdAt: history?.createdAt ?? now,
      }),
    )
  })

  server.get('/history', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const offset = (page - 1) * pageSize

    const list = await db
      .select()
      .from(zhsAiUserModelChatHistory)
      .where(eq(zhsAiUserModelChatHistory.userId, userId))
      .orderBy(desc(zhsAiUserModelChatHistory.createdAt))
      .limit(pageSize)
      .offset(offset)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsAiUserModelChatHistory)
      .where(eq(zhsAiUserModelChatHistory.userId, userId))
    const total = countRows[0]?.count ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
}
