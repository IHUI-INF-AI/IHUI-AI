/**
 * 多平台发布路由代理 — 把 /api/publish/* 透传到 ai-service 的 /api/publish/*。
 *
 * 端点清单(完整代理,16 个):
 *   GET    /publish/platforms                    列出所有支持的平台元数据
 *   POST   /publish/upload                       multipart 上传内容文件(docx/pdf/image/video/md/html)
 *   GET    /publish/accounts/:userId             列出用户的所有平台账号
 *   POST   /publish/accounts                     创建账号(凭证加密后存 DB)
 *   PUT    /publish/accounts/:accountId          更新账号
 *   DELETE /publish/accounts/:accountId          删除账号
 *   POST   /publish/accounts/:accountId/verify   测试连接
 *   POST   /publish/tasks                        创建发布任务
 *   GET    /publish/tasks                        列出任务
 *   GET    /publish/tasks/:taskId                任务详情
 *   POST   /publish/tasks/:taskId/cancel         取消任务
 *   POST   /publish/tasks/:taskId/retry          重试失败平台
 *   GET    /publish/history                      历史记录
 *   GET    /publish/stats                        统计
 *   GET    /publish/credentials-key/generate     生成加密密钥
 *   GET    /publish/running                      当前运行中任务
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - GET/POST/PUT/DELETE 透传到 ai-service,Body 不解析(直接转发)
 * - 转发 JWT(auth header)、query string、body
 * - /upload 走 multipart:本地解析为 buffer,再用 FormData 转发到 ai-service
 * - 错误处理:ai-service 返回非 2xx 时,把错误信息透传给前端
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'

async function proxyToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> {
  const url = `${config.AI_SERVICE_URL}/api/publish${path}`
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
    request.log.error({ err: e, url }, 'publish proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

/**
 * multipart 上传代理:从 fastify 解析 file,转 FormData 转发到 ai-service。
 * 返回结构统一 { code, message, data }。
 */
async function proxyMultipartToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string | undefined,
): Promise<void> {
  if (!request.isMultipart()) {
    reply.status(400).send(error(400, '请求必须是 multipart/form-data'))
    return
  }
  const data = await request.file()
  if (!data) {
    reply.status(400).send(error(400, '未找到上传文件'))
    return
  }
  const buffer = await data.toBuffer()
  if (buffer.length === 0) {
    reply.status(400).send(error(400, '文件内容为空'))
    return
  }

  // 构造转发 URL(带 user_id 查询参数)
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
  const url = `${config.AI_SERVICE_URL}/api/publish/upload${qs}`

  // 用 FormData 转发(保留原始 filename + content-type)
  const formData = new FormData()
  const blob = new Blob([buffer], { type: data.mimetype || 'application/octet-stream' })
  formData.append('file', blob, data.filename || `upload-${Date.now()}`)

  const headers: Record<string, string> = {}
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body: formData })
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
    // 统一封装为 { code, message, data } 格式(ai-service 返回裸 dict)
    if (upstream.ok && payload && typeof payload === 'object' && !('code' in (payload as Record<string, unknown>))) {
      reply.status(upstream.status).send(success(payload))
    } else {
      reply.status(upstream.status).send(payload)
    }
  } catch (e) {
    request.log.error({ err: e, url }, 'publish upload proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

export const publishRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // /upload 走 multipart,authenticate 内部会处理 JWT
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // ===== 平台元数据 =====

  server.get('/publish/platforms', async (request, reply) => {
    await proxyToAiService(request, reply, '/platforms')
  })

  // ===== 文件上传(multipart) =====

  server.post('/publish/upload', async (request, reply) => {
    // 从 JWT 或 query 取 userId,默认用 request.userId
    const query = request.query as { user_id?: string }
    const userId = query.user_id || (request as FastifyRequest & { userId?: string }).userId
    await proxyMultipartToAiService(request, reply, userId)
  })

  // ===== 账号管理 =====

  server.get('/publish/accounts/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(userId)}`)
  })

  server.post('/publish/accounts', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts')
  })

  server.put('/publish/accounts/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}`)
  })

  server.delete('/publish/accounts/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}`)
  })

  server.post('/publish/accounts/:accountId/verify', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}/verify`)
  })

  // ===== 任务管理 =====

  server.post('/publish/tasks', async (request, reply) => {
    await proxyToAiService(request, reply, '/tasks')
  })

  server.get('/publish/tasks', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/tasks?${qs}` : '/tasks')
  })

  server.get('/publish/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}`)
  })

  server.post('/publish/tasks/:taskId/cancel', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}/cancel`)
  })

  server.post('/publish/tasks/:taskId/retry', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}/retry`)
  })

  // ===== 历史 / 统计 / 密钥 / 运行中 =====

  server.get('/publish/history', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/history?${qs}` : '/history')
  })

  server.get('/publish/stats', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/stats?${qs}` : '/stats')
  })

  server.get('/publish/credentials-key/generate', async (request, reply) => {
    await proxyToAiService(request, reply, '/credentials-key/generate')
  })

  server.get('/publish/running', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/running?${qs}` : '/running')
  })
}
