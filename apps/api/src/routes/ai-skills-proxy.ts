import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { authenticate } from '../plugins/auth.js'
import { error } from '../utils/response.js'

/**
 * AI Skills 转发代理(2026-08-26 立)
 *
 * 背景:web 端靠 next.config.ts rewrites 把 /api/ai-skills 转发到 ai-service(8803),
 * 但移动端 fetchApi 走 api(8802)——此前 8802 无此路由,移动端 AI 技能 404(M3 补齐时发现)。
 * 本路由在 api 提供统一入口,透传 GET /api/ai-skills、GET /:id、POST /:id/invoke 到 ai-service。
 */
async function forward(request: FastifyRequest, reply: FastifyReply, path: string, init: RequestInit = {}) {
  try {
    const resp = await aiServiceFetch(request, path, { ...init, headers: init.headers as Record<string, string> | undefined })
    const body = await resp.text()
    return reply
      .status(resp.status)
      .header('content-type', resp.headers.get('content-type') ?? 'application/json; charset=utf-8')
      .send(body)
  } catch {
    return reply.status(502).send(error(502, 'AI 技能服务暂不可用'))
  }
}

export const aiSkillsProxyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
  })

  // GET /api/ai-skills?category=all — 技能列表
  server.get('/', async (request, reply) => {
    const qs = request.url.includes('?') ? `?${request.url.split('?')[1]}` : ''
    return forward(request, reply, `/api/ai-skills${qs}`, { method: 'GET' })
  })

  // GET /api/ai-skills/:id — 技能详情
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return forward(request, reply, `/api/ai-skills/${encodeURIComponent(id)}`, { method: 'GET' })
  })

  // POST /api/ai-skills/:id/invoke — 调用技能
  server.post('/:id/invoke', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body === undefined ? undefined : JSON.stringify(request.body)
    return forward(request, reply, `/api/ai-skills/${encodeURIComponent(id)}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  })
}
