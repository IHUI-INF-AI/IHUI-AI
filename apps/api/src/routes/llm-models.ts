import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
}

export const llmModelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  server.get('/models', async (request, reply) => {
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, {
        method: 'GET',
        headers: {
          Authorization: request.headers.authorization ?? '',
        },
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `AI service unavailable: ${resp.status} ${text.slice(0, 200)}`))
      }

      const data = await resp.json()
      return reply.send(success(data))
    } catch (e) {
      return reply.status(502).send(error(502, (e as Error).message || 'AI service unavailable'))
    }
  })
}
