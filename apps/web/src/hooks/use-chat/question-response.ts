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

// 2026-11-14 判定层上收 @ihui/shared/chat/question-response(§0.6 单一真相源):
// RN 腿(D135 补齐交互)需要同一份判据,web 与 RN 共用。本文件只留 web 独有的
// `postQuestionResponse`(fetchAiServiceJson 是 web 的 HTTP 出口,不进 shared)。
// 判定逻辑(interpretQuestionResponse / buildLegacyAnswerText)与类型契约一律从 shared
// re-export,保持既有导入面(`@/hooks/use-chat/question-response`)零变化,调用方不动。
import type {
  QuestionAnswerPayload,
  QuestionResponseData,
  QuestionResponseOutcome,
} from '@ihui/shared/chat/question-response'
import {
  interpretQuestionResponse,
  questionResponsePath,
} from '@ihui/shared/chat/question-response'
import { fetchAiServiceJson } from '@/lib/api'

export type {
  QuestionResponseAction,
  QuestionResponseStatus,
  QuestionAnswerPayload,
  QuestionResponseData,
  QuestionResponseOutcome,
} from '@ihui/shared/chat/question-response'
export {
  interpretQuestionResponse,
  buildLegacyAnswerText,
  questionResponsePath,
} from '@ihui/shared/chat/question-response'

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
