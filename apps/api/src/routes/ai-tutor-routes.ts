// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 助教路由代理 — 把 /api/ai-tutor/* 透传到 ai-service 的 /api/ai-tutor/*。
 *
 * 端点清单:
 *   POST /ai-tutor/explain  学科概念讲解
 *   POST /ai-tutor/hint     提示引导(不直接给答案)
 *   POST /ai-tutor/quiz     AI 出题
 *   GET  /ai-tutor/history  当前用户最近问答(ai_tutor_logs)
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - POST 透传到 ai-service;成功应答落库 ai_tutor_logs(问/答/上下文/模型),
 *   "学-练-测-评"从此可回收(G-978072)。落库失败只记日志,不影响应答。
 * - 前端通过 fetchApi 调用 /api/ai-tutor/*,由 API 服务代理到 ai-service(避免 CORS / 直连)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { desc, eq } from 'drizzle-orm'

import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { aiTutorLogs } from '@ihui/database'
import { error, success } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'

interface AiTutorBody {
  subject?: string
  question?: string
  context?: unknown
  count?: number
}

async function proxyToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
  mode: 'explain' | 'hint' | 'quiz',
): Promise<void> {
  const url = `${config.AI_SERVICE_URL}/api/ai-tutor${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  const body = (request.body ?? {}) as AiTutorBody
  const bodyText = JSON.stringify(body)

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyText,
    })
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        // 保留原始 text
      }
    }
    // 成功应答落库(问答历史);失败/非 JSON 不落,保持日志表只含有效问答
    if (upstream.ok && payload && typeof payload === 'object') {
      try {
        await db.insert(aiTutorLogs).values({
          userId: request.userId!,
          mode,
          subject: body.subject ?? null,
          question: body.question ?? '',
          context: body.context ?? null,
          answer: payload,
          model: null,
        })
      } catch (e) {
        request.log.error({ err: e }, 'ai-tutor log persist failed')
      }
    }
    // ai-service 是非标准响应(无 {code,data} 包装),代理层统一转成站内信封:
    // 前端 fetchApi 对所有 /api/* 端点按同一信封语义消费。
    if (upstream.ok) {
      reply.status(upstream.status).send(success(payload))
    } else {
      const detail =
        payload && typeof payload === 'object' && 'detail' in payload
          ? String((payload as { detail: unknown }).detail)
          : null
      reply.status(upstream.status).send(error(upstream.status, detail || 'AI 助教请求失败'))
    }
  } catch (e) {
    request.log.error({ err: e, url }, 'ai-tutor proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

export const aiTutorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      // 2026-08-06 修复:必须 return reply,防止 handler 在未认证时继续执行
      return reply
        .status(statusCode)
        .send(error(statusCode, toUserFriendlyMessage(e) || '需要登录'))
    }
  })

  server.post('/ai-tutor/explain', async (request, reply) => {
    await proxyToAiService(request, reply, '/explain', 'explain')
  })

  server.post('/ai-tutor/hint', async (request, reply) => {
    await proxyToAiService(request, reply, '/hint', 'hint')
  })

  server.post('/ai-tutor/quiz', async (request, reply) => {
    await proxyToAiService(request, reply, '/quiz', 'quiz')
  })

  // GET /ai-tutor/history - 当前用户最近 AI 助教问答(倒序,默认 20 条)
  server.get('/ai-tutor/history', async (request, reply) => {
    const q = (request.query ?? {}) as { limit?: unknown }
    const limitRaw = Number(q.limit)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20
    const rows = await db
      .select({
        id: aiTutorLogs.id,
        mode: aiTutorLogs.mode,
        subject: aiTutorLogs.subject,
        question: aiTutorLogs.question,
        context: aiTutorLogs.context,
        answer: aiTutorLogs.answer,
        createdAt: aiTutorLogs.createdAt,
      })
      .from(aiTutorLogs)
      .where(eq(aiTutorLogs.userId, request.userId!))
      .orderBy(desc(aiTutorLogs.createdAt))
      .limit(limit)
    return reply.send(success({ list: rows }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
