// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `question-resolved` 结算帧的解析与落地(2026-11-08 立)。
//
// 帧形状(SSE data):
//   {"type":"question-resolved","questionId":"q_x","status":"answered|timeout|withdrawn|interrupted",
//    "selectedOptionIds":[],"customText":""}
//
// 纪律:
// - questionId 必须与当前挂起提问**逐字匹配**才落地;不匹配的帧一律忽略(别问 A 时被 B 的结算抹掉)
// - 只看 `type` 与 `status`,其余字段(selectedOptionIds/customText)作为终态回显,不做二次校验
// - 帧可能是旧代际(无 type),解析失败返回 null,调用方静默忽略

import type { ChatStore } from '@/stores/chat-pane-context'

/** 传输层把这个帧投递到 window 上的唯一事件名(与仓内 `ihui:*` 事件族同形) */
export const QUESTION_RESOLVED_EVENT = 'ihui:question-resolved'

export type QuestionResolvedStatus = 'answered' | 'timeout' | 'withdrawn' | 'interrupted'

export interface QuestionResolvedEvent {
  type: 'question-resolved'
  questionId: string
  status: QuestionResolvedStatus
  selectedOptionIds: string[]
  customText?: string
}

const RESOLVED_STATUSES: ReadonlySet<string> = new Set([
  'answered',
  'timeout',
  'withdrawn',
  'interrupted',
])

/** 纯解析:非法/旧帧返回 null(不做"猜"式降级) */
export function parseQuestionResolvedEvent(data: unknown): QuestionResolvedEvent | null {
  if (!data || typeof data !== 'object') return null
  const frame = data as Record<string, unknown>
  if (frame.type !== 'question-resolved') return null
  if (typeof frame.questionId !== 'string' || !frame.questionId) return null
  if (typeof frame.status !== 'string' || !RESOLVED_STATUSES.has(frame.status)) return null
  return {
    type: 'question-resolved',
    questionId: frame.questionId,
    status: frame.status as QuestionResolvedStatus,
    selectedOptionIds: Array.isArray(frame.selectedOptionIds)
      ? frame.selectedOptionIds.filter((id): id is string => typeof id === 'string')
      : [],
    ...(typeof frame.customText === 'string' ? { customText: frame.customText } : {}),
  }
}

/** 事件桥的 detail 既可能是对象,也可能是 SSE 原始 data 字符串(JSON) */
export function parseQuestionResolvedPayload(detail: unknown): QuestionResolvedEvent | null {
  if (typeof detail !== 'string') return parseQuestionResolvedEvent(detail)
  try {
    return parseQuestionResolvedEvent(JSON.parse(detail))
  } catch {
    return null
  }
}

/**
 * 把结算帧落到指定 store。返回是否命中当前提问。
 * 命中即摘除 pendingQuestion —— 卡片在结算前已是本地终态只读态,结算后随流移除。
 */
export function applyQuestionResolvedEvent(
  chatStore: ChatStore,
  event: QuestionResolvedEvent,
): boolean {
  const pending = chatStore.getState().pendingQuestion
  if (!pending || pending.questionId !== event.questionId) return false
  chatStore.getState().clearPendingQuestionFor(event.questionId)
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
