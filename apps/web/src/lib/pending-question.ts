import { z } from 'zod'

import type { PendingQuestion } from '@/stores/chat'

/**
 * AI 主动提问挂起状态运行时校验 schema。
 *
 * 用途:
 * 1. loadHistory 从 conversation.metadata.pendingQuestion 恢复挂起状态时校验
 *    (DB metadata 可能被其他端写入异常结构 / 被外部篡改 / 字段类型不匹配)
 * 2. WS ai_question 事件 payload 校验(其他端通过 Redis Pub/Sub 传入的数据)
 *
 * 失败时返回 null,调用方应 clearPendingQuestion 降级(不弹窗),避免脏数据
 * 让 zustand store 持有非法结构导致后续 UI 崩溃。
 *
 * 与 stores/chat.ts 的 PendingQuestion 接口对齐(单一类型来源,运行时校验独立)。
 */
const QuestionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
})

const PendingQuestionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  options: z.array(QuestionOptionSchema),
  allowCustom: z.boolean(),
  allowMultiple: z.boolean(),
  /** 关联的 assistant 消息 ID,用户回答后追加到该消息上下文 */
  assistantMessageId: z.string().optional(),
})

/** 运行时校验 pendingQuestion 数据,失败返回 null(调用方降级为 clearPendingQuestion) */
export function parsePendingQuestion(data: unknown): PendingQuestion | null {
  const result = PendingQuestionSchema.safeParse(data)
  return result.success ? (result.data as PendingQuestion) : null
}
