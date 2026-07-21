import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { recordAiCost } from '../plugins/ai-cost.js'
import { success, error } from '../utils/response.js'
import { zhsAiUserModelChatConfig, zhsAiUserModelChatHistory } from '@ihui/database'

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createModelConfigSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  vendor: z.enum([
    'openai', 'anthropic', 'google', 'azure', 'custom',
    // 2026-07-22 新增免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
    'cloudflare_workers_ai', 'nvidia_nim', 'github_models',
    'vercel_ai_gateway', 'opencode_zen', 'modal', 'inferencenet',
    'nlpcloud', 'scaleway', 'alibaba_intl',
  ]),
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

// Phase 5 P0 修复:前端 api-client sendAiChat 发送 {message, model?, conversationId?}
// 这里扩展为 union,接受两种格式;运行时归一为 chatSchema 内部表示
const chatSchemaFrontend = z.union([
  chatSchema,
  z
    .object({
      message: z.string().min(1).max(32000),
      model: z.string().max(128).optional(),
      conversationId: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(1).max(128000).optional(),
      configId: z.string().uuid('请指定模型配置 ID'),
    })
    .transform((v) => ({
      configId: v.configId,
      messages: [{ role: 'user' as const, content: v.message }],
      temperature: v.temperature,
      maxTokens: v.maxTokens,
      model: v.model,
      conversationId: v.conversationId,
    })),
])

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

interface LLMCallParams {
  vendor: string
  modelId: string
  baseUrl?: string | null
  apiKey: string
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
}

async function callLLM(params: LLMCallParams): Promise<{
  content: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  const { vendor, modelId, baseUrl, apiKey, messages, temperature, maxTokens } = params

  let endpoint: string
  let headers: Record<string, string>

  if (vendor === 'openai' || vendor === 'custom') {
    endpoint = (baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions'
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  } else if (vendor === 'azure') {
    endpoint = (baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions'
    headers = { 'Content-Type': 'application/json', 'api-key': apiKey }
  } else if (vendor === 'anthropic') {
    endpoint = (baseUrl ?? 'https://api.anthropic.com') + '/v1/messages'
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  } else if (vendor === 'google') {
    endpoint = `${baseUrl ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelId}:generateContent?key=${apiKey}`
    headers = { 'Content-Type': 'application/json' }
  } else {
    endpoint = (baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions'
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  }

  if (vendor === 'anthropic') {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: maxTokens ?? 4096,
    }
    if (temperature !== undefined) body.temperature = temperature
    const systemMsg = messages.find((m) => m.role === 'system')
    if (systemMsg) body.system = systemMsg.content
    const userMessages = messages.filter((m) => m.role !== 'system')
    body.messages = userMessages.map((m) => ({ role: m.role, content: m.content }))

    const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`Anthropic API ${resp.status}: ${errText}`)
    }
    const data = (await resp.json()) as Record<string, unknown>
    const contentBlocks = (data.content as { text?: string }[]) ?? []
    const content = contentBlocks.map((b) => b.text ?? '').join('')
    const u = (data.usage as { input_tokens?: number; output_tokens?: number }) ?? {}
    return {
      content,
      usage: {
        promptTokens: u.input_tokens ?? 0,
        completionTokens: u.output_tokens ?? 0,
        totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
      },
    }
  }

  if (vendor === 'google') {
    const body = {
      contents: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 4096,
      },
    }
    const systemMsg = messages.find((m) => m.role === 'system')
    if (systemMsg)
      (body as Record<string, unknown>).systemInstruction = { parts: [{ text: systemMsg.content }] }

    const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`Google AI API ${resp.status}: ${errText}`)
    }
    const data = (await resp.json()) as Record<string, unknown>
    const candidates = (data.candidates as { content?: { parts?: { text?: string }[] } }[]) ?? []
    const content = candidates
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
    const u =
      (data.usageMetadata as {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }) ?? {}
    return {
      content,
      usage: {
        promptTokens: u.promptTokenCount ?? 0,
        completionTokens: u.candidatesTokenCount ?? 0,
        totalTokens: u.totalTokenCount ?? 0,
      },
    }
  }

  const body: Record<string, unknown> = {
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  }
  if (temperature !== undefined) body.temperature = temperature
  if (maxTokens !== undefined) body.max_tokens = maxTokens

  const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`LLM API ${resp.status}: ${errText}`)
  }
  const data = (await resp.json()) as Record<string, unknown>
  const choices = (data.choices as { message?: { content?: string } }[]) ?? []
  const content = choices[0]?.message?.content ?? ''
  const u =
    (data.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) ??
    {}
  return {
    content,
    usage: {
      promptTokens: u.prompt_tokens ?? 0,
      completionTokens: u.completion_tokens ?? 0,
      totalTokens: u.total_tokens ?? 0,
    },
  }
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
    const parsed = chatSchemaFrontend.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = parsed.data
    const [config] = await db
      .select()
      .from(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.id, data.configId))
      .limit(1)
    if (!config) return reply.status(404).send(error(404, '模型配置不存在'))
    if (config.userId !== request.userId)
      return reply.status(403).send(error(403, '无权使用该配置'))
    if (!config.enabled) return reply.status(400).send(error(400, '该模型配置已禁用'))

    let replyContent: string
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number }

    try {
      const llmResult = await callLLM({
        vendor: config.vendor,
        modelId: config.modelId,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        messages: data.messages,
        temperature: data.temperature ?? config.temperature ?? undefined,
        maxTokens: data.maxTokens ?? config.maxTokens ?? undefined,
      })
      replyContent = llmResult.content
      usage = llmResult.usage
    } catch (e) {
      request.log.error({ err: e, vendor: config.vendor, model: config.modelId }, 'LLM 调用失败')
      return reply.status(502).send(error(502, `模型调用失败: ${(e as Error).message}`))
    }

    const now = new Date()
    const [history] = await db
      .insert(zhsAiUserModelChatHistory)
      .values({
        userId: request.userId!,
        configId: data.configId,
        model: config.modelId,
        content: replyContent,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      })
      .returning({
        id: zhsAiUserModelChatHistory.id,
        createdAt: zhsAiUserModelChatHistory.createdAt,
      })

    recordAiCost({
      userId: request.userId!,
      model: config.modelId,
      provider: config.vendor,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      requestType: 'user-model-chat',
    }).catch((err) => {
      request.log.warn({ err, vendor: config.vendor, model: config.modelId }, 'recordAiCost failed')
    })

    return reply.send(
      success({
        configId: config.id,
        model: config.modelId,
        content: replyContent,
        usage,
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
