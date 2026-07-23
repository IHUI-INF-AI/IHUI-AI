/**
 * LLM 流式补全(从 frontend-stub-other-routes.ts 拆分)。
 * POST /llm/complete/stream — 代理到 AI-service /api/llm/complete/stream(SSE 透传),done/error 时异步落库 llm_call_logs
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { llmCallLogs } from '@ihui/database'
import { aiServiceFetchStream } from '../../utils/ai-service-fetch.js'

const llmStreamSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(32000),
      }),
    )
    .min(1)
    .max(50),
  model: z.string().max(100).optional(),
  conversationId: z.string().max(100).optional(),
})

export const llmStreamRoutes: FastifyPluginAsync = async (server) => {
  server.post('/llm/complete/stream', async (request, reply) => {
    const parsed = llmStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { messages: reqMessages, model: reqModel, conversationId } = parsed.data

    const startTime = Date.now()
    const logId = randomUUID()
    let accumulatedContent = ''
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {}
    let resolvedModel = reqModel ?? 'gpt-4o-mini'
    let errorMessage: string | null = null
    let upstreamStatus: number | null = null

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    try {
      const resp = await aiServiceFetchStream(request, '/api/llm/complete/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          messages: reqMessages,
          model: reqModel,
          metadata: { userId: request.userId, conversationId },
        }),
        signal: controller.signal,
      })

      upstreamStatus = resp.status
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '')
        errorMessage = `upstream ${resp.status}`
        raw.write(
          `data: ${JSON.stringify({ error: `${errorMessage}: ${errText.slice(0, 200)}` })}\n\n`,
        )
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        raw.write(value)
        const text = decoder.decode(value, { stream: true })
        buffer += text
        // 解析 SSE 事件累加 content/usage/model(简易解析,容忍格式不全)
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const ev = JSON.parse(line.slice(5).trim()) as Record<string, unknown>
              if (ev.type === 'chunk' && typeof ev.content === 'string') {
                accumulatedContent += ev.content
              } else if (ev.type === 'done') {
                if (typeof ev.model === 'string') resolvedModel = ev.model
                if (ev.usage && typeof ev.usage === 'object') {
                  usage = ev.usage as typeof usage
                }
              } else if (ev.type === 'error' && typeof ev.message === 'string') {
                errorMessage = ev.message
              }
            } catch {
              /* 忽略非 JSON 行(心跳/空行) */
            }
          }
        }
      }
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '客户端断开' : (e as Error).message
      errorMessage = msg
      raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
    } finally {
      request.raw.off('close', onClose)
      raw.end()

      // 异步落库 llm_call_logs(失败仅 warn,不阻塞响应)
      try {
        const latencyMs = Date.now() - startTime
        const status = errorMessage ? 'error' : 'success'
        const promptText = reqMessages
          .map((m) => `${m.role}:${m.content}`)
          .join('\n')
          .slice(0, 4000)
        await db.insert(llmCallLogs).values({
          id: logId,
          userId: request.userId!,
          model: resolvedModel,
          prompt: promptText,
          response: accumulatedContent ? accumulatedContent.slice(0, 4000) : null,
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
          latencyMs,
          status,
          errorMessage,
          conversationId: conversationId ?? null,
        })
      } catch (e) {
        request.log.warn(
          { err: (e as Error).message, upstreamStatus },
          'llm_call_logs insert failed',
        )
      }
    }
  })
}
