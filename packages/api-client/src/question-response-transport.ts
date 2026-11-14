// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * AI 主动提问 · 上行答复的传输层封装(2026-11-13 立)。
 *
 * 为什么放在 api-client 而不是各端自己 fetch:
 *  - 该端点在 **ai-service**(`/llm/complete/stream/:sid/question-response`),不在 api 网关,
 *    因此不能用 `fetchApi`(它打的是 api 基址);必须走 `getStreamBaseUrl()` + token。
 *  - 这段"取基址 + 取 token + 判 404 + 读 body"的组装逻辑若各端各写一份,必然漂移
 *    (字段名漂一次就是一条静默失效 —— 与 `ahead` 同型)。
 *  - 判据(三档归宿)在共享层 `@ihui/shared/chat/question-response`;本文件只做传输,
 *    拿到 response 后原样交给那边判,不复制任何判据。
 */

import { getStreamBaseUrl, getToken } from './client.js'

/** 内联卡提交的结构化答复(与共享层 QuestionAnswerPayload 逐字同形) */
export interface QuestionAnswerRequest {
  questionId: string
  action: 'answer' | 'withdraw'
  selectedOptionIds: string[]
  customText?: string
}

/**
 * 端点路径(与 ai-service 路由逐字对齐)。
 * 这里重述一次路径是**有意的**:本文件是传输层,需要拼 URL;
 * 判据面(`interpretQuestionResponse` 等)仍在共享层,不在本文件。
 */
export function questionResponseUrl(sessionId: string): string {
  const path = `/llm/complete/stream/${encodeURIComponent(sessionId)}/question-response`
  const base = getStreamBaseUrl()
  return base ? `${base}${path}` : path
}

/** 请求体(字段名唯一定义处;共享层也有一份同名构造器,两处输出必须逐字相同) */
export function questionAnswerBody(req: QuestionAnswerRequest): Record<string, unknown> {
  return {
    questionId: req.questionId,
    action: req.action,
    selectedOptionIds: req.selectedOptionIds,
    ...(req.customText ? { customText: req.customText } : {}),
  }
}

export interface PostQuestionResponseResult {
  /** HTTP 状态;网络层失败时为 undefined(调用方据此判 failed,不猜成 legacy) */
  httpStatus: number | undefined
  /** 响应体(解析失败为 null);形状由共享层判据裁定 */
  data: unknown
  /** 仅当网络层本身失败时有值 */
  networkError?: string
}

/**
 * POST 一条提问答复。**不做判据** —— 只把 `httpStatus` 与 `data` 原样交回,
 * 由调用方调共享层 `interpretQuestionResponse` 定归宿。
 *
 * 这样分工的理由:判据一旦在传输层出现,各端就会开始"顺手多判一点",
 * 而多判的那一点与服务端行为的偏差正是最难查的一类缺陷。
 */
export async function postQuestionResponse(
  sessionId: string,
  req: QuestionAnswerRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<PostQuestionResponseResult> {
  const token = tokenOf()
  try {
    const res = await fetch(questionResponseUrl(sessionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(questionAnswerBody(req)),
      ...(opts.signal ? { signal: opts.signal } : {}),
    })
    const data: unknown = await res.json().catch(() => null)
    return { httpStatus: res.status, data }
  } catch (e) {
    return {
      httpStatus: undefined,
      data: null,
      networkError: e instanceof Error ? e.message : String(e),
    }
  }
}

/** 取 token:`getToken` 是本包公开出口(与其余端点同源),不另造注入点。 */
function tokenOf(): string | null {
  try {
    return getToken()
  } catch {
    return null
  }
}
