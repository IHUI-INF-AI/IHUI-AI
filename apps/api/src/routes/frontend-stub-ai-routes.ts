/**
 * 前端 ai 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 *
 * 实现策略(26 路由分类后):
 * - GET 历史记录查询(9):接入 aiGcContent 表 + 分页,按 gcType 过滤。
 * - MCP 服务器管理(POST/DELETE):接入 mcpServers 表 CRUD。
 * - AI 能力调用代理(POST /ai/llm/chat、POST /ai/mcp/tools/call):代理到 ai-service。
 * - vendor 生成类 POST(dashscope/doubao/kling/sora/gemini/veo3/qwen/cosyvoice/suno/hunyuan3d):
 *   ai-service 无对应端点,保留空桩,待 ai-service 端点开发(后续任务)。
 *
 * 注:aiGcContent 表无 vendor 列,dashscope/doubao/jimeng4 等同 gcType 路由返回相同数据集,
 *    vendor 维度过滤需后续给 aiGcContent 增加 vendor 列(见交付报告)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
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

export const frontendStubAiRoutes: FastifyPluginAsync = async (server) => {
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
  // 分类:需 ai-service 集成。ai-service 仅提供全局 /mcp/tools,无按服务器查询端点,保留空桩待开发。
  server.get('/ai/mcp/servers/:id/tools', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
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
  // vendor 生成类 POST — ai-service 无对应端点,保留空桩(后续任务:需 ai-service 端点开发)
  // 真实等价实现已存在于 /api/ai-vendors/*(proxy-llm.ts / proxy-extended.ts),
  // 建议前端切换至 /api/ai-vendors/* 路径,或由 ai-service 增设对应端点后在此代理。
  // ==========================================================================
  const vendorStubPaths = [
    '/ai/keling/audio/end',
    '/ai/sora/request/end',
    '/ai/cosyvoice',
    '/ai/keling/audio/start',
    '/ai/sora/request',
    '/ai/dashscope/image/generate',
    '/ai/hunyuan/3d/submit',
    '/ai/gemini/nano-banana',
    '/ai/google/veo3',
    '/ai/dashscope/video/generate',
    '/ai/qwen/omni',
  ] as const
  for (const path of vendorStubPaths) {
    server.post(path, async (_request, reply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    })
  }
}
