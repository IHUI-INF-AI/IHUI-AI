// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AskUserQuestion 阻塞式问答 —— 判定层（2026-11-08 立，2026-11-14 上收 shared）。
//
// 原实现在 apps/web/src/hooks/use-chat/question-response.ts；RN 腿（D135 最小可视态
// 补齐交互）需要同一份判据，按 §0.6 单一真相源上收 shared，web 与 RN 共用。
//
// 本模块**不取数、不发 HTTP、不碰 store**：三件纯事——
//  1. 类型契约（QuestionAnswerPayload / QuestionResponseOutcome）
//  2. 响应形状处置（interpretQuestionResponse）
//  3. 旧链路答复文本构造（buildLegacyAnswerText）
// 「blocking 之后怎么落 store、legacy 怎么回退」由各端编排层负责（web send-answer.ts
// / RN InlineQuestionSheet），这样判据可单测、链路可回退。

/** 用户动作:answer 提交答复 / withdraw 撤回 */
export type QuestionResponseAction = 'answer' | 'withdraw'

/** 服务端终态:answered / timeout / withdrawn(interrupted 由 ai-service 独有,不进本集合) */
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

/** 终态集合(interrupted 由 ai-service 独有,不进本集合) */
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
  // 网络层没拿到状态码 = 请求根本没到服务端,按 failed(调用方给可重试提示 + 回退一次)
  if (httpStatus === undefined) return { kind: 'failed', message: 'network error' }
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

/**
 * 旧链路的答复文本:选项 label(按 id 顺序)+ 自由输入,逗号合并(与旧弹窗同形)。
 * `options` 形状与 PendingQuestion.options 同族,不依赖具体 store 类型(§0.6 跨端可复用)。
 */
export function buildLegacyAnswerText(
  question: { options: Array<{ id: string; label: string }> },
  response: QuestionAnswerPayload,
): string {
  if (response.action === 'withdraw') return ''
  const labels = question.options
    .filter((opt) => response.selectedOptionIds.includes(opt.id))
    .map((opt) => opt.label)
  const custom = (response.customText ?? '').trim()
  return [...labels, custom].filter(Boolean).join(', ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
