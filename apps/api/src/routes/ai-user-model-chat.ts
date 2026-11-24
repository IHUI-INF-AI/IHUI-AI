// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, eq, desc, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { checkAuth } from '../plugins/auth.js'
import { recordAiCost } from '../plugins/ai-cost.js'
import { success, error } from '../utils/response.js'
import { zhsAiUserModelChatConfig, zhsAiUserModelChatHistory } from '@ihui/database'
import { chatConversations, chatConversationGroups } from '@ihui/database'
import { toUserFriendlyMessage } from '@ihui/shared'
import { maskKey } from './v1-shared.js'
import { safeFetch, assertSafeFetchUrl } from '../utils/ssrf-guard.js'
import { encryptCredential, decryptCredential } from '../utils/crypto.js'

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

/**
 * 2026-11-24 统一后端(机主令「所有接口所有功能全部多端互通,但要分好是从哪个端操作录入的」):
 * 小程序历史与统一会话表 chat_conversations 的镜像层。
 * 幂等键 = (user_id, source='miniapp', source_ref=history.id);双写与存量收编共用同一键,
 * 故「本表新写一条」与「脚本收编一条」不会各造一份。
 *
 * 纪律:镜像失败一律只记警告,不阻断小程序本端读写 —— 失效方向恒为「统一层滞后」,
 * 绝不把「多端能看到」这件事的重量压到「本轮对话能不能存下来」上。
 */
async function mirrorConversations(
  userId: string,
  historyIds: string[],
  patch: { pinned?: boolean; pinnedAt?: Date | null; title?: string; groupId?: string | null },
  log: { warn: (obj: unknown, msg?: string) => void },
): Promise<void> {
  if (historyIds.length === 0) return
  try {
    await db
      .update(chatConversations)
      .set({
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        ...(patch.pinnedAt !== undefined ? { pinnedAt: patch.pinnedAt } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.groupId !== undefined ? { groupId: patch.groupId } : {}),
      })
      .where(
        and(
          eq(chatConversations.userId, userId),
          eq(chatConversations.source, 'miniapp'),
          inArray(chatConversations.sourceRef, historyIds),
        ),
      )
  } catch (err) {
    log.warn({ err }, '小程序→统一会话镜像失败(不影响端上操作)')
  }
}

/** 按文件夹名拿（或建）统一分组行;返回 null = 未分组。名字已由调用方归一化。 */
async function ensureConversationGroup(
  userId: string,
  name: string | null,
): Promise<string | null> {
  if (!name) return null
  const existing = await db
    .select({ id: chatConversationGroups.id })
    .from(chatConversationGroups)
    .where(and(eq(chatConversationGroups.userId, userId), eq(chatConversationGroups.name, name)))
    .limit(1)
  if (existing[0]) return existing[0].id
  const inserted = await db
    .insert(chatConversationGroups)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning({ id: chatConversationGroups.id })
  if (inserted[0]) return inserted[0].id
  // 并发下 onConflictDoNothing 可能不返回行,再查一次收口
  const again = await db
    .select({ id: chatConversationGroups.id })
    .from(chatConversationGroups)
    .where(and(eq(chatConversationGroups.userId, userId), eq(chatConversationGroups.name, name)))
    .limit(1)
  return again[0]?.id ?? null
}

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
    // 2026-11-01 安全强化:凭据只走 x-goog-api-key 头,不进 URL。
    // 原先 `?key=${apiKey}` 让用户的 key 随 URL 走:访问日志、异常文本、上游错误摘要
    // 都按 URL 记录。同一原生端点在本仓 Node 侧早已用头形态
    // (routes/ai-vendors/proxy-llm.ts 直接 POST `:generateContent`,URL 不含 key;
    // vendor-auth-strategies.ts 的 `x-goog-api-key`),故这不只是"更干净",而是有对照实现。
    endpoint = `${baseUrl ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelId}:generateContent`
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
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
      // DB-35:落库是 enc:v1: 密文,先解密再 mask,保持响应语义不变
      apiKey: maskKey(decryptCredential(apiKey)),
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
        apiKey: encryptCredential(parsed.data.apiKey, 256),
        temperature: parsed.data.temperature ?? null,
        maxTokens: parsed.data.maxTokens ?? null,
      })
      .returning()
    const { apiKey, ...rest } = config!
    return reply
      .status(201)
      .send(success({ config: { ...rest, apiKey: maskKey(decryptCredential(apiKey)) } }))
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
    if (body.data.apiKey !== undefined) updateData.apiKey = encryptCredential(body.data.apiKey, 256)
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
    return reply.send(success({ config: { ...rest, apiKey: maskKey(decryptCredential(apiKey)) } }))
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
          apiKey: decryptCredential(config.apiKey),
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

      // 2026-11-24 统一后端:本条提问同步落一条统一会话(source=miniapp, source_ref=history.id),
      // 三端抽屉因此能看到同一条记录;失败只记警告(见 mirrorConversations 注释的降级方向)。
      try {
        await db
          .insert(chatConversations)
          .values({
            userId: request.userId!,
            title: replyContent.slice(0, 30) || '小程序对话',
            model: config.modelId,
            lastMessageAt: now,
            source: 'miniapp',
            sourceRef: history?.id ?? null,
          })
          .onConflictDoNothing()
      } catch (err) {
        request.log.warn({ err }, '小程序会话同步落库失败(不影响历史写入)')
      }

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
    /**
     * 出参补齐展示字段(2026-11-23):小程序抽屉与四个页面都按 `title / time / modelName`
     * 取值,而本端点此前原样吐数据库列(content / createdAt / model) ⇒ 抽屉里的标题与时间
     * 恒为 undefined(与 web 侧栏 `sidebar-chat-history` 的展示字段名不一致)。
     * 这里只**追加**同名展示字段并保留原始列(向后兼容旧调用方),`pinned` 随 `select()` 带出。
     */
    const items = list.map((item) => ({
      ...item,
      /* 自命名标题优先(与 web 会话重命名同语义);未改名时回落原话前 30 字 */
      title: item.title || item.content.slice(0, 30) || '未命名对话',
      time: item.createdAt ? new Date(item.createdAt).toISOString() : '',
      modelName: item.model || undefined,
      pinned: item.pinned === true,
      /* 文件夹:空串 / null 一律折成 null(= 未分组),客户端按 null 判定,不判 undefined */
      folder: item.folder || null,
    }))
    return reply.send(success({ list: items, total, page, pageSize }))
  })

  /**
   * 批量删除历史(2026-11-23,小程序抽屉多选态用)。
   * 与 web `POST /conversations/batch` 的 delete 动作同语义:一次事务内按 (userId, ids) 收口,
   * 只删属于本账号的行并回传真正删掉的 id 集(前端据此做最优化的即时隐藏,不做"删了没删"的猜)。
   * 上限 200 —— 抽屉一次分页 20 条,200 足够覆盖"全选 + 跨页",同时挡住超大数组打爆单语句。
   */
  server.post('/history/batch-delete', async (request, reply) => {
    const body = z
      .object({
        ids: z
          .array(z.uuid({ error: '记录 ID 不合法' }))
          .min(1)
          .max(200),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const deleted = await db
      .delete(zhsAiUserModelChatHistory)
      .where(
        and(
          inArray(zhsAiUserModelChatHistory.id, body.data.ids),
          eq(zhsAiUserModelChatHistory.userId, userId),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    // 三端互通:删历史与删统一会话同一轮收口(镜像行没有独立内容,留着只会在 web 列表里变成幽灵)
    if (deleted.length > 0) {
      try {
        await db.delete(chatConversations).where(
          and(
            eq(chatConversations.userId, userId),
            eq(chatConversations.source, 'miniapp'),
            inArray(
              chatConversations.sourceRef,
              deleted.map((r) => r.id),
            ),
          ),
        )
      } catch (err) {
        request.log.warn({ err }, '删除统一会话镜像失败(历史已删,镜像待下次清扫)')
      }
    }
    return reply.send(success({ deleted: deleted.length, deletedIds: deleted.map((r) => r.id) }))
  })

  /**
   * 小程序抽屉「置顶」落库端点(2026-11-23)。
   * 语义与 web `PATCH /chat/conversations/:id {pinned}` 同向:置顶是用户级持久状态,不是本机偏好。
   * 授权:归属用 `userId` 一并收口(认证 ≠ 授权,不靠 id 反推身份),越权行不会被写。
   */
  server.patch('/history/:id/pinned', async (request, reply) => {
    const params = z.object({ id: z.uuid({ error: '记录 ID 不合法' }) }).safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, params.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z.object({ pinned: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, 'pinned 必须为布尔值'))
    const userId = request.userId!
    const updated = await db
      .update(zhsAiUserModelChatHistory)
      .set({ pinned: body.data.pinned })
      .where(
        and(
          eq(zhsAiUserModelChatHistory.id, params.data.id),
          eq(zhsAiUserModelChatHistory.userId, userId),
        ),
      )
      .returning({
        id: zhsAiUserModelChatHistory.id,
        pinned: zhsAiUserModelChatHistory.pinned,
      })
    const row = updated[0]
    if (!row) return reply.status(404).send(error(404, '记录不存在或无权操作'))
    // 三端互通:置顶同向写入统一会话
    await mirrorConversations(
      userId,
      [row.id],
      { pinned: row.pinned, pinnedAt: row.pinned ? new Date() : null },
      request.log,
    )
    return reply.send(success({ id: row.id, pinned: row.pinned }))
  })

  /**
   * 重命名历史标题(2026-11-23):与 web `PATCH /chat/conversations/:id {title}` 同语义。
   * 归一化只做「折叠空白 + 去首尾 + 截 120」;空串拒收(清空标题没有意义 —— 回落到原话
   * 是通过"不写"实现,而不是写空)。归属仍由 userId 一并收口。
   */
  server.patch('/history/:id/title', async (request, reply) => {
    const params = z.object({ id: z.uuid({ error: '记录 ID 不合法' }) }).safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, params.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z
      .object({ title: z.string({ error: '标题必须为字符串' }).max(120) })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const squashed = body.data.title
      .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
    if (!squashed) return reply.status(400).send(error(400, '标题不能为空'))
    const userId = request.userId!
    const updated = await db
      .update(zhsAiUserModelChatHistory)
      .set({ title: squashed })
      .where(
        and(
          eq(zhsAiUserModelChatHistory.id, params.data.id),
          eq(zhsAiUserModelChatHistory.userId, userId),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id, title: zhsAiUserModelChatHistory.title })
    const row = updated[0]
    if (!row) return reply.status(404).send(error(404, '记录不存在或无权操作'))
    // 三端互通:改名同向写入统一会话
    await mirrorConversations(userId, [row.id], { title: squashed }, request.log)
    return reply.send(success({ id: row.id, title: row.title }))
  })

  /**
   * 批量移动到文件夹(2026-11-23,小程序抽屉唯一的文件夹写出口)。
   * 单条也走这条(ids 长度 1):端内不另留一份 PATCH 单条实现,归一化与 userId 收口只有一处。
   * 归一化只做「折叠空白 + 去首尾 + 截 64」这一件事,与 shared `normalizeOrgName` 同规则同上限,
   * 不另立第二套(客户端用同一份纯函数做展示侧归一,故两端比对不会因空格/长度漂开)。
   */
  server.post('/history/batch-folder', async (request, reply) => {
    const body = z
      .object({
        ids: z
          .array(z.uuid({ error: '记录 ID 不合法' }))
          .min(1)
          .max(200),
        folder: z.string().max(64, { error: '文件夹名最长 64 个字符' }).nullable(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const squashed = (body.data.folder ?? '')
      .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64)
    const nextFolder = squashed || null
    const userId = request.userId!
    const updated = await db
      .update(zhsAiUserModelChatHistory)
      .set({ folder: nextFolder })
      .where(
        and(
          inArray(zhsAiUserModelChatHistory.id, body.data.ids),
          eq(zhsAiUserModelChatHistory.userId, userId),
        ),
      )
      .returning({ id: zhsAiUserModelChatHistory.id })
    // 三端互通:文件夹名 → 统一分组表(groupId);清空 = 回未分组
    const groupId = await ensureConversationGroup(userId, nextFolder)
    await mirrorConversations(
      userId,
      updated.map((r) => r.id),
      { groupId },
      request.log,
    )
    return reply.send(
      success({ updated: updated.length, ids: updated.map((r) => r.id), folder: nextFolder }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
