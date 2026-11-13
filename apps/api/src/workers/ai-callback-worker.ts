// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { and, eq } from 'drizzle-orm'
import { chatElementPacks } from '@ihui/database'
import { createWorker, QUEUE_NAMES, type AICallbackJobData, type Job } from '../plugins/queue.js'
import { db } from '../db/index.js'
import { createMessage, findMessageById, updateMessage } from '../db/chat-queries.js'
import { consumeElementPackFrames } from '../db/element-pack-queries.js'
import { resolveAiCost } from '../plugins/ai-cost.js'
import { settleWalletUsage } from '../plugins/token-balance-service.js'
// D64⑤:元素包 metadata 形状的唯一构造出口(空数组返回 null ⇒ 不写 key)。
// parseElementPackFrames 是读侧守卫:暂存表 jsonb 读回的帧是宽类型,
// 落 metadata 前必须收窄成 ElementPackFrame(形态不合的帧被丢弃)。
import { buildElementPackMetadata, parseElementPackFrames } from '@ihui/shared/chat'

/**
 * F-498:读取暂存帧但**不删除** —— 落库成功后由 consumeElementPackFrames 确认。
 * 旧实现删除即取走,落库失败/进程崩溃该帧永久丢失且重试也取不回。
 */
async function readElementPackFrames(
  conversationId: string,
  clientMessageId: string,
): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select({ frames: chatElementPacks.frames })
    .from(chatElementPacks)
    .where(
      and(
        eq(chatElementPacks.conversationId, conversationId),
        eq(chatElementPacks.clientMessageId, clientMessageId),
      ),
    )
  const frames = rows[0]?.frames
  return Array.isArray(frames) ? (frames as Record<string, unknown>[]) : []
}

/** 帧幂等键:kind + id + timestamp。同一帧重复处理(确认失败重试)不重复归并。 */
function elementPackFrameKey(frame: unknown): string {
  const o = (typeof frame === 'object' && frame !== null ? frame : {}) as Record<string, unknown>
  const part = (v: unknown): string => (typeof v === 'string' ? v : '')
  return `${part(o.kind)}\u0000${part(o.id)}\u0000${part(o.timestamp)}`
}

/** 按幂等键去重,保留首次出现顺序。 */
function dedupeElementPackFrames(frames: readonly unknown[]): unknown[] {
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const frame of frames) {
    const key = elementPackFrameKey(frame)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(frame)
  }
  return out
}

/** warn 用帧标识(kind:id),便于按帧定位失败重试。 */
function describeElementPackFrames(frames: readonly unknown[]): string[] {
  return frames.map((frame) => {
    const o = (typeof frame === 'object' && frame !== null ? frame : {}) as Record<string, unknown>
    const part = (v: unknown): string => (typeof v === 'string' ? v : '?')
    return `${part(o.kind)}:${part(o.id)}`
  })
}

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
        reasoning,
        tokens,
        model,
        provider,
        promptTokens,
        completionTokens,
        idempotencyKey,
        metadata,
        // 票59(3/3):regenerate 新回复的版本族坐标(回调端点从 metadata 提出后进顶层)
        parentMessageId,
        siblingIndex,
      } = job.data

      // D64⑤(2026-10-14 立)/ F-498(2026-11-13 修):元素包帧改为「先读 → 落库 → 确认删除」
      // 两段式。旧实现 DELETE ... RETURNING 取走即删,落库失败/进程崩溃该帧永久丢失且
      // 重试也取不回;现在读取不删,落库成功后 consumeElementPackFrames 才确认删除。
      // 读取失败只 warn,绝不阻塞消息落库(与 permission-stamp 同纪律)。
      let elementPackFrames: Record<string, unknown>[] = []
      if (messageId) {
        try {
          elementPackFrames = await readElementPackFrames(conversationId, messageId)
        } catch (e) {
          server.log.warn(
            { err: e instanceof Error ? e.message : String(e), conversationId, messageId },
            '[ElementPack] 暂存帧读取失败(不影响消息落库)',
          )
        }
      }
      const frameIds = describeElementPackFrames(elementPackFrames)

      // D24(2026-09-19 立):metadata 改为浅合并语义。updateMessage 是整体 set
      // metadata(jsonb 列覆盖写),占位消息可能已带 pendingQuestion/questionId 等
      // 既有 key(提问链路写入),直接覆盖会丢失;此处读旧值合并,job 内新值优先。
      // 同一消息的 job 串行消费(BullMQ 同 key 有序),无并发覆盖风险。
      // F-498:旧值里可能已有上一轮落库的帧(确认删除失败后的重试),按幂等键去重合并,
      // 重复处理同一帧不产生重复帧。
      let prevMeta: Record<string, unknown> | undefined
      if (messageId) {
        try {
          const prev = await findMessageById(messageId)
          if (prev?.metadata && typeof prev.metadata === 'object') {
            prevMeta = prev.metadata as Record<string, unknown>
          }
        } catch {
          // 读旧值失败不阻塞落库,降级为整体覆盖(与原行为一致)
        }
      }
      const elementPackMeta = buildElementPackMetadata(
        parseElementPackFrames({
          elementPack: {
            frames: dedupeElementPackFrames([
              ...parseElementPackFrames(prevMeta ?? {}),
              ...elementPackFrames,
            ]),
          },
        }),
      )

      let savedMessage
      if (messageId) {
        // 更新已有的占位 assistant 消息(前端预先创建的场景)
        // 只 catch "消息不存在"的预期错误,DB 错误应 rethrow 触发 BullMQ 重试
        const mergedMetadata: Record<string, unknown> = {
          ...(prevMeta ?? {}),
          ...metadata,
          // D64⑤:元素包归并进消息 metadata(D24 toolCalls 同一落库面);
          // 空帧数组 ⇒ packMeta 为 null ⇒ 不写 key(不覆盖既有/不落冗余)。
          ...(elementPackMeta ? { elementPack: elementPackMeta } : {}),
        }
        try {
          savedMessage = await updateMessage(messageId, userId, {
            content,
            reasoning,
            tokens: tokens,
            metadata: mergedMetadata,
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
            // F-498:落库失败 ⇒ 帧未确认删除,保留在暂存表,BullMQ 重试可再次取到
            server.log.warn(
              {
                err: errMsg,
                jobId: job.id,
                conversationId,
                messageId,
                frameIds,
              },
              '[ElementPack] 消息落库失败,暂存帧保留待重试',
            )
            throw e
          }
        }
      }

      if (!savedMessage) {
        // 直接创建新的 assistant 消息
        try {
          savedMessage = await createMessage({
            conversationId,
            role: 'assistant',
            content,
            reasoning,
            tokens: tokens,
            // 票59(3/3):regenerate 的新回复以 sibling 身份入族(坐标缺省 = 普通消息,
            // Drizzle 落列默认 null,与存量行为逐字一致)。update 路径不接坐标:
            // regenerate 流的占位 messageId 是前端 UUID,DB 里不存在,必走本分支。
            parentMessageId,
            siblingIndex,
            metadata: {
              ...(metadata ?? {}),
              // D64⑤:同 update 路径 —— 元素包随创建一次性落库,不做二次 UPDATE
              ...(elementPackMeta ? { elementPack: elementPackMeta } : {}),
            },
          })
        } catch (e) {
          // F-498:落库失败 ⇒ 帧保留待重试
          server.log.warn(
            {
              err: e instanceof Error ? e.message : String(e),
              jobId: job.id,
              conversationId,
              messageId,
              frameIds,
            },
            '[ElementPack] 消息落库失败,暂存帧保留待重试',
          )
          throw e
        }
      }

      // F-498:落库成功后才确认删除暂存帧;确认失败则抛出,帧仍在,重试按幂等键不重复归并。
      if (messageId && elementPackFrames.length > 0) {
        try {
          await consumeElementPackFrames(conversationId, messageId)
        } catch (e) {
          server.log.warn(
            {
              err: e instanceof Error ? e.message : String(e),
              jobId: job.id,
              conversationId,
              messageId,
              frameIds,
            },
            '[ElementPack] 落库后确认删除失败,暂存帧保留待重试',
          )
          throw e
        }
      }

      // G3 + F-203(口径 B): 扣费必须按真实成本折算成分,不能拿 token 数当分。
      // 设计:消息持久化成功后才结算;结算失败不 rethrow(BullMQ 重试会重复扣费,idempotencyKey 兜底)。
      if (tokens && tokens > 0 && userId) {
        if (!model) {
          server.log.warn(
            { userId, tokens },
            'ai callback job 缺 model,无法按成本计价,跳过扣费与成本记录',
          )
        } else {
          try {
            // 1. 单次定价解析:同一结果既用于钱包结算,也用于 ai_cost_records,禁止两处各算一遍
            const actual = await resolveAiCost({
              model,
              promptTokens: promptTokens ?? 0,
              completionTokens: completionTokens ?? 0,
            })
            const costCents = Math.ceil(actual.cost)

            // 2. 结算钱包:上游已发生成本,能扣多少扣多少,差额落 metadata 形成欠额审计
            let settlement: { deducted: number; remaining: number; shortfall: number } | null = null
            if (costCents > 0) {
              settlement = await settleWalletUsage({
                userId,
                amount: costCents,
                reason: `llm_chat:${model}`,
                idempotencyKey,
              })
              if (settlement.shortfall > 0) {
                server.log.warn(
                  {
                    userId,
                    costCents,
                    deducted: settlement.deducted,
                    shortfall: settlement.shortfall,
                    model,
                  },
                  'token balance insufficient, message persisted but partially charged',
                )
              }
            }

            const billing = {
              walletDeductedCents: settlement?.deducted ?? 0,
              walletBalanceAfterCents: settlement?.remaining ?? null,
              billingShortfallCents: settlement?.shortfall ?? 0,
            }

            // 3. 记成本到 ai_cost_records:cost 直接取上面同一个数
            await server.aiCost.record({
              userId,
              model,
              provider: provider ?? 'unknown',
              promptTokens: promptTokens ?? 0,
              completionTokens: completionTokens ?? 0,
              totalTokens: tokens,
              requestType: 'chat',
              cost: costCents,
              currency: actual.currency,
              metadata: JSON.stringify(billing),
            })
          } catch (e) {
            server.log.error(
              { err: e, userId, tokens, model },
              'settleWalletUsage/recordAiCost failed',
            )
            // 不 rethrow:避免 BullMQ 重试导致重复扣费(idempotencyKey 兜底)
          }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
