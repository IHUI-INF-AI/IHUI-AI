// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * AI 主动提问 · 上行答复判据(共享层唯一实现,2026-11-13 下沉)。
 *
 * 立此模块的因由:这套判据原本住在 `apps/web/src/hooks/use-chat/question-response.ts`,
 * 而 extension / cli / miniapp-taro / mobile-rn 要接同一件事时必须各抄一份。
 * 抄开的后果与 `ahead` 那次同型 —— **两侧各自绿、漂移无人发现**。
 * 所以把**纯判据**(不顺网、不碰 store)提到共享层,各端只保留"怎么发请求"的平台适配。
 *
 * 三条判据的来源(逐条来自服务端行为,不是约定俗成):
 *  ① **404 ⇒ legacy**:旧服务端没有这个阻塞式端点 ⇒ 必须回退旧链路(把答复当普通新消息发)。
 *  ② **duplicate 优先于 accepted**:同一问的第二发被服务端幂等吃掉时,绝不能再发起新一轮
 *     —— 否则用户看到同一段回答生成两遍。
 *  ③ **accepted=false 但带终态(timeout/withdrawn)**:这一问已有结论(超时/被撤回),
 *     同样不发起新一轮;把它当失败重试 = 对着一个已经关闭的提问反复作答。
 *
 * 单一真相源纪律(§0.6):各端不得复制本文件的判据;要改行为只能改这里。
 */

/** 上行动作:作答 or 撤回 */
export type QuestionResponseAction = 'answer' | 'withdraw'

/** 服务端认可的终态。与 ai-service `question-response` 的 status 值域一致。 */
export const QUESTION_RESPONSE_TERMINAL_STATUSES = ['answered', 'timeout', 'withdrawn'] as const
export type QuestionResponseStatus = (typeof QUESTION_RESPONSE_TERMINAL_STATUSES)[number]

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
 * - `blocking`:服务端(或幂等副本)认下这一问,前端只把卡片置终态,**不发起新一轮**
 * - `legacy`:这不是阻塞式提问(404 / 200 但没有 accepted),退回旧链路
 * - `failed`:网络/5xx,调用方先回退旧链路一次并给可重试提示
 */
export type QuestionResponseOutcome =
  | { kind: 'blocking'; status: QuestionResponseStatus; duplicate: boolean }
  | { kind: 'legacy' }
  | { kind: 'failed'; message: string }

/** ai-service 阻塞式答复端点路径 */
export function questionResponsePath(sessionId: string): string {
  return `/llm/complete/stream/${encodeURIComponent(sessionId)}/question-response`
}

export function isTerminalQuestionStatus(value: unknown): value is QuestionResponseStatus {
  return (
    typeof value === 'string' &&
    (QUESTION_RESPONSE_TERMINAL_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * 纯判据(可单测):HTTP 状态 + 响应体 → 处置结果。
 * `httpStatus` 缺省 = 网络层没拿到状态码 ⇒ 按 failed(不猜成 legacy)。
 */
export function interpretQuestionResponse(
  httpStatus: number | undefined,
  data: unknown,
): QuestionResponseOutcome {
  if (httpStatus === 404) return { kind: 'legacy' }
  const body = (data && typeof data === 'object' ? data : {}) as QuestionResponseData
  const status = isTerminalQuestionStatus(body.status) ? body.status : undefined
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
 * 旧链路的答复文本:选项 label(按选项顺序)+ 自由输入,逗号合并(与旧弹窗同形)。
 * 撤回 ⇒ 空串(调用方据此不发消息)。
 */
export function buildLegacyAnswerText(
  options: ReadonlyArray<{ id: string; label: string }>,
  response: QuestionAnswerPayload,
): string {
  if (response.action === 'withdraw') return ''
  const labels = options
    .filter((opt) => response.selectedOptionIds.includes(opt.id))
    .map((opt) => opt.label)
  const custom = (response.customText ?? '').trim()
  return [...labels, custom].filter(Boolean).join(', ')
}

/** 端点请求体(各端 POST 时逐字用这一份,避免字段名漂移) */
export function buildQuestionResponseBody(response: QuestionAnswerPayload): Record<string, unknown> {
  return {
    questionId: response.questionId,
    action: response.action,
    selectedOptionIds: response.selectedOptionIds,
    ...(response.customText ? { customText: response.customText } : {}),
  }
}

export const __test__ = {
  questionResponsePath,
  isTerminalQuestionStatus,
  interpretQuestionResponse,
  buildLegacyAnswerText,
  buildQuestionResponseBody,
}
