/**
 * 代理类 /openrouter-proxy/*(2 个端点)。
 * 委托到 VENDOR_CONFIGS 机制(chat-models.ts),复用现有 LLM 代理实现。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { success, error } from '../../utils/response.js'

const VENDOR_BASES: Record<string, { base: string; keyEnv: string; name: string }> = {
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    name: 'OpenRouter',
  },
}

async function proxyChatCompletion(
  vendor: string,
  body: Record<string, unknown>,
  reply: FastifyReply,
): Promise<void> {
  const cfg = VENDOR_BASES[vendor]
  if (!cfg) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return
  }
  const key = process.env[cfg.keyEnv] ?? ''
  if (!key) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return
  }
  try {
    const resp = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(error(502, `上游 ${resp.status}: ${JSON.stringify(data).slice(0, 500)}`))
      return
    }
    reply.send(success(data))
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `调用异常: ${msg}`))
  }
}

const proxyRoutes: FastifyPluginAsync = async (server) => {
  server.post('/openrouter-proxy/chat/completions', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    await proxyChatCompletion('openrouter', body, reply)
  })

  server.get('/openrouter-proxy/models', async (_request, reply) => {
    const cfg = VENDOR_BASES.openrouter
    if (!cfg) {
      reply.status(400).send(error(400, '不支持的厂商: openrouter'))
      return
    }
    const key = process.env[cfg.keyEnv] ?? ''
    if (!key) {
      reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
      return
    }
    try {
      const resp = await fetch(`${cfg.base}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await resp.json().catch(() => ({ data: [] }))
      if (!resp.ok) {
        reply.status(502).send(error(502, `上游 ${resp.status}`))
        return
      }
      reply.send(success(data))
    } catch (e) {
      reply.status(502).send(error(502, `调用异常: ${(e as Error).message}`))
    }
  })
}

export default proxyRoutes
