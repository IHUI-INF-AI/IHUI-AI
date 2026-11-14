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

import { fetchAiServiceJson } from '@/lib/api'

/**
 * 〔2026-11-13 下沉〕本文件原本自带一套纯判据(类型 / questionResponsePath /
 * interpretQuestionResponse / buildLegacyAnswerText / TERMINAL_STATUSES)。
 * 现在这些全部移到 `@ihui/shared/chat/question-response` —— 因为 extension / cli /
 * miniapp-taro / mobile-rn 要接同一件事,各抄一份必然漂移(与 `ahead` 漏字段同型)。
 * 本文件只保留**平台适配**部分(postQuestionResponse 走本端 fetchAiServiceJson)。
 */
export {
  QUESTION_RESPONSE_TERMINAL_STATUSES,
  questionResponsePath,
  isTerminalQuestionStatus,
  interpretQuestionResponse,
  buildLegacyAnswerText,
  buildQuestionResponseBody,
  type QuestionResponseAction,
  type QuestionResponseStatus,
  type QuestionAnswerPayload,
  type QuestionResponseData,
  type QuestionResponseOutcome,
} from '@ihui/shared/chat/question-response'

import {
  buildQuestionResponseBody,
  interpretQuestionResponse,
  questionResponsePath,
  type QuestionAnswerPayload,
  type QuestionResponseData,
  type QuestionResponseOutcome,
} from '@ihui/shared/chat/question-response'

/** 发阻塞式答复。调用方负责判 404/失败后的回退(本函数不改 store、不发消息)。 */
export async function postQuestionResponse(
  sessionId: string,
  response: QuestionAnswerPayload,
): Promise<QuestionResponseOutcome> {
  const result = await fetchAiServiceJson<QuestionResponseData>(questionResponsePath(sessionId), {
    method: 'POST',
    // 请求体由共享层构造(字段名与端点契约同源,端内不再手写键名)
    body: JSON.stringify(buildQuestionResponseBody(response)),
  })
  if (!result.success) {
    if (result.status === 404) return { kind: 'legacy' }
    return { kind: 'failed', message: result.error || 'question-response failed' }
  }
  return interpretQuestionResponse(result.status, result.data)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
