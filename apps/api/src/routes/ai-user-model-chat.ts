import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// 用户自定义模型对话路由 — 迁移自旧架构 api/ai/user-model-chat.ts
// 挂载前缀：/api/ai/user-model-chat（由 server.ts 统一注册）
// 允许用户配置自有厂商模型（含 API Key）并发起对话，Key 仅存储于用户维度
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// 自定义模型配置 schema
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

// 对话 schema
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

// =============================================================================
// 鉴权辅助
// =============================================================================

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

// =============================================================================
// 数据库表初始化 & 查询辅助
// =============================================================================

const CONFIG_COLS = sql`
  id, user_id AS "userId", name, vendor, model_id AS "modelId",
  base_url AS "baseUrl", api_key AS "apiKey", temperature,
  max_tokens AS "maxTokens", enabled, created_at AS "createdAt"
`

const HISTORY_COLS = sql`
  id, config_id AS "configId", model, content,
  prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens",
  total_tokens AS "totalTokens", created_at AS "createdAt"
`

async function ensureChatTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_ai_user_model_chat_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(64) NOT NULL,
      name varchar(64) NOT NULL,
      vendor varchar(20) NOT NULL,
      model_id varchar(128) NOT NULL,
      base_url varchar(500),
      api_key varchar(256) NOT NULL,
      temperature real,
      max_tokens integer,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_ai_user_model_chat_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(64) NOT NULL,
      config_id uuid NOT NULL,
      model varchar(128) NOT NULL,
      content text NOT NULL,
      prompt_tokens integer NOT NULL DEFAULT 0,
      completion_tokens integer NOT NULL DEFAULT 0,
      total_tokens integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

// =============================================================================
// 路由
// =============================================================================

export const aiUserModelChatRoutes: FastifyPluginAsync = async (server) => {
  await ensureChatTables()

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /configs - 我的模型配置列表（apiKey 脱敏返回）
  server.get('/configs', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const offset = (page - 1) * pageSize

    const listRows = await db.execute(sql`
      SELECT ${CONFIG_COLS} FROM zhs_ai_user_model_chat_config
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM zhs_ai_user_model_chat_config WHERE user_id = ${userId}
    `)
    const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
    const list = (listRows as Array<Record<string, unknown>>).map(({ apiKey, ...rest }) => ({
      ...rest,
      apiKey: maskKey(apiKey as string),
    }))
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /configs - 新增模型配置
  server.post('/configs', async (request, reply) => {
    const parsed = createModelConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const userId = request.userId!
    const baseUrl = parsed.data.baseUrl ?? null
    const temperature = parsed.data.temperature ?? null
    const maxTokens = parsed.data.maxTokens ?? null
    await db.execute(sql`
      INSERT INTO zhs_ai_user_model_chat_config
        (id, user_id, name, vendor, model_id, base_url, api_key, temperature, max_tokens, enabled, created_at)
      VALUES
        (${id}, ${userId}, ${parsed.data.name}, ${parsed.data.vendor}, ${parsed.data.modelId},
         ${baseUrl}, ${parsed.data.apiKey}, ${temperature}, ${maxTokens}, true, ${now})
    `)
    const config = {
      id,
      userId,
      name: parsed.data.name,
      vendor: parsed.data.vendor,
      modelId: parsed.data.modelId,
      baseUrl: parsed.data.baseUrl,
      apiKey: maskKey(parsed.data.apiKey),
      temperature: parsed.data.temperature,
      maxTokens: parsed.data.maxTokens,
      enabled: true,
      createdAt: now,
    }
    return reply.status(201).send(success({ config }))
  })

  // PUT /configs/:id - 更新模型配置
  server.put('/configs/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateModelConfigSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${CONFIG_COLS} FROM zhs_ai_user_model_chat_config WHERE id = ${paramParsed.data.id}
    `)
    const existing = rows[0] as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send(error(404, '配置不存在'))
    if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))

    const sets: SQL[] = []
    if (body.data.name !== undefined) sets.push(sql`name = ${body.data.name}`)
    if (body.data.modelId !== undefined) sets.push(sql`model_id = ${body.data.modelId}`)
    if (body.data.baseUrl !== undefined) sets.push(sql`base_url = ${body.data.baseUrl}`)
    if (body.data.apiKey !== undefined) sets.push(sql`api_key = ${body.data.apiKey}`)
    if (body.data.temperature !== undefined) sets.push(sql`temperature = ${body.data.temperature}`)
    if (body.data.maxTokens !== undefined) sets.push(sql`max_tokens = ${body.data.maxTokens}`)
    if (body.data.enabled !== undefined) sets.push(sql`enabled = ${body.data.enabled}`)

    if (sets.length > 0) {
      await db.execute(sql`
        UPDATE zhs_ai_user_model_chat_config SET ${sql.join(sets, sql`, `)} WHERE id = ${paramParsed.data.id}
      `)
    }
    const rawApiKey =
      body.data.apiKey !== undefined ? body.data.apiKey : (existing.apiKey as string)
    const updated = { ...existing, ...body.data, apiKey: maskKey(rawApiKey) }
    return reply.send(success({ config: updated }))
  })

  // DELETE /configs/:id - 删除模型配置
  server.delete('/configs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT user_id AS "userId" FROM zhs_ai_user_model_chat_config WHERE id = ${parsed.data.id}
    `)
    const existing = rows[0] as { userId?: string } | undefined
    if (!existing) return reply.status(404).send(error(404, '配置不存在'))
    if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
    await db.execute(sql`DELETE FROM zhs_ai_user_model_chat_config WHERE id = ${parsed.data.id}`)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // POST /chat - 使用自定义模型发起对话
  server.post('/chat', async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${CONFIG_COLS} FROM zhs_ai_user_model_chat_config WHERE id = ${parsed.data.configId}
    `)
    const config = rows[0] as Record<string, unknown> | undefined
    if (!config) return reply.status(404).send(error(404, '模型配置不存在'))
    if (config.userId !== request.userId)
      return reply.status(403).send(error(403, '无权使用该配置'))
    if (!config.enabled) return reply.status(400).send(error(400, '该模型配置已禁用'))

    // 占位：实际应调用厂商网关（见 services/clawdbot/models.ts），此处返回提示
    const reply_content = `[占位响应] 已通过 ${config.vendor}/${config.modelId} 处理 ${parsed.data.messages.length} 条消息。请接入真实模型网关。`
    const now = new Date().toISOString()
    const result = {
      configId: config.id,
      model: config.modelId,
      content: reply_content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      createdAt: now,
    }

    const historyId = crypto.randomUUID()
    await db.execute(sql`
      INSERT INTO zhs_ai_user_model_chat_history
        (id, user_id, config_id, model, content, prompt_tokens, completion_tokens, total_tokens, created_at)
      VALUES
        (${historyId}, ${request.userId}, ${parsed.data.configId}, ${config.modelId},
         ${reply_content}, 0, 0, 0, ${now})
    `)
    return reply.send(success(result))
  })

  // GET /history - 我的对话历史
  server.get('/history', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const offset = (page - 1) * pageSize

    const listRows = await db.execute(sql`
      SELECT ${HISTORY_COLS} FROM zhs_ai_user_model_chat_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM zhs_ai_user_model_chat_history WHERE user_id = ${userId}
    `)
    const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
    return reply.send(
      success({ list: listRows as Record<string, unknown>[], total, page, pageSize }),
    )
  })
}

/** API Key 脱敏：仅保留前 4 位与后 4 位 */
function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}
