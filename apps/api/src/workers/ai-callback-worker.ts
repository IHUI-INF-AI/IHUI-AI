import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type AICallbackJobData, type Job } from '../plugins/queue.js'
import { createMessage, updateMessage } from '../db/chat-queries.js'

/**
 * AI Callback Worker — AI 回调队列消费者。
 *
 * 由 AI service 推理完成后回调 /api/ai/callback 入队。
 * 职责:
 * 1. 持久化 assistant 消息(或更新占位消息)
 * 2. 记录 token 用量
 * 3. WebSocket 多端推送
 *
 * 容错策略:
 * - 更新占位消息失败(消息不存在)时降级创建新消息
 * - 其他 DB 错误 rethrow 触发 BullMQ 重试
 */
export function startAiCallbackWorker(server: FastifyInstance): Worker {
  return createWorker<AICallbackJobData>(
    server,
    QUEUE_NAMES.aiCallback,
    async (job: Job<AICallbackJobData>) => {
      const {
        conversationId,
        userId,
        messageId,
        content,
        tokens,
        model,
        provider,
        promptTokens,
        completionTokens,
        idempotencyKey,
        metadata,
      } = job.data

      let savedMessage
      if (messageId) {
        // 更新已有的占位 assistant 消息(前端预先创建的场景)
        // 只 catch "消息不存在"的预期错误,DB 错误应 rethrow 触发 BullMQ 重试
        try {
          savedMessage = await updateMessage(messageId, userId, {
            content,
            tokens: tokens,
            metadata,
          })
        } catch (e) {
          // 更新失败(消息不存在或权限不符)时降级创建,其他错误 rethrow 触发重试
          const errMsg = e instanceof Error ? e.message : String(e)
          if (
            errMsg.includes('不存在') ||
            errMsg.includes('not found') ||
            errMsg.includes('undefined')
          ) {
            server.log.warn(
              { jobId: job.id, messageId },
              'updateMessage failed (not found), falling back to createMessage',
            )
          } else {
            throw e
          }
        }
      }

      if (!savedMessage) {
        // 直接创建新的 assistant 消息
        savedMessage = await createMessage({
          conversationId,
          role: 'assistant',
          content,
          tokens: tokens,
          metadata,
        })
      }

      // G3: LLM 扣费链路接通 - 集中扣费 + 记成本联动
      // 设计:消息持久化成功后才扣费;扣费失败不 rethrow(避免 BullMQ 重试导致重复扣费,idempotencyKey 兜底)
      if (tokens && tokens > 0 && userId) {
        try {
          // 1. 记成本到 ai_cost_records(纯审计,不扣余额,失败不阻塞扣费)
          if (model) {
            try {
              await server.aiCost.record({
                userId,
                model,
                provider: provider ?? 'unknown',
                promptTokens: promptTokens ?? 0,
                completionTokens: completionTokens ?? 0,
                totalTokens: tokens,
                requestType: 'chat',
              })
            } catch (err) {
              server.log.warn({ err, userId, model }, 'recordAiCost failed (non-blocking)')
            }
          }
          // 2. 扣用户 token 余额(联动,带幂等键防重试重复扣)
          const result = await server.tokenBalance.deductTokens(
            userId,
            tokens,
            `llm_chat:${model ?? 'unknown'}`,
            idempotencyKey,
          )
          if (!result.success) {
            server.log.warn(
              { userId, tokens, model, remaining: result.remaining },
              'token balance insufficient, message persisted but not charged',
            )
          }
        } catch (e) {
          server.log.error({ err: e, userId, tokens, model }, 'deductTokens/recordAiCost failed')
          // 不 rethrow:避免 BullMQ 重试导致重复扣费(idempotencyKey 兜底)
        }
      }

      // WebSocket 多端同步推送
      // clientMessageId: 前端占位消息 ID(非 DB ID),前端用它匹配本地占位消息并替换
      try {
        server.pushNotification(userId, {
          type: 'ai_response',
          conversationId,
          clientMessageId: messageId || undefined, // 前端 store UUID
          message: savedMessage, // DB 消息(含真实 DB id)
        })
      } catch {
        /* 推送失败不阻塞 */
      }

      server.log.info(
        { jobId: job.id, conversationId, userId, messageId: savedMessage.id, tokens },
        'ai callback job processed',
      )
      return { messageId: savedMessage.id }
    },
  )
}
