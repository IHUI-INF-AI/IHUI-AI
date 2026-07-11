import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import {
  executeStockAnalysis,
  getTokenBalance,
  getStockHistory,
} from '../services/stock-service.js'

const analysisSchema = z.object({
  symbol: z.string().min(1).max(20),
  question: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
})

const historySchema = z.object({
  symbol: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

const stockRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Token 余额查询
  server.get('/token-balance', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return
    const result = await getTokenBalance(server.tokenBalance, req.userId)
    return reply.send(success(result))
  })

  // Stock 分析（POST）
  server.post('/analyse', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return
    const body = analysisSchema.parse(req.body)
    try {
      const result = await executeStockAnalysis(
        { ...body, userId: req.userId },
        server.tokenBalance,
      )
      return reply.status(201).send(success(result))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const statusCode = /Token 余额不足|Token 扣减失败/.test(msg) ? 402 : 400
      return reply.status(statusCode).send(error(statusCode, msg))
    }
  })

  // 历史记录查询
  server.get('/history', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return
    const query = historySchema.parse(req.query)
    const result = await getStockHistory(
      query.symbol ?? null,
      query.page,
      query.pageSize,
      req.userId,
    )
    return reply.send(success(result))
  })

  // Stock WebSocket 端点（流式分析）
  // 注：WS 流式实现已注册在 plugins/ws-ai.ts 中，端点为 /ws/stock/stream
  //     客户端发送 { symbol, question }，服务端流式推送分析结果
}

export default stockRoutes
