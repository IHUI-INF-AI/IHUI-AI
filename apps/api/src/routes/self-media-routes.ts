/**
 * 自媒体路由代理 — 把 /api/self-media/* 透传到 ai-service 的 /api/self-media/*。
 *
 * 端点清单(完整代理):
 *   GET  /self-media/skills                          列出 2 个 skill 元数据
 *   GET  /self-media/skills/:skillId                 获取单个 skill 详情
 *   POST /self-media/skills/:skillId/invoke          AI 对话框调用 skill
 *   POST /self-media/wechat/generate                 生成公众号文章(dry-run)
 *   POST /self-media/wechat/validate                 跑 22 项自检
 *   POST /self-media/wechat/publish                  推送草稿箱(默认 dry-run)
 *   GET  /self-media/wechat/history                  查询公众号历史
 *   POST /self-media/koubo/generate                  生成口播稿(引导)
 *   POST /self-media/koubo/validate                  双门禁验证
 *   GET  /self-media/koubo/history                   查询口播稿历史
 *   POST /self-media/record                          推送成功后写 self_media_published 表
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - GET/POST 透传到 ai-service,Body 不解析(直接转发)
 * - /record 是 api 唯一自实现端点(直接写数据库,因为 ai-service 不写库)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { selfMediaPublished } from '@ihui/database'

import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const recordSchema = z.object({
  category: z.enum(['wechat', 'koubo']),
  title: z.string().min(1).max(200),
  status: z.enum(['generated', 'published', 'failed']).default('generated'),
  draftId: z.string().max(128).optional(),
  topicKeyword: z.string().max(200).optional(),
  payload: z.record(z.unknown()).optional(),
})

const HISTORY_LIMIT = 100

async function proxyToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> {
  const url = `${config.AI_SERVICE_URL}/api/self-media${path}`
  const method = request.method
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // 转发 JWT(让 ai-service 共享鉴权上下文)
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = JSON.stringify(request.body ?? {})
  }

  try {
    const upstream = await fetch(url, { method, headers, body })
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
    request.log.error({ err: e, url }, 'self-media proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

export const selfMediaRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // ===== skills 元数据 + 调用 =====

  server.get('/self-media/skills', async (request, reply) => {
    await proxyToAiService(request, reply, '/skills')
  })

  server.get('/self-media/skills/:skillId', async (request, reply) => {
    const { skillId } = request.params as { skillId: string }
    await proxyToAiService(request, reply, `/skills/${encodeURIComponent(skillId)}`)
  })

  server.post('/self-media/skills/:skillId/invoke', async (request, reply) => {
    const { skillId } = request.params as { skillId: string }
    await proxyToAiService(request, reply, `/skills/${encodeURIComponent(skillId)}/invoke`)
  })

  // ===== 公众号文章流水线 =====

  server.post('/self-media/wechat/generate', async (request, reply) => {
    await proxyToAiService(request, reply, '/wechat/generate')
  })

  server.post('/self-media/wechat/validate', async (request, reply) => {
    await proxyToAiService(request, reply, '/wechat/validate')
  })

  server.post('/self-media/wechat/publish', async (request, reply) => {
    await proxyToAiService(request, reply, '/wechat/publish')
  })

  server.get('/self-media/wechat/history', async (request, reply) => {
    const { limit } = request.query as { limit?: string }
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : ''
    await proxyToAiService(request, reply, `/wechat/history${qs}`)
  })

  // ===== 口播稿流水线 =====

  server.post('/self-media/koubo/generate', async (request, reply) => {
    await proxyToAiService(request, reply, '/koubo/generate')
  })

  server.post('/self-media/koubo/validate', async (request, reply) => {
    await proxyToAiService(request, reply, '/koubo/validate')
  })

  server.get('/self-media/koubo/history', async (request, reply) => {
    const { limit } = request.query as { limit?: string }
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : ''
    await proxyToAiService(request, reply, `/koubo/history${qs}`)
  })

  // ===== 本地数据库端点(不走 ai-service) =====

  // POST /self-media/record — 推送成功后写历史记录
  server.post('/self-media/record', async (request, reply) => {
    const body = recordSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId ?? null
    const [row] = await db
      .insert(selfMediaPublished)
      .values({
        category: body.data.category,
        title: body.data.title,
        status: body.data.status,
        draftId: body.data.draftId,
        topicKeyword: body.data.topicKeyword,
        payload: body.data.payload,
        authorId: userId,
      })
      .returning()
    return reply.send(success({ record: row }))
  })

  // GET /self-media/records — 直接读库查历史(备用,不走 ai-service)
  server.get('/self-media/records', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string }
    const cat = category === 'wechat' || category === 'koubo' ? category : undefined
    const lim = Math.min(Number(limit) || 50, HISTORY_LIMIT)

    const conds = []
    if (cat) conds.push(eq(selfMediaPublished.category, cat))
    const rows = await db
      .select()
      .from(selfMediaPublished)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(selfMediaPublished.createdAt))
      .limit(lim)

    return reply.send(success({ items: rows, count: rows.length }))
  })
}
