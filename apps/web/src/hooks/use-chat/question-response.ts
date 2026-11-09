// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 阻塞式提问答复上行(2026-11-08 立)。
//
// 旧链路是「marker 式」:模型在正文里吐 `[[ASK_USER:...]]`,前端把答复包成一条新的
// 用户消息,再发起新一轮 `/ai/chat/answer`。新链路是「阻塞式」:ai-service 的流还挂着等
// 这一问的答复,前端只回一个结构化的应答体,模型侧自己接着往下走 —— **不新增用户消息、
// 不发起新一轮**。
//
// 本文件只做三件纯事:拼 URL、发请求、把响应形状翻成三种结果(blocking / legacy / failed)。
// 「blocking 之后怎么落 store、legacy 怎么退回旧链路」由 send-answer.ts 的编排层负责,
// 这样判据可单测、链路可回退。

import type { PendingQuestion } from '@/stores/chat'
import { fetchAiServiceJson } from '@/lib/api'

export type QuestionResponseAction = 'answer' | 'withdraw'
export type QuestionResponseStatus = 'answered' | 'timeout' | 'withdrawn'

/** 内联卡提交的结构化答复(与端点 body 同形,便于直接透传/单测断言) */
export interface QuestionAnswerPayload {
  questionId: string
  action: QuestionResponseAction
  selectedOptionIds: string[]
  customText?: string
}

/** 端点响应体(字段全部可选:旧服务端/异常体不假设形状) */
export interface QuestionResponseData {
  accepted?: boolean
  status?: string
  duplicate?: boolean
}

/**
 * 响应形状 → 处置结果。
 * - `blocking`:服务端(或幂等副本)认下这一问,前端只把卡片置终态,不发起新一轮
 * - `legacy`:这不是阻塞式提问(404 / 200 但没有 accepted),退回旧链路
 * - `failed`:网络/5xx,调用方先回退旧链路一次并给可重试提示
 */
export type QuestionResponseOutcome =
  | { kind: 'blocking'; status: QuestionResponseStatus; duplicate: boolean }
  | { kind: 'legacy' }
  | { kind: 'failed'; message: string }

const TERMINAL_STATUSES = new Set<QuestionResponseStatus>(['answered', 'timeout', 'withdrawn'])

/** ai-service 阻塞式答复端点(与 `POST /llm/complete/stream/:sessionId/question-response` 对齐) */
export function questionResponsePath(sessionId: string): string {
  return `/llm/complete/stream/${encodeURIComponent(sessionId)}/question-response`
}

function isTerminalStatus(value: unknown): value is QuestionResponseStatus {
  return typeof value === 'string' && TERMINAL_STATUSES.has(value as QuestionResponseStatus)
}

/**
 * 纯判据(可单测):HTTP 状态 + 响应体 → 处置结果。
 * `status` 缺省 = 网络层没拿到状态码(按 failed)。
 */
export function interpretQuestionResponse(
  httpStatus: number | undefined,
  data: unknown,
): QuestionResponseOutcome {
  if (httpStatus === 404) return { kind: 'legacy' }
  const body = (data && typeof data === 'object' ? data : {}) as QuestionResponseData
  const status = isTerminalStatus(body.status) ? body.status : undefined
  // duplicate 优先:同一问的第二发被服务端幂等吃掉时,绝不能再发起新一轮
  if (body.duplicate === true) {
    return { kind: 'blocking', status: status ?? 'answered', duplicate: true }
  }
  if (body.accepted === true) {
    return { kind: 'blocking', status: status ?? 'answered', duplicate: false }
  }
  // accepted=false 但带终态(超时/撤回):这一问已有结论,同样不发起新一轮
  if (status === 'timeout' || status === 'withdrawn') {
    return { kind: 'blocking', status, duplicate: false }
  }
  return { kind: 'legacy' }
}

/** 旧链路的答复文本:选项 label(按 id 顺序)+ 自由输入,逗号合并(与旧弹窗同形) */
export function buildLegacyAnswerText(
  question: Pick<PendingQuestion, 'options'>,
  response: QuestionAnswerPayload,
): string {
  if (response.action === 'withdraw') return ''
  const labels = question.options
    .filter((opt) => response.selectedOptionIds.includes(opt.id))
    .map((opt) => opt.label)
  const custom = (response.customText ?? '').trim()
  return [...labels, custom].filter(Boolean).join(', ')
}

/** 发阻塞式答复。调用方负责判 404/失败后的回退(本函数不改 store、不发消息)。 */
export async function postQuestionResponse(
  sessionId: string,
  response: QuestionAnswerPayload,
): Promise<QuestionResponseOutcome> {
  const result = await fetchAiServiceJson<QuestionResponseData>(questionResponsePath(sessionId), {
    method: 'POST',
    body: JSON.stringify({
      questionId: response.questionId,
      action: response.action,
      selectedOptionIds: response.selectedOptionIds,
      ...(response.customText ? { customText: response.customText } : {}),
    }),
  })
  if (!result.success) {
    if (result.status === 404) return { kind: 'legacy' }
    return { kind: 'failed', message: result.error || 'question-response failed' }
  }
  return interpretQuestionResponse(result.status, result.data)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
