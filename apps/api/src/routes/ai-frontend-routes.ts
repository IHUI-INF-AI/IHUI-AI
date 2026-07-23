/**
 * 前端 ai 模块路由补建。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 *
 * 实现策略(26 路由分类后):
 * - GET 历史记录查询(9):接入 aiGcContent 表 + 分页,按 gcType 过滤。
 * - MCP 服务器管理(POST/DELETE):接入 mcpServers 表 CRUD。
 * - AI 能力调用代理(POST /ai/llm/chat、POST /ai/mcp/tools/call):代理到 ai-service。
 * - vendor 生成类 POST(11 个):转发到已存在的 /api/ai/* 等价端点(server.inject 内部调用)。
 *   字段映射见 vendorStubHandler 各分支。
 *
 * 注:aiGcContent 表无 vendor 列,dashscope/doubao/jimeng4 等同 gcType 路由返回相同数据集,
 *    vendor 维度过滤需后续给 aiGcContent 增加 vendor 列(见交付报告)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, count, desc, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { aiGcContent, mcpServers } from '@ihui/database'

type GcType = 'text' | 'image' | 'audio' | 'video'

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

async function listGcHistory(
  userId: string,
  gcType: GcType,
  q: { page?: string; pageSize?: string },
) {
  const { page, pageSize } = parsePaging(q)
  const offset = (page - 1) * pageSize
  const where = and(eq(aiGcContent.userUuid, userId), eq(aiGcContent.gcType, gcType))
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(aiGcContent)
      .where(where)
      .orderBy(desc(aiGcContent.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(aiGcContent).where(where),
  ])
  return { list: rows, total: totalRows[0]?.value ?? 0, page, pageSize }
}

function gcHistoryHandler(gcType: GcType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await listGcHistory(
        request.userId!,
        gcType,
        request.query as { page?: string; pageSize?: string },
      )
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询生成历史失败'))
    }
  }
}

async function proxyToAiService(
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown,
) {
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.authorization ?? '',
      },
      body: JSON.stringify(body),
    })
    const data = (await resp.json().catch(() => ({}))) as unknown
    if (!resp.ok) {
      const code = resp.status === 401 ? 401 : 502
      return reply.status(code).send(error(code, `ai-service 调用失败: ${resp.status}`))
    }
    return reply.send(success(data))
  } catch (e) {
    request.log.error(e)
    return reply.status(502).send(error(502, `ai-service 调用异常: ${(e as Error).message}`))
  }
}

/**
 * 内部路由转发:通过 server.inject 调用同进程已注册的 /api/ai/* 等价端点。
 * 用于 vendor stub 真实化(11 个 vendor 已有等价实现,仅路径不同)。
 */
async function proxyToSelfApi(
  server: FastifyInstance,
  method: 'GET' | 'POST',
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
  body?: unknown,
) {
  try {
    const injectOpts: {
      method: 'GET' | 'POST'
      url: string
      headers: Record<string, string>
      payload?: string
    } = {
      method,
      url: path,
      headers: { authorization: request.headers.authorization ?? '' },
    }
    if (method === 'POST' && body !== undefined) {
      injectOpts.payload = JSON.stringify(body)
      injectOpts.headers['content-type'] = 'application/json'
    }
    const res = await server.inject(injectOpts)
    const json = res.json()
    return reply.code(res.statusCode).send(json)
  } catch (e) {
    request.log.error(e)
    return reply.status(502).send(error(502, `内部路由调用异常: ${(e as Error).message}`))
  }
}

const mcpServerBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  endpoint: z.string().min(1).max(500),
  status: z.number().int().optional(),
})
const idParam = z.object({ id: z.string().min(1) })
const llmChatBody = z
  .object({
    messages: z.array(z.unknown()),
    model: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()
const mcpToolCallBody = z.object({ name: z.string().min(1) }).passthrough()

export const aiFrontendRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权:所有 ai 模块路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // ==========================================================================
  // GET 历史记录查询(9 路由)— 接入 aiGcContent 表,按 gcType 过滤 + 分页
  // ==========================================================================
  server.get('/ai/dashscope/chat', gcHistoryHandler('text'))
  server.get('/ai/dashscope/image', gcHistoryHandler('image'))
  server.get('/ai/doubao/image', gcHistoryHandler('image'))
  server.get('/ai/jimeng4/image', gcHistoryHandler('image'))
  server.get('/ai/kling/video/generate', gcHistoryHandler('video'))
  server.get('/ai/dashscope/video', gcHistoryHandler('video'))
  server.get('/ai/audio/speech', gcHistoryHandler('audio'))
  server.get('/ai/suno/generate', gcHistoryHandler('audio'))
  server.get('/ai/tencent/hunyuan3d/submit', gcHistoryHandler('video'))

  // ==========================================================================
  // MCP 服务器管理 — 接入 mcpServers 表 CRUD
  // ==========================================================================

  // POST /ai/mcp/servers — 创建 MCP 服务器
  server.post('/ai/mcp/servers', async (request, reply) => {
    const parsed = mcpServerBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const [row] = await db
        .insert(mcpServers)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          endpoint: parsed.data.endpoint,
          status: parsed.data.status ?? 1,
        })
        .returning()
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 服务器失败'))
    }
  })

  // POST /ai/mcp/servers/:id/:id — 路径异常(重复 :id 参数,疑似前端 bug)
  // 分类:可删除。保留空桩避免前端 404,待前端修正路径后移除。
  server.post('/ai/mcp/servers/:id/:id', async (_request, reply) => {
    return reply
      .status(400)
      .send(error(400, '路径参数异常,请使用 /ai/mcp/servers/:id/tools 调用工具'))
  })

  // DELETE /ai/mcp/servers/:id — 删除 MCP 服务器
  server.delete('/ai/mcp/servers/:id', async (request, reply) => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const [row] = await db
        .delete(mcpServers)
        .where(eq(mcpServers.id, parsed.data.id))
        .returning({ id: mcpServers.id })
      if (!row) return reply.status(404).send(error(404, 'MCP 服务器不存在'))
      return reply.send(success({ id: row.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除 MCP 服务器失败'))
    }
  })

  // GET /ai/mcp/servers/:id/tools — 列出指定 MCP 服务器的工具
  // 代理到 ai-service /api/mcp/tools,客户端按 serverId 过滤(ai-service 暂无按服务器查询端点)
  server.get('/ai/mcp/servers/:id/tools', async (request, reply) => {
    const { id } = (request.params as { id: string }) ?? { id: '' }
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/tools`, {
        headers: { Authorization: request.headers.authorization ?? '' },
      })
      if (!resp.ok) {
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status}`))
      }
      const data = (await resp.json().catch(() => ({ tools: [] }))) as {
        tools: Array<Record<string, unknown>>
        count: number
      }
      const tools = (data.tools ?? []).filter(
        (t) => !t.serverId || t.serverId === id || t.server === id,
      )
      return reply.send(success({ list: tools, total: tools.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `ai-service 调用异常: ${(e as Error).message}`))
    }
  })

  // POST /ai/mcp/tools/call — 调用 MCP 工具(代理到 ai-service)
  server.post('/ai/mcp/tools/call', async (request, reply) => {
    const parsed = mcpToolCallBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? 'name 为必填'))
    }
    return proxyToAiService('/api/mcp/tools/call', request, reply, parsed.data)
  })

  // ==========================================================================
  // AI 能力调用代理(代理到 ai-service)
  // ==========================================================================

  // POST /ai/llm/chat — LLM 对话(代理到 ai-service /api/llm/complete)
  server.post('/ai/llm/chat', async (request, reply) => {
    const parsed = llmChatBody.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'messages 为必填'))
    }
    const body = {
      messages: parsed.data.messages,
      ...(parsed.data.model !== undefined ? { model: parsed.data.model } : {}),
      metadata: { userId: request.userId, ...(parsed.data.metadata ?? {}) },
    }
    return proxyToAiService('/api/llm/complete', request, reply, body)
  })

  // ==========================================================================
  // vendor 生成类 POST — 转发到已存在的 /api/ai/* 等价端点(server.inject 内部调用)
  // 字段映射依据:apps/web/src/hooks/use-ai-talk.ts + use-ai-helpers.ts 的 body 构造
  // ==========================================================================

  // POST /ai/cosyvoice → /api/ai/audio/speech (CosyVoice TTS)
  // 前端 body:{copyWriting, chatId, audioId, audioPath} → 等价端点需 {text, model:'cosyvoice-v2'}
  server.post('/ai/cosyvoice', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = {
      text: (b.copyWriting as string) ?? (b.prompt as string) ?? '',
      model: 'cosyvoice-v2',
    }
    return proxyToSelfApi(server, 'POST', '/api/ai/audio/speech', request, reply, mapped)
  })

  // POST /ai/keling/audio/start → /api/ai/kling/task/create (Kling 对口型任务创建)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/keling/audio/start', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/kling/task/create', request, reply, request.body)
  })

  // POST /ai/keling/audio/end → GET /api/ai/kling/task/query/:taskId (Kling 任务查询)
  // 前端 body:{task_id} → 提取 task_id 拼 URL,GET 请求
  server.post('/ai/keling/audio/end', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const taskId = (b.task_id as string) ?? (b.taskId as string) ?? ''
    if (!taskId) return reply.status(400).send(error(400, '缺少 task_id'))
    return proxyToSelfApi(server, 'GET', `/api/ai/kling/task/query/${taskId}`, request, reply)
  })

  // POST /ai/sora/request → /api/ai/sora2/generate (Sora2 视频生成)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/sora/request', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/sora2/generate', request, reply, request.body)
  })

  // POST /ai/sora/request/end → GET /api/ai/sora2/tasks/:taskId (Sora2 任务查询)
  // 前端 body:{task_id} → 提取 task_id 拼 URL,GET 请求
  server.post('/ai/sora/request/end', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const taskId = (b.task_id as string) ?? (b.taskId as string) ?? ''
    if (!taskId) return reply.status(400).send(error(400, '缺少 task_id'))
    return proxyToSelfApi(server, 'GET', `/api/ai/sora2/tasks/${taskId}`, request, reply)
  })

  // POST /ai/dashscope/image/generate → /api/ai/dashscope/image (通义万相图像)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/dashscope/image/generate', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/image', request, reply, request.body)
  })

  // POST /ai/hunyuan/3d/submit → /api/ai/tencent/hunyuan3d/submit (腾讯混元3D)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/hunyuan/3d/submit', async (request, reply) => {
    return proxyToSelfApi(
      server,
      'POST',
      '/api/ai/tencent/hunyuan3d/submit',
      request,
      reply,
      request.body,
    )
  })

  // POST /ai/gemini/nano-banana → /api/ai/gemini/image (Gemini 2.5 Flash Image)
  // 前端 body:buildIhuiLlmBody → 注入 model:'gemini-2.5-flash-image'
  server.post('/ai/gemini/nano-banana', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'gemini-2.5-flash-image' }
    return proxyToSelfApi(server, 'POST', '/api/ai/gemini/image', request, reply, mapped)
  })

  // POST /ai/google/veo3 → /api/ai/gemini/video (Veo3 视频)
  // 前端 body:buildIhuiLlmBody → 注入 model:'veo-3.0-generate-preview'
  server.post('/ai/google/veo3', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'veo-3.0-generate-preview' }
    return proxyToSelfApi(server, 'POST', '/api/ai/gemini/video', request, reply, mapped)
  })

  // POST /ai/dashscope/video/generate → /api/ai/dashscope/video (通义万相视频)
  // 前端 body:buildIhuiLlmBody 透传
  server.post('/ai/dashscope/video/generate', async (request, reply) => {
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/video', request, reply, request.body)
  })

  // POST /ai/qwen/omni → /api/ai/dashscope/multimodal (Qwen-Omni 多模态)
  // 前端 body:buildIhuiLlmBody → 注入 model:'qwen-omni-turbo'
  server.post('/ai/qwen/omni', async (request, reply) => {
    const b = (request.body ?? {}) as Record<string, unknown>
    const mapped = { ...b, model: 'qwen-omni-turbo' }
    return proxyToSelfApi(server, 'POST', '/api/ai/dashscope/multimodal', request, reply, mapped)
  })
}
