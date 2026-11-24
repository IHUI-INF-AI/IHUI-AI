// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代理类 /openrouter-proxy/*(2 个端点)。
 * 委托到 VENDOR_CONFIGS 机制(chat-models.ts),复用现有 LLM 代理实现。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { success, error } from '../../utils/response.js'
import { ensurePointsBalance, chargePointsForCall } from '../ai-vendors/proxy-llm.js'
import { recordUsage } from '../ai-vendors/_shared.js'

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
): Promise<Record<string, unknown> | null> {
  const cfg = VENDOR_BASES[vendor]
  if (!cfg) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return null
  }
  const key = process.env[cfg.keyEnv] ?? ''
  if (!key) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return null
  }
  try {
    // F-93:补超时,避免上游无响应时连接长期挂起。
    const resp = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      // F-93:上游错误体不再原样回吐(可能含账号/配额细节),仅回状态码。
      reply.status(502).send(error(502, `${cfg.name} 上游调用失败: ${resp.status}`))
      return null
    }
    return data as Record<string, unknown>
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `调用异常: ${msg}`))
    return null
  }
}

const proxyRoutes: FastifyPluginAsync = async (server) => {
  server.post('/openrouter-proxy/chat/completions', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const model = typeof body.model === 'string' ? body.model : ''
    // F-93:此前直接拿平台 OpenRouter Key 透传,无余额闸、无结算、无超时。
    if (!(await ensurePointsBalance(request, reply, model))) return
    const data = await proxyChatCompletion('openrouter', body, reply)
    if (data === null) return
    recordUsage(request.userId!, 'openrouter')
    await chargePointsForCall(request, model, data, request.id)
    return reply.send(success(data))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
