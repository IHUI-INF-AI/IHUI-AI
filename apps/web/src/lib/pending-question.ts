import { z } from 'zod'

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
 * 类型来源:PendingQuestionFromSchema 由 z.infer 自动推导,与 stores/chat.ts 的
 * PendingQuestion 接口结构对齐(结构化类型兼容)。若 schema 漂移,调用方 TS 立即报错,
 * 无需依赖运行时测试发现。
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

/** 由 schema 推导的类型,与 stores/chat.ts 的 PendingQuestion 结构兼容 */
export type PendingQuestionFromSchema = z.infer<typeof PendingQuestionSchema>

/** 运行时校验 pendingQuestion 数据,失败返回 null(调用方降级为 clearPendingQuestion) */
export function parsePendingQuestion(data: unknown): PendingQuestionFromSchema | null {
  const result = PendingQuestionSchema.safeParse(data)
  if (!result.success) {
    // data 为 null/undefined 时静默返回 null(正常:无挂起提问)
    // data 非 null 但结构非法时,dev 环境 console.warn 辅助调试脏数据来源
    if (process.env.NODE_ENV !== 'production' && data !== null && data !== undefined) {
      console.warn(
        '[parsePendingQuestion] 数据校验失败,降级为 null:',
        result.error.issues,
        data,
      )
    }
    return null
  }
  return result.data
}
