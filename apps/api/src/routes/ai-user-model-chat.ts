// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { checkAuth } from '../plugins/auth.js'
import { recordAiCost } from '../plugins/ai-cost.js'
import { success, error } from '../utils/response.js'
import { zhsAiUserModelChatConfig, zhsAiUserModelChatHistory } from '@ihui/database'
import { toUserFriendlyMessage } from '@ihui/shared'
import { maskKey } from './v1-shared.js'
import { safeFetch, assertSafeFetchUrl } from '../utils/ssrf-guard.js'

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createModelConfigSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  vendor: z.enum([
    'openai',
    'anthropic',
    'google',
    'azure',
    'custom',
    // 2026-07-22 新增免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
    'cloudflare_workers_ai',
    'nvidia_nim',
    'github_models',
    'vercel_ai_gateway',
    'opencode_zen',
    'modal',
    'inferencenet',
    'nlpcloud',
    'scaleway',
    'alibaba_intl',
  ]),
  modelId: z.string().min(1, '模型 ID 不能为空').max(128),
  baseUrl: z.url({ error: 'baseUrl 必须为合法 URL' }).optional(),
  apiKey: z.string().min(1, 'apiKey 不能为空').max(256),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
})

const updateModelConfigSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(128).optional(),
  baseUrl: z.url().optional(),
  apiKey: z.string().min(1).max(256).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  enabled: z.boolean().optional(),
})

const chatSchema = z.object({
  configId: z.uuid({ error: '请指定模型配置 ID' }),
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
      configId: z.uuid({ error: '请指定模型配置 ID' }),
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

/**
 * BYOK 出站唯一出口(2026-10-28 安全加固)。
 *
 * 原实现三处各自裸调 fetch,endpoint 由**用户填的** baseUrl 拼出:
 * 任意登录用户把 baseUrl 存成 `http://127.0.0.1:8802` 或 `http://169.254.169.254`
 * 即可让服务端替他发请求;更糟的是错误分支把上游响应体(errText)拼进 Error.message,
 * 再经 /chat 的 502 `模型调用失败: ...` 回显给调用方 ⇒ 内网响应可被半盲读取。
 *
 * 现统一走 ssrf-guard 的 safeFetch:协议白名单 + 端口白名单 + DNS 解析后逐 IP 复检
 * (防 rebinding)+ 逐跳重定向复检。判据全部复用 `utils/ssrf-guard.ts`,本文件不复制
 * 任何 IP 段/端口常量(AGENTS.md §0.6 单一真相源)。若要放宽端口,必须改 ssrf-guard
 * 单一出口并走定向说明,不得在此处就地加白名单。
 *
 * `export` 仅为测试可达(SSRF 回归锁),路由内部不对外暴露。
 */
export async function fetchUpstream(endpoint: string, init: RequestInit): Promise<Response> {
  const res = await safeFetch(endpoint, init)
  if (!res.ok) {
    // 只回状态码,绝不回显上游 body:body 可能是内网页面/云元数据原文。
    // 上游原文截断后挂在 err.upstreamBody 上,仅供服务端日志取证,不进 message。
    const upstreamBody = await res.text().catch(() => '')
    throw Object.assign(new Error(`上游模型服务返回 HTTP ${res.status}`), {
      statusCode: 502,
      upstreamBody: upstreamBody.slice(0, 500),
    })
  }
  return res
}

/**
 * 把 ssrf-guard 的英文 reason 翻成能直接给用户看的中文。
 * 只做措辞映射,不改判据 —— 是否放行仍由 assertSafeFetchUrl 决定。
 */
function describeSsrfRejection(reason: string): string {
  if (reason.includes('Port')) return 'baseUrl 仅支持标准端口(80 / 443)'
  if (reason.includes('Protocol')) return 'baseUrl 仅支持 http / https 协议'
  if (reason.includes('DNS')) return 'baseUrl 域名解析失败,请检查域名拼写'
  return 'baseUrl 指向内网或保留地址,不被允许'
}

/**
 * 写入侧预检:用户保存 baseUrl 时就拒掉内网地址,不让脏配置进库。
 *
 * 注意这**不能**替代 fetchUpstream 里的校验 —— 保存时解析一次、调用时再解析一次,
 * 中间 DNS 可以被改成内网(rebinding),调用侧那道才是真正的闸。
 */
async function rejectUnsafeBaseUrl(baseUrl: string | undefined): Promise<string | null> {
  if (!baseUrl) return null
  const verdict = await assertSafeFetchUrl(baseUrl)
  return verdict.safe ? null : describeSsrfRejection(verdict.reason ?? '')
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

// `export` 仅为测试可达(SSRF 回归锁),路由内部不对外暴露。
export async function callLLM(params: LLMCallParams): Promise<{
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

    const resp = await fetchUpstream(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
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

    const resp = await fetchUpstream(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
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

  const resp = await fetchUpstream(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
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
    if (!(await checkAuth(request, reply))) return
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
    // 2026-10-28 安全加固:保存即拒内网 baseUrl。调用侧 fetchUpstream 仍会再校验一次
    // (保存时解析一次、调用时再解析一次,DNS 可在中间被改成内网),这里只是让用户在
    // 保存那一刻就拿到明确提示,而不是等到聊天时才 502。
    const baseUrlRejection = await rejectUnsafeBaseUrl(parsed.data.baseUrl)
    if (baseUrlRejection) return reply.status(400).send(error(400, baseUrlRejection))
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
    if (body.data.baseUrl !== undefined) {
      // 同 POST /configs 的保存侧预检(调用侧仍有第二道闸,见 fetchUpstream 头注)
      const baseUrlRejection = await rejectUnsafeBaseUrl(body.data.baseUrl)
      if (baseUrlRejection) return reply.status(400).send(error(400, baseUrlRejection))
      updateData.baseUrl = body.data.baseUrl
    }
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
    const removed = await db
      .delete(zhsAiUserModelChatConfig)
      .where(eq(zhsAiUserModelChatConfig.id, parsed.data.id))
      .returning({ id: zhsAiUserModelChatConfig.id })
    return reply.send(success({ id: parsed.data.id, deleted: removed.length > 0 }))
  })

  // POST /chat - 用户自带模型配置对话
  // 租户级限频(2026-10-18):多租户公平配额——单租户 30 次/分钟(按 x-tenant-id 分桶;
  // 无头的请求归 '0' 桶)。是 distributed-rate-limit 插件的第二个 scope:'tenant'
  // 真实规则,大屏 tenant-usage 的"限流命中"指标由此产生真实数据面。
  server.distributedRateLimit.addRule({
    name: 'ai-chat-tenant',
    limit: 30,
    windowSec: 60,
    scope: 'tenant',
  })
  server.post(
    '/chat',
    { preHandler: [server.distributedRateLimit.preHandler('ai-chat-tenant')] },
    async (request, reply) => {
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
        return reply.status(502).send(error(502, `模型调用失败: ${toUserFriendlyMessage(e)}`))
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
        request.log.warn(
          { err, vendor: config.vendor, model: config.modelId },
          'recordAiCost failed',
        )
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
    },
  )

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
