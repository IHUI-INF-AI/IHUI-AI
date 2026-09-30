// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

/**
 * 元学习闭环路由(2026-09-30 改为透传代理)。
 *
 * 本文件是代理,真相源在 ai-service app/routers/meta_learning.py(prefix
 * /api/admin/meta-learner):路径与方法逐字对齐上游,不编造任何 fallback 数据。
 * 上游不可用/失败一律 502 明示。
 */

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

async function proxyGet(
  request: FastifyRequest,
  reply: FastifyReply,
  upstreamPath: string,
): Promise<void> {
  const parsed = limitQuerySchema.safeParse(request.query)
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50
  const path = `${upstreamPath}?limit=${encodeURIComponent(String(limit))}`
  try {
    const upstream = await aiServiceFetch(request, path, { method: 'GET' })
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        // 保留原始 text
      }
    }
    if (upstream.ok) {
      return reply.status(upstream.status).send(success(payload))
    }
    const detail =
      payload !== null && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : null
    reply.status(upstream.status).send(error(upstream.status, detail ?? '元学习请求失败'))
  } catch (e) {
    request.log.error({ err: e, path }, 'meta-learner proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

const metaLearnerRoutes: FastifyPluginAsync = async (server) => {
  // 插件级 requireAdmin 兜底(挂载于 /api/admin/*,与代理前一致保留)。
  server.addHook('preHandler', async (request, reply) => {
    return requireAdmin(request, reply)
  })

  // GET /api/admin/meta-learner/lessons → GET /api/admin/meta-learner/lessons
  server.get('/lessons', async (request, reply) => {
    await proxyGet(request, reply, '/api/admin/meta-learner/lessons')
  })

  // GET /api/admin/meta-learner/agent-failures → GET /api/admin/meta-learner/agent-failures
  server.get('/agent-failures', async (request, reply) => {
    await proxyGet(request, reply, '/api/admin/meta-learner/agent-failures')
  })

  // POST /api/admin/meta-learner/trigger → POST /api/admin/meta-learner/trigger
  server.post('/trigger', async (request, reply) => {
    try {
      const upstream = await aiServiceFetch(request, '/api/admin/meta-learner/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body ?? {}),
      })
      const text = await upstream.text()
      let payload: unknown = text
      const ct = upstream.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          // 保留原始 text
        }
      }
      if (upstream.ok) {
        return reply.status(upstream.status).send(success(payload))
      }
      const detail =
        payload !== null && typeof payload === 'object' && 'detail' in payload
          ? String((payload as { detail: unknown }).detail)
          : null
      reply.status(upstream.status).send(error(upstream.status, detail ?? '元学习触发失败'))
    } catch (e) {
      request.log.error({ err: e }, 'meta-learner trigger proxy failed')
      reply.status(502).send(error(502, 'ai-service unavailable'))
    }
  })
}

export default metaLearnerRoutes
