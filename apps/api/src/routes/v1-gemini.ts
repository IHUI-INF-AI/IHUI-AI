// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1beta/* — Gemini 协议入站(2026-09-13 立)。
 *
 * 端点:
 * 1. GET  /v1beta/models                              — Gemini ListModels 格式
 * 2. POST /v1beta/models/{model}:generateContent      — 非流式
 * 3. POST /v1beta/models/{model}:streamGenerateContent — SSE 流式(alt=sse 风格)
 *
 * 鉴权:与 OpenAI 链路同一套 developerApiKeys,兼容三种入站方式:
 *   Authorization: Bearer ihui_xxx(原生)/ X-Api-Key(原生)/
 *   x-goog-api-key 或 ?key=(Gemini SDK 默认,mapGeminiAuth preHandler 映射)
 *
 * 实现:协议转换在 gemini-protocol.ts(纯函数);转发复用 v1 公开链路共享核
 * (getV1ChatCore:渠道 failover + 两段式计费 + 响应缓存),通过捕获式 reply
 * (非流式)与 SSE 桥接流(流式)在边界做格式适配。v1PublicRoutes 必须先注册。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { Writable } from 'node:stream'
import { eq, and } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiModelConfigModels } from '@ihui/database'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { getV1ChatCore } from './v1-public.js'
import type { V1ChatCompletionResponse } from '@ihui/types'
import {
  geminiRequestSchema,
  geminiToChatBody,
  chatToGeminiResponse,
  geminiStreamChunk,
  geminiStreamFinalChunk,
  openAiErrorToGemini,
  toGeminiModelEntry,
  type GeminiRequest,
  type ChatCoreBody,
} from '../services/gemini-protocol.js'

// =============================================================================
// 鉴权映射:Gemini SDK 的 x-goog-api-key / ?key= → Authorization Bearer
// =============================================================================
async function mapGeminiAuth(request: FastifyRequest): Promise<void> {
  if (request.headers.authorization) return
  let key: string | null = null
  const goog = request.headers['x-goog-api-key']
  if (typeof goog === 'string' && goog.trim()) key = goog.trim()
  if (!key) {
    const q = (request.query ?? {}) as { key?: string }
    if (typeof q.key === 'string' && q.key.trim()) key = q.key.trim()
  }
  if (key) request.headers.authorization = `Bearer ${key}`
}

// =============================================================================
// 捕获式 reply(非流式):拦截 send/status/header,由调用方做格式适配后回发
// =============================================================================
interface CapturedOutcome {
  kind: 'json'
  status: number
  body: unknown
}

function makeCapturingReply(
  real: FastifyReply,
  outcome: CapturedOutcome,
  rawOverride?: Writable,
): FastifyReply {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'send') {
        return (body?: unknown) => {
          outcome.body = body
          return receiver
        }
      }
      if (prop === 'status') {
        return (code: number) => {
          outcome.status = code
          return receiver
        }
      }
      if (prop === 'header' || prop === 'headers') return () => receiver
      if (prop === 'hijack') return () => undefined
      if (prop === 'raw' && rawOverride) return rawOverride
      return Reflect.get(target, prop, target)
    },
  }) as FastifyReply
}

// =============================================================================
// SSE 桥接流(流式):上游 OpenAI chunk → Gemini chunk 实时转译
// =============================================================================
function createGeminiStreamBridge(
  real: FastifyReply,
  model: string,
  estimatedPromptTokens: number,
): Writable {
  let headerWritten = false
  let buffer = ''
  let responseChars = 0
  let finalSent = false
  const usage = {
    promptTokenCount: estimatedPromptTokens,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  }

  const writeRaw = (s: string) => real.raw.write(s)
  const sendFinal = () => {
    if (finalSent) return
    finalSent = true
    usage.candidatesTokenCount = Math.ceil(responseChars / 4)
    usage.totalTokenCount = usage.promptTokenCount + usage.candidatesTokenCount
    writeRaw(`data: ${JSON.stringify(geminiStreamFinalChunk(model, usage))}\n\n`)
  }

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let json: Record<string, unknown>
    try {
      json = JSON.parse(payload) as Record<string, unknown>
    } catch {
      return
    }
    const choices = json['choices'] as Array<Record<string, unknown>> | undefined
    const delta = choices?.[0]?.['delta'] as Record<string, unknown> | undefined
    const content = delta?.['content']
    const usageRaw = json['usage'] as Record<string, unknown> | undefined
    if (usageRaw && typeof usageRaw === 'object') {
      const p = usageRaw['prompt_tokens']
      const c = usageRaw['completion_tokens']
      const t = usageRaw['total_tokens']
      if (typeof p === 'number' && p >= 0) usage.promptTokenCount = Math.floor(p)
      if (typeof c === 'number' && c >= 0) usage.candidatesTokenCount = Math.floor(c)
      if (typeof t === 'number' && t >= 0) usage.totalTokenCount = Math.floor(t)
    }
    if (typeof content === 'string' && content.length > 0) {
      responseChars += content.length
      writeRaw(`data: ${JSON.stringify(geminiStreamChunk(content, model))}\n\n`)
    }
    const finishReason = choices?.[0]?.['finish_reason']
    if (typeof finishReason === 'string' && finishReason) {
      sendFinal()
    }
  }

  return new Writable({
    write(chunk: Buffer, _enc, cb) {
      if (!headerWritten) {
        real.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        })
        headerWritten = true
      }
      buffer += chunk.toString('utf8')
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        handleLine(line)
      }
      cb()
    },
    final(cb) {
      if (buffer.trim()) handleLine(buffer.trim())
      sendFinal()
      real.raw.end()
      cb()
    },
  })
}

/** 非流式/流式错误统一回发 */
function sendGeminiError(reply: FastifyReply, status: number, message: string): FastifyReply {
  return reply.status(status).send(openAiErrorToGemini(status, { message }))
}

// =============================================================================
// 路由插件
// =============================================================================
const v1GeminiRoutes: FastifyPluginAsync = async (server) => {
  const chatCore = getV1ChatCore()

  // ===== 1. GET /models — Gemini ListModels =====
  server.get(
    '/models',
    {
      preHandler: [
        mapGeminiAuth,
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      const rows = await dbRead
        .select({
          modelId: aiModelConfigModels.modelId,
          displayName: aiModelConfigModels.displayName,
          relayDisplayName: aiModelConfigModels.relayDisplayName,
        })
        .from(aiModelConfigModels)
        .where(
          and(eq(aiModelConfigModels.enabled, true), eq(aiModelConfigModels.isRelayPublic, true)),
        )
      return reply.send({
        models: rows.map((r) =>
          toGeminiModelEntry(r.modelId, r.relayDisplayName ?? r.displayName ?? r.modelId),
        ),
      })
    },
  )

  // ===== 2/3. POST /models/{model}:generateContent | :streamGenerateContent =====
  server.post(
    '/models/:modelAction',
    {
      preHandler: [
        mapGeminiAuth,
        requireApiKeyAuth,
        requireApiKeyPermission('chat:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { modelAction } = request.params as { modelAction: string }
      const sepIdx = modelAction.lastIndexOf(':')
      if (sepIdx <= 0) {
        return sendGeminiError(reply, 400, 'invalid path: expected /models/{model}:generateContent')
      }
      const model = modelAction.slice(0, sepIdx)
      const action = modelAction.slice(sepIdx + 1)
      const stream = action === 'streamGenerateContent'
      if (action !== 'generateContent' && !stream) {
        return sendGeminiError(reply, 404, `unsupported action: ${action}`)
      }

      const parsed = geminiRequestSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return sendGeminiError(
          reply,
          400,
          parsed.error.issues[0]?.message ?? 'invalid request body',
        )
      }

      const converted = geminiToChatBody(model, parsed.data as GeminiRequest)
      if (!converted.ok) return sendGeminiError(reply, 400, converted.message)

      const coreBody: ChatCoreBody = {
        ...converted.body,
        stream,
      }
      // prompt 估算(与 OpenAI 链路同口径:字符数/4),供流式 usageMetadata 兜底
      const estimatedPromptTokens = Math.ceil(
        coreBody.messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
      )

      if (stream) {
        const bridge = createGeminiStreamBridge(reply, model, estimatedPromptTokens)
        // 先真实 hijack(Fastify 交出响应权),共享核内部对 fake reply 的 hijack 为空操作
        reply.hijack()
        const fakeReply = makeCapturingReply(
          reply,
          { kind: 'json', status: 200, body: null },
          bridge,
        )
        await chatCore(request, fakeReply, coreBody, 'chat')
        // 桥接流 final() 已回写 Gemini chunk 并 end,此处无需再动响应
        return reply
      }

      const outcome: CapturedOutcome = { kind: 'json', status: 200, body: null }
      const fakeReply = makeCapturingReply(reply, outcome)
      await chatCore(request, fakeReply, coreBody, 'chat')

      if (outcome.status === 200) {
        return reply.send(chatToGeminiResponse(outcome.body as V1ChatCompletionResponse))
      }
      return reply.status(outcome.status).send(openAiErrorToGemini(outcome.status, outcome.body))
    },
  )
}

export default v1GeminiRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
