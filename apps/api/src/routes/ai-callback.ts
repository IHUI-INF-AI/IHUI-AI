import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { success, error } from '../utils/response.js';
import { config } from '../config/index.js';

/**
 * AI 回调端点。
 *
 * 由 AI service 在 LLM 推理完成后 POST 调用(见 apps/ai-service/app/routers/llm.py)。
 * 接收完整推理结果 + metadata,入队 aiCallback 队列由 Worker 异步处理:
 * - 持久化 assistant 消息(关联 conversationId/messageId)
 * - 记录 token 用量
 * - WebSocket 实时推送(多端同步)
 *
 * 端点设计:
 * - POST /api/ai/callback — 接收回调,入队,立即返回 202 Accepted
 * - 内部服务间调用,无需 JWT 鉴权(由网络隔离 + 后续可加 shared secret)
 */
const callbackSchema = z.object({
  content: z.string(),
  model: z.string().nullable().optional(),
  usage: z.unknown().optional(),
  stub: z.boolean().optional(),
  metadata: z.object({
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    userId: z.string().optional(),
  }).passthrough().optional(),
});

const aiCallbackPlugin: FastifyPluginAsync = async (server) => {
  server.post('/api/ai/callback', async (request, reply) => {
    // 共享密钥校验(可选):配置 AI_CALLBACK_SECRET 后,ai-service 必须带 X-Internal-Secret 头
    if (config.AI_CALLBACK_SECRET) {
      const provided = request.headers['x-internal-secret'];
      if (provided !== config.AI_CALLBACK_SECRET) {
        request.log.warn({ hasHeader: !!provided }, 'ai callback secret mismatch');
        return reply.status(401).send(error(401, 'unauthorized'));
      }
    }

    const parsed = callbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const { content, model, usage, stub, metadata } = parsed.data;
    const conversationId = metadata?.conversationId;
    const messageId = metadata?.messageId;
    const userId = metadata?.userId;

    if (!conversationId || !userId) {
      // 缺少关联键,无法处理,但仍返回 202 避免阻塞 AI service
      request.log.warn({ metadata }, 'ai callback missing conversationId/userId');
      return reply.status(202).send(success({ accepted: true, warning: 'missing association keys' }));
    }

    // 入队 aiCallback,Worker 异步处理持久化 + 推送
    try {
      const aiCallbackQueue = (server as unknown as {
        aiCallbackQueue?: { add: (name: string, data: unknown) => Promise<{ id?: string }> };
      }).aiCallbackQueue;

      if (aiCallbackQueue) {
        await aiCallbackQueue.add('complete', {
          conversationId,
          userId,
          messageId: messageId ?? '',
          content,
          tokens: (usage as { total_tokens?: number })?.total_tokens,
          metadata: { model, usage, stub },
        });
        return reply.status(202).send(success({ accepted: true, queued: true }));
      }

      // 队列不可用时降级:直接返回,AI service 会重试或放弃(由其策略决定)
      request.log.warn('aiCallbackQueue not available, callback dropped');
      return reply.status(202).send(success({ accepted: true, queued: false, warning: 'queue unavailable' }));
    } catch (e) {
      request.log.error({ err: e }, 'ai callback enqueue failed');
      return reply.status(502).send(error(502, 'callback enqueue failed'));
    }
  });
};

export default aiCallbackPlugin;
