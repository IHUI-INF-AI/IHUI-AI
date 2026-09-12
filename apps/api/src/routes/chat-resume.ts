// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
import { checkAuth } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import { findConversationById, findMessageById } from '../db/chat-queries.js'
import { aiServiceFetchStream } from '../utils/ai-service-fetch.js'
import { loadRepoWikiContext } from '../services/repo-wiki-context.js'

/**
 * P1-6 断点续传(2026-09-13 立,PROJECT_PLAN.md 2549 行)
 *
 * 背景:SSE 中断(网络抖动/刷新页面)时旧链路只能整条重新生成。本文件在不侵入
 * chat.ts / chat-queries.ts(并行会话 WIP)的前提下,提供消息级 resume:
 *   - GET  /api/chat/resume/status  —— 查询该助手消息是否已落库(落库 = 推理已完成)
 *   - POST /api/chat/resume         —— 未完成时用「已生成前缀」作为上下文继续流式生成,
 *                                     SSE 事件格式与 /api/ai/chat/stream 完全一致,
 *                                     前端可直接复用既有 onDelta/onToolCall/onDone 处理器。
 *
 * 语义说明(尽力续接,不追求真·断点续生成):
 * 助手消息由后端 ai-callback worker 在推理完成后落库 —— 因此:
 *   - 消息已落库 → completed=true,无需续接(前端直接回填内容即可)
 *   - 消息未落库 → 说明流被中断,前端本地存有部分前缀;把前缀作为 assistant 消息
 *     置于上下文末尾调用 LLM,模型自然续写,SSE 透传给前端。
 */

const statusSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
})

const resumeSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  /** 上下文:历史消息 + 末尾一条 assistant(已生成前缀,模型据此续写) */
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .min(1),
  model: z.string().optional(),
  /** ChatMode 5 态透传(与 /ai/chat/stream 同语义) */
  mode: z.string().optional(),
  /** P1-7(2026-09-13):会话级高级参数——刷新续接同样要保持原有采样参数与自定义 system prompt,
   *  否则刷新页面后续写的回复会悄悄回落到模型默认(参数"半途丢失")。 */
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(1000).optional(),
  maxTokens: z.number().int().min(1).max(200_000).optional(),
  systemPrompt: z.string().max(8000).optional(),
  contextLimit: z.number().int().min(0).max(2_000_000).optional(),
  /** P1-8(2026-09-13 立,Repo Wiki):续流同样按仓库名注入「项目百科」,
   *  否则刷新续接后的回复会突然失去项目百科背景(与采样参数"半途丢失"同型的一致性问题)。
   *  上限与 /repo-wiki 生成接口对齐(200)。 */
  repoName: z.string().max(200).optional(),
  metadata: z
    .object({
      conversationId: z.string().optional(),
      userId: z.string().optional(),
      messageId: z.string().optional(),
    })
    .optional(),
})

/** 会话归属校验:不存在或非本人 → false(调用方返回 404) */
async function assertOwnedConversation(
  request: FastifyRequest,
  conversationId: string,
): Promise<boolean> {
  const conv = await findConversationById(conversationId)
  if (!conv || conv.userId !== request.userId) return false
  return true
}

/** SSE 响应头(与 ai-chat-stream.ts 同套:绕过 cors 插件需手动回显 Origin) */
function writeSseHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin as string | undefined
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  reply.raw.writeHead(200, headers)
}

export const chatResumeRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /api/chat/resume/status?conversationId=xx&messageId=yy
  // 返回 { exists, completed, content, updatedAt }。completed=true 表示推理已完成(已落库),
  // 前端无需续接,直接回填 content 即可。
  server.get('/resume/status', async (request, reply) => {
    const parsed = statusSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, messageId } = parsed.data
    if (!(await assertOwnedConversation(request, conversationId))) {
      return reply.status(404).send(error(404, '对话不存在或无权限'))
    }
    const msg = await findMessageById(messageId)
    if (!msg || msg.conversationId !== conversationId) {
      return reply.send(success({ exists: false, completed: false, content: '', updatedAt: null }))
    }
    return reply.send(
      success({
        exists: true,
        completed: true,
        content: msg.content ?? '',
        updatedAt: msg.createdAt ?? null,
      }),
    )
  })

  // POST /api/chat/resume —— 断点续传流式生成
  // 请求:messages 末尾为 assistant 前缀(前端本地已生成的部分内容)
  // 响应:SSE,首事件 data: {"resume": {...}} 告知续接偏移,随后与 /ai/chat/stream 同格式
  //       透传 ai-service /api/llm/complete/stream 的事件流。
  server.post(
    '/resume',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute', keyGenerator: (req) => req.userId || req.ip },
      },
    },
    async (request, reply) => {
      const parsed = resumeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const {
        conversationId,
        messageId,
        messages,
        model,
        mode,
        temperature,
        topP,
        topK,
        maxTokens,
        systemPrompt,
        contextLimit,
        repoName,
        metadata,
      } = parsed.data

      if (!(await assertOwnedConversation(request, conversationId))) {
        return reply.status(404).send(error(404, '对话不存在或无权限'))
      }

      reply.hijack()
      writeSseHeaders(request, reply)
      const raw = reply.raw

      // 已落库 → 推理已完成,直接回 resumed(completed) 事件,不再调用 LLM
      const existing = await findMessageById(messageId)
      if (existing && existing.conversationId === conversationId) {
        raw.write(
          `data: ${JSON.stringify({
            resume: {
              messageId,
              conversationId,
              offset: (existing.content ?? '').length,
              completed: true,
            },
          })}\n\n`,
        )
        raw.end()
        return
      }

      const { repaired: finalMessages } = repairMessages(messages, { keepTrailingUser: false })
      const prefix = finalMessages[finalMessages.length - 1]
      const offset = prefix?.role === 'assistant' ? (prefix.content ?? '').length : 0

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5 * 60_000)
      const onClose = () => controller.abort()
      request.raw.on('close', onClose)

      try {
        raw.write(
          `data: ${JSON.stringify({
            resume: { messageId, conversationId, offset, completed: false },
          })}\n\n`,
        )

        // P1-8(2026-09-13 立):读取「项目百科」总览(失败/未命中一律 null,不阻塞续流)
        const wiki = await loadRepoWikiContext(metadata?.userId ?? request.userId ?? null, repoName)
        const resp = await aiServiceFetchStream(request, '/api/llm/complete/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: request.headers.authorization ?? '',
          },
          body: JSON.stringify({
            messages: finalMessages,
            model,
            mode,
            // P1-7(2026-09-13):续接保持会话级参数(undefined 时 JSON.stringify 自动省略)
            temperature,
            top_p: topP,
            top_k: topK,
            max_tokens: maxTokens,
            system_prompt: systemPrompt,
            // P1-8(2026-09-13):项目百科透传(undefined 时 JSON.stringify 自动省略)
            wiki_context: wiki?.content,
            wiki_repo: wiki?.repoName,
            contextLimit: contextLimit ?? 0,
            metadata: {
              conversationId,
              userId: metadata?.userId ?? request.userId,
              messageId,
              // 标记续接流:ai-service 可据此跳过重复落库/扣费前置动作(未知字段安全忽略)
              resumed: true,
            },
          }),
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => '')
          raw.write(
            `data: ${JSON.stringify({ error: `upstream ${resp.status}: ${errText.slice(0, 200)}` })}\n\n`,
          )
          return
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, '')
            buffer = buffer.slice(nl + 1)
            raw.write(line + '\n')
          }
        }
        if (buffer) raw.write(buffer)
      } catch (e) {
        const msg =
          (e as Error).name === 'AbortError' ? '续接流已取消' : ((e as Error).message ?? '续接失败')
        raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
      } finally {
        request.raw.off('close', onClose)
        clearTimeout(timeout)
        raw.end()
      }
    },
  )
}
