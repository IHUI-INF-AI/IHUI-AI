/**
 * AI 助教路由代理 — 把 /api/ai-tutor/* 透传到 ai-service 的 /api/ai-tutor/*。
 *
 * 端点清单:
 *   POST /ai-tutor/explain  学科概念讲解
 *   POST /ai-tutor/hint     提示引导(不直接给答案)
 *   POST /ai-tutor/quiz     AI 出题
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - POST 透传到 ai-service,Body 不解析(直接转发)
 * - 前端通过 fetchApi 调用 /api/ai-tutor/*,由 API 服务代理到 ai-service(避免 CORS / 直连)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error } from '../utils/response.js'

async function proxyToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> {
  const url = `${config.AI_SERVICE_URL}/api/ai-tutor${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  const body = JSON.stringify(request.body ?? {})

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body,
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
    reply.status(upstream.status).send(payload)
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
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  server.post('/ai-tutor/explain', async (request, reply) => {
    await proxyToAiService(request, reply, '/explain')
  })

  server.post('/ai-tutor/hint', async (request, reply) => {
    await proxyToAiService(request, reply, '/hint')
  })

  server.post('/ai-tutor/quiz', async (request, reply) => {
    await proxyToAiService(request, reply, '/quiz')
  })
}
