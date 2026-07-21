/**
 * Coze 生态全量接口(R74 审计 P2 补建)。
 *
 * 补齐 coze.ts 未覆盖的 REST 风格端点(apps 详情/对话、datasets 文档 CRUD、
 * audio 转写、files 列表/删除)。与 coze.ts 共存于 /api/coze 前缀下,
 * 已存在的端点(POST /datasets、POST /audio/speech、POST /files/upload)
 * 不在此重复注册,避免 Fastify 路由冲突。
 *
 * 环境变量(优先 COZE_API_TOKEN,兼容 COZE_API_KEY):
 * - COZE_API_TOKEN / COZE_API_KEY   Coze PAT/Bearer Token
 * - COZE_API_BASE  / COZE_BASE_URL  Coze Open API 根地址(默认 https://api.coze.cn)
 *
 * 注册(server.ts):
 *   server.register(cozeEcosystemRoutes, { prefix: '/api/coze' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Coze 配置 & 通用请求工具
// =============================================================================

function cozeBaseUrl(): string {
  return process.env.COZE_API_BASE ?? process.env.COZE_BASE_URL ?? 'https://api.coze.cn'
}

function cozeApiKey(): string {
  return process.env.COZE_API_TOKEN ?? process.env.COZE_API_KEY ?? ''
}

function requireCozeConfig(reply: FastifyReply): boolean {
  if (!cozeApiKey()) {
    reply.status(503).send(error(503, 'Coze API 未配置(COZE_API_TOKEN 缺失)'))
    return false
  }
  return true
}

function cozeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${cozeApiKey()}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 通用 Coze JSON API 代理。失败时写入 reply 并返回 null。不缓存响应(数据时效性)。 */
async function cozeRequest(
  method: string,
  path: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<unknown | null> {
  if (!requireCozeConfig(reply)) return null
  try {
    const resp = await fetchWithTimeout(
      cozeBaseUrl() + path,
      {
        ...options,
        method,
        headers: cozeHeaders(options.headers as Record<string, string> | undefined),
      },
      timeoutMs,
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(resp.status)
        .send(
          error(resp.status, `Coze 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
        )
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `Coze 调用异常: ${msg}`))
    return null
  }
}

/** Coze multipart 上传代理。 */
async function cozeUpload(
  path: string,
  reply: FastifyReply,
  fields: Record<string, string>,
  file: { buffer: Buffer; filename: string },
): Promise<unknown | null> {
  if (!requireCozeConfig(reply)) return null
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  form.append('file', new Blob([new Uint8Array(file.buffer)]), file.filename || 'upload')
  try {
    const resp = await fetchWithTimeout(cozeBaseUrl() + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cozeApiKey()}` },
      body: form,
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply.status(resp.status).send(error(resp.status, `Coze 上传失败: ${resp.status}`))
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `Coze 上传异常: ${msg}`))
    return null
  }
}

async function readMultipart(
  request: FastifyRequest,
): Promise<{ fields: Record<string, string>; file: { buffer: Buffer; filename: string } | null }> {
  const fields: Record<string, string> = {}
  let file: { buffer: Buffer; filename: string } | null = null
  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(part.value)
    } else if (part.type === 'file') {
      const buffer = await part.toBuffer()
      file = { buffer, filename: part.filename }
    }
  }
  return { fields, file }
}

// =============================================================================
// 共享 Zod schemas
// =============================================================================

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

const appIdParam = z.object({ appId: z.string().min(1) })
const datasetIdParam = z.object({ id: z.string().min(1) })
const docIdParam = z.object({ id: z.string().min(1), docId: z.string().min(1) })
const fileIdParam = z.object({ fileId: z.string().min(1) })

// =============================================================================
// Coze 生态路由(挂载于 /api/coze,与 coze.ts 共存)
// =============================================================================

export const cozeEcosystemRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // ===========================================================================
  // apps — Coze 应用管理(REST 风格,补齐 coze.ts 未覆盖的端点)
  // ===========================================================================
  // GET  /apps          应用列表(REST 风格,coze.ts 已有 /apps/list 但无 /apps)
  // GET  /apps/:appId   应用详情
  // POST /apps/:appId/chat  发起应用对话
  server.get('/apps', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, size } = parsed.data
    const data = await cozeRequest(
      'GET',
      `/v1/apps/list?page_index=${page}&page_size=${size}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.get('/apps/:appId', async (request, reply) => {
    const parsed = appIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const data = await cozeRequest(
      'GET',
      `/v1/bot/get_online_info?bot_id=${encodeURIComponent(parsed.data.appId)}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.post('/apps/:appId/chat', async (request, reply) => {
    const parsed = appIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const b = z
      .object({
        user_id: z.string().min(1),
        conversation_id: z.string().optional(),
        additional_messages: z.array(z.record(z.string(), z.unknown())).optional(),
        stream: z.boolean().optional(),
        auto_save_history: z.boolean().optional(),
      })
      .passthrough()
      .safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const payload: Record<string, unknown> = {
      bot_id: parsed.data.appId,
      user_id: b.data.user_id,
      additional_messages: b.data.additional_messages ?? [],
    }
    if (b.data.conversation_id) payload.conversation_id = b.data.conversation_id
    if (b.data.stream) payload.stream = true
    if (b.data.auto_save_history !== undefined) payload.auto_save_history = b.data.auto_save_history
    const data = await cozeRequest('POST', '/v3/chat', reply, { body: JSON.stringify(payload) })
    if (data === null) return
    reply.send(success(data))
  })

  // ===========================================================================
  // datasets — 知识库文档管理(REST 风格,补齐 coze.ts 未覆盖的端点)
  // ===========================================================================
  // GET    /datasets                  知识库列表(REST 风格,coze.ts 已有 POST /datasets/list)
  // POST   /datasets/:id/documents    上传文档(REST 风格,coze.ts 已有 POST /datasets/documents/upload)
  // GET    /datasets/:id/documents    文档列表(REST 风格,coze.ts 已有 POST /datasets/documents/list)
  // DELETE /datasets/:id/documents/:docId  删除文档
  server.get('/datasets', async (request, reply) => {
    const q = z
      .object({
        space_id: z.string().min(1),
        page: z.coerce.number().int().min(1).default(1),
        size: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const data = await cozeRequest(
      'GET',
      `/v1/datasets/list?space_id=${encodeURIComponent(q.data.space_id)}&page_index=${q.data.page}&page_size=${q.data.size}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.post('/datasets/:id/documents', async (request, reply) => {
    const parsed = datasetIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { fields, file } = await readMultipart(request)
    if (!file) return reply.status(400).send(error(400, '未检测到上传文件'))
    const data = await cozeUpload(
      '/v1/datasets/documents/upload',
      reply,
      {
        dataset_id: parsed.data.id,
        document_name: file.filename || 'doc',
        document_source: '0',
        ...fields,
      },
      file,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.get('/datasets/:id/documents', async (request, reply) => {
    const parsed = datasetIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const q = pageQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, size } = q.data
    const data = await cozeRequest(
      'GET',
      `/v1/datasets/documents/list?dataset_id=${encodeURIComponent(parsed.data.id)}&page_index=${page}&page_size=${size}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.delete('/datasets/:id/documents/:docId', async (request, reply) => {
    const parsed = docIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const data = await cozeRequest('POST', '/v1/datasets/documents/delete', reply, {
      body: JSON.stringify({ dataset_id: parsed.data.id, document_ids: [parsed.data.docId] }),
    })
    if (data === null) return
    reply.send(success(data))
  })

  // ===========================================================================
  // audio — 音频转写(coze.ts 已有 /audio/speech,此处补齐 transcriptions)
  // ===========================================================================
  // POST /audio/transcriptions  音频转文字
  server.post('/audio/transcriptions', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send(error(400, '未检测到上传音频文件'))
    const buffer = await data.toBuffer()
    const result = await cozeUpload(
      '/v1/audio/transcriptions',
      reply,
      {},
      { buffer, filename: data.filename || 'audio' },
    )
    if (result === null) return
    reply.send(success(result))
  })

  // ===========================================================================
  // files — 文件管理(coze.ts 已有 POST /files/upload,此处补齐列表/删除)
  // ===========================================================================
  // GET    /files          文件列表
  // DELETE /files/:fileId  删除文件
  server.get('/files', async (request, reply) => {
    const parsed = pageQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, size } = parsed.data
    const data = await cozeRequest(
      'GET',
      `/v1/files/list?page_index=${page}&page_size=${size}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })

  server.delete('/files/:fileId', async (request, reply) => {
    const parsed = fileIdParam.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const data = await cozeRequest(
      'DELETE',
      `/v1/files/delete?file_id=${encodeURIComponent(parsed.data.fileId)}`,
      reply,
    )
    if (data === null) return
    reply.send(success(data))
  })
}
