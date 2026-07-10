import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { success, error } from '../utils/response.js';
import { executeStockAnalysis, getTokenBalance, getStockHistory } from '../services/stock-service.js';

const analysisSchema = z.object({
  symbol: z.string().min(1).max(20),
  question: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
});

const historySchema = z.object({
  symbol: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const stockRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Token 余额查询
  server.get('/token-balance', async (_req, reply) => {
    return reply.send(success(getTokenBalance()));
  });

  // Stock 分析（POST）
  server.post('/analyse', async (req, reply) => {
    const body = analysisSchema.parse(req.body);
    try {
      const result = await executeStockAnalysis(body);
      return reply.status(201).send(success(result));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send(error(400, msg));
    }
  });

  // 历史记录查询
  server.get('/history', async (req, reply) => {
    const query = historySchema.parse(req.query);
    const result = await getStockHistory(query.symbol ?? null, query.page, query.pageSize);
    return reply.send(success(result));
  });

  // Stock WebSocket 端点（流式分析）
  // 注：实际 WS 流式实现需要在 ws-ai.ts 或独立插件中注册
  // 这里仅注册 REST 端点
};

export default stockRoutes;
