// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sendMessage as persistMessage, persistQuestion } from '@ihui/api-client'
import { logger } from '@/lib/logger'
import { toast } from '@/components/common'
import { useChatStore, type SendReliabilityStatus } from '@/stores/chat'

/** D60 发送可靠性状态族(2026-09-23 立):persist 层对外状态,复用 store 的单一真相源类型 */
export type PersistSendStatus = SendReliabilityStatus

/** persistMessageSafe 的归一化结果(调用方据此渲染输入框/重试按钮,禁止自行解析 error 文案) */
export interface PersistSendOutcome {
  /** 'ok' = 持久化成功;其余四态见 SendReliabilityStatus 注释 */
  status: 'ok' | PersistSendStatus
  /** 失败时输入正文是否已写入 store.failedDraft(空正文不写,为 false) */
  draftPreserved: boolean
  /** 是否可重发:failed_retryable / idempotent_conflict 为 true;archived / deleted 为 false */
  retryable: boolean
}

/** classifyPersistFailure 的输入(ApiResult 失败分支的最小结构,不依赖具体 data 泛型) */
export interface PersistFailureInput {
  success: false
  error?: string
  status?: number
  errorCode?: string
}

/**
 * D60: normalize persist failure to four states (pure function, unit-testable).
 * Priority (English-driven only, TRANSITIONAL until D60 vocab lands in messages):
 * 1. archived: errorCode contains ARCHIV / HTTP 410 / English text contains ARCHIV
 * 2. deleted: HTTP 404 / errorCode contains DELET/NOT_FOUND / English text contains DELET/NOT_FOUND/NOT EXIST
 * 3. idempotent_conflict: HTTP 409 / errorCode contains CONFLICT/IDEMPOTEN / English text contains CONFLICT/IDEMPOTEN
 * 4. fallback failed_retryable (network/5xx/401/429, all retryable; Chinese-only messages fall here transitionally)
 */
export function classifyPersistFailure(res: PersistFailureInput): PersistSendStatus {
  const code = (res.errorCode ?? '').toUpperCase()
  const upperMsg = (res.error ?? '').toUpperCase()
  // 1. Archived: explicit code first (future ARCHIVED code), 410 Gone shares archived semantics
  if (code.includes('ARCHIV')) return 'archived'
  if (res.status === 410) return 'archived'
  // 2. Deleted: 404 / explicit delete codes / English text fallback (bare "delete" verb
  // in 403 "cannot delete this message" must not come here without code/status, hence text
  // fallback requires DELET only alongside gone/not-found signals is NOT needed: DELET alone
  // in English body is a strong terminal signal, unlike the old Chinese bare-match guard)
  if (res.status === 404) return 'deleted'
  if (code.includes('DELET') || code.includes('NOT_FOUND') || code.includes('NOTFOUND')) {
    return 'deleted'
  }
  if (
    upperMsg.includes('DELET') ||
    upperMsg.includes('NOT_FOUND') ||
    upperMsg.includes('NOTFOUND') ||
    upperMsg.includes('NOT EXIST')
  ) {
    return 'deleted'
  }
  // Archived via English text (checked after deleted so delete signals win on overlap)
  if (upperMsg.includes('ARCHIV')) return 'archived'
  // 3. Idempotent conflict
  if (res.status === 409) return 'idempotent_conflict'
  if (code.includes('CONFLICT') || code.includes('IDEMPOTEN')) return 'idempotent_conflict'
  if (upperMsg.includes('CONFLICT') || upperMsg.includes('IDEMPOTEN')) return 'idempotent_conflict'
  // 4. Fallback: retryable failure
  return 'failed_retryable'
}

/** Four-state user-visible texts (TRANSITIONAL English until D60 vocab lands in messages; replaces inline Chinese fallback, zero new keys) */
export interface PersistTexts {
  title: string
  description: string
  /** 有值 = toast 配重发类按钮;archived/deleted 终态无按钮,为 undefined */
  actionLabel?: string
}

export function resolvePersistTexts(status: PersistSendStatus, rawError?: string): PersistTexts {
  const reason = rawError?.trim() ? rawError.trim() : null
  switch (status) {
    case 'failed_retryable':
      return {
        title: 'Send failed, draft preserved',
        description: reason
          ? `${reason}. Draft preserved in the input, retry available.`
          : 'Network error, message not recorded by the server. Draft preserved in the input, retry available.',
        actionLabel: 'Retry',
      }
    case 'idempotent_conflict':
      return {
        title: 'Content differs, send as new message',
        description:
          'This message already exists but differs from the current input. Draft preserved, review and send as a new message.',
        actionLabel: 'Send as new message',
      }
    case 'archived':
      return {
        title: 'Conversation archived, sending disabled',
        description:
          'This conversation is archived and draft preserved. Unarchive and retry, or copy to a new conversation.',
      }
    case 'deleted':
      return {
        title: 'Task archived or deleted, sending disabled',
        description:
          'This task is archived or deleted and sending disabled. Draft preserved, copy to a new conversation to send.',
      }
  }
}

/** persistMessageSafe 的扩展选项(全可选,既有调用方零改动) */
export interface PersistMessageOptions {
  /** 失败 toast 重发按钮回调(由调用方传入重发闭包);不传则 toast 无按钮 */
  retry?: () => void
  /** 草稿落 store 后的通知钩子(测试/埋点用);默认行为(写 store)不受影响 */
  onPreserved?: (draft: string, status: PersistSendStatus) => void
}

/** 后台持久化消息:成功返回 ok;失败归一化为 D60 四态 + 草稿保全 + 明示 toast(非阻塞)
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据
 *  D60(2026-09-23):返回值从 void 扩展为 PersistSendOutcome,既有用 `void persistMessageSafe(...)`
 *  调用全部兼容(返回值被丢弃);新增可选 options 参数,既有调用零改动。 */
export async function persistMessageSafe(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
  metadata?: { questionId?: string; isAnswer?: boolean; [key: string]: unknown },
  reasoning?: string,
  options?: PersistMessageOptions,
): Promise<PersistSendOutcome> {
  const res = await persistMessage(conversationId, content, role, metadata, reasoning).catch(
    (err: unknown): PersistFailureInput => ({
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    }),
  )
  if (res.success) {
    // 同文草稿已落地 → 清理,避免输入框残留旧草稿;他文草稿(另一次失败的保留)不动
    const state = useChatStore.getState()
    if (state.failedDraft === content) state.clearFailedDraft()
    return { status: 'ok', draftPreserved: false, retryable: false }
  }
  const status = classifyPersistFailure(res)
  const texts = resolvePersistTexts(status, res.error)
  const preserved = content.trim().length > 0
  if (preserved) {
    useChatStore.getState().setFailedDraft(content, status)
    options?.onPreserved?.(content, status)
  }
  logger.error(`[chat] persist ${role} message failed [${status}]:`, res.error)
  // 可重发两态配重发按钮(调用方传入 retry 才有);终态(归档/删除)不配按钮,避免误导
  const retryable = status === 'failed_retryable' || status === 'idempotent_conflict'
  const action =
    retryable && options?.retry && texts.actionLabel
      ? { label: texts.actionLabel, onClick: options.retry }
      : undefined
  const toastPayload = action
    ? { description: texts.description, action }
    : { description: texts.description }
  if (status === 'failed_retryable') {
    toast.error(texts.title, toastPayload)
  } else {
    // 幂等冲突/归档/删除用 warning 级:不是系统错误,是需要用户决策/知晓的状态
    toast.warning(texts.title, toastPayload)
  }
  return { status, draftPreserved: preserved, retryable }
}

/** 后台持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  失败仅打日志,不阻塞主流程(用户仍能在当前端看到弹窗,只是其他端不会同步) */
export async function persistQuestionSafe(
  conversationId: string,
  question: {
    questionId: string
    prompt: string
    options: { id: string; label: string }[]
    allowCustom: boolean
    allowMultiple: boolean
  },
) {
  const res = await persistQuestion({ conversationId, ...question })
  if (!res.success) {
    logger.error(`[chat] persist question ${question.questionId} failed:`, res.error)
    // 静默失败:不弹 toast(避免干扰用户),仅日志记录
    // 影响:其他端不会收到 ai_question WS 事件,但当前端弹窗仍正常工作
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
