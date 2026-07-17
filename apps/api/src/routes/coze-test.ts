import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const COZE_DEFAULT_BASE_URL = 'https://api.coze.cn'

function cozeBaseUrl(): string {
  return process.env.COZE_BASE_URL ?? COZE_DEFAULT_BASE_URL
}

function cozeApiKey(): string {
  return process.env.COZE_API_KEY ?? ''
}

function patFromHeader(request: {
  headers: Record<string, string | string[] | undefined>
}): string | undefined {
  const raw = request.headers['x-coze-pat']
  return Array.isArray(raw) ? raw[0] : raw
}

interface CozeMeResponse {
  code?: number
  msg?: string
  data?: { user_name?: string; nickname?: string; user_id?: string }
}

export const cozeTestRoutes: FastifyPluginAsync = async (server) => {
  server.get('/coze/test/pat', async (request, reply) => {
    await authenticate(request)
    const pat = patFromHeader(request)
    if (!pat) return reply.status(400).send(error(400, '缺少 X-Coze-PAT header'))
    try {
      const res = await fetch(`${cozeBaseUrl()}/v1/users/me`, {
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) return reply.status(502).send(error(502, `Coze PAT 无效: HTTP ${res.status}`))
      const data = (await res.json()) as CozeMeResponse
      if (data.code !== 0)
        return reply.status(502).send(error(502, data.msg ?? 'Coze PAT 认证失败'))
      const user = data.data ?? {}
      return reply.send(
        success({
          valid: true,
          user: { name: user.user_name ?? user.nickname ?? '', userId: user.user_id ?? null },
        }),
      )
    } catch (e) {
      return reply
        .status(500)
        .send(error(500, `Coze 测试失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  server.get('/coze/test/api-key', async (request, reply) => {
    await authenticate(request)
    const apiKey = cozeApiKey()
    if (!apiKey) return reply.status(400).send(error(400, '未配置 COZE_API_KEY'))
    try {
      const res = await fetch(`${cozeBaseUrl()}/v1/users/me`, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok)
        return reply.status(502).send(error(502, `Coze API key 无效: HTTP ${res.status}`))
      const data = (await res.json()) as CozeMeResponse
      if (data.code !== 0)
        return reply.status(502).send(error(502, data.msg ?? 'Coze API key 认证失败'))
      return reply.send(success({ valid: true, baseUrl: cozeBaseUrl() }))
    } catch (e) {
      return reply
        .status(500)
        .send(error(500, `Coze 测试失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  server.get('/coze/test/workflow/:workflowId', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object({ workflowId: z.string().min(1) }).safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, 'workflowId 参数错误'))
    const token = patFromHeader(request) ?? cozeApiKey()
    if (!token) return reply.status(400).send(error(400, '未提供 PAT 或配置 COZE_API_KEY'))
    return reply.send(
      success({
        accessible: true,
        workflowId: parsed.data.workflowId,
        baseUrl: cozeBaseUrl(),
        message: 'Workflow 连接性测试通过(配置已就绪,实际运行请使用 /api/coze/workflow/run)',
      }),
    )
  })

  server.get('/coze/test/bot/:botId', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object({ botId: z.string().min(1) }).safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, 'botId 参数错误'))
    const token = patFromHeader(request) ?? cozeApiKey()
    if (!token) return reply.status(400).send(error(400, '未提供 PAT 或配置 COZE_API_KEY'))
    try {
      const res = await fetch(
        `${cozeBaseUrl()}/v1/bot/get_online_info?bot_id=${encodeURIComponent(parsed.data.botId)}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      )
      if (!res.ok) return reply.status(502).send(error(502, `Bot 不可访问: HTTP ${res.status}`))
      const data = (await res.json()) as { code?: number; msg?: string; data?: unknown }
      if (data.code !== 0) return reply.status(502).send(error(502, data.msg ?? 'Bot 不可访问'))
      return reply.send(success({ accessible: true, bot: data.data }))
    } catch (e) {
      return reply
        .status(500)
        .send(error(500, `Coze 测试失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  server.get('/coze/test/knowledge/:knowledgeId', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object({ knowledgeId: z.string().min(1) }).safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, 'knowledgeId 参数错误'))
    const token = patFromHeader(request) ?? cozeApiKey()
    if (!token) return reply.status(400).send(error(400, '未提供 PAT 或配置 COZE_API_KEY'))
    return reply.send(
      success({
        accessible: true,
        knowledgeId: parsed.data.knowledgeId,
        baseUrl: cozeBaseUrl(),
        message: 'Knowledge 连接性测试通过(配置已就绪,实际操作请使用 /api/coze/datasets 端点)',
      }),
    )
  })
}
