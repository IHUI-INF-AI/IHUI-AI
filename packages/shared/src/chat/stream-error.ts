// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式失败的跨端标记规则(G-152 余项,2026-09-22 立)。
 *
 * 词汇沿用共享层既有 `ChatMessage.error`(不另立 failed):
 * web 端自 2026-07-28 起就用它渲染错误卡片 + 重试,miniapp 端此前只在 content 里
 * 写一句错误文案、数据上与真回答完全同形 —— 会被当内容持久化进本地历史,
 * 界面上也看不出"这轮没成功、可以再发一次"。这里把"怎么标记"收成一份实现。
 */

/** 失败轮所需的最小结构(各端消息类型都满足:web / miniapp / mobile-rn) */
export interface ErrorAwareMessage {
  role: string
  content: string
  error?: boolean
  /**
   * D92/D71②:后端业务错误码。各端**可选**填,渲染侧统一交给
   * `@ihui/shared/utils/view-failure-taxonomy` 归类;不填即 unknown 回落态。
   */
  errorCode?: string
}

/**
 * 把一条助手消息标成失败轮。
 *
 * 已有内容不覆盖:半途断流时用户已经看到部分内容,清掉它等于销毁有效信息;
 * 所以只在内容为空时写入错误文案。错误文案由调用方本地化后传入,这里不编造。
 *
 * `errorCode` 为**可选第三参**(D92 接线用):既有各端一律两参调用,
 * 不传就不写该字段 ⇒ 本次改动对 miniapp / mobile-rn 零行为影响。
 */
export function markStreamError<T extends ErrorAwareMessage>(
  msg: T,
  errorText: string,
  errorCode?: string,
): T {
  const marked: ErrorAwareMessage = {
    ...msg,
    error: true,
    content: msg.content ? msg.content : errorText,
  }
  if (errorCode) marked.errorCode = errorCode
  return marked as T
}

/**
 * 把流式失败落到"最后一条助手消息"上(无消息 id 的端用尾位定位)。
 *
 * 只改最后一条且必须是 assistant:流中途切会话/并发时不能改到别的消息;
 * 不满足定位条件时原样返回,调用方无需再判空。
 */
export function applyStreamError<T extends ErrorAwareMessage>(
  messages: readonly T[],
  errorText: string,
): T[] {
  const idx = messages.length - 1
  const tail = messages[idx]
  if (!tail || tail.role !== 'assistant') return [...messages]
  const patched = markStreamError(tail, errorText)
  return messages.map((m, i) => (i === idx ? patched : m))
}

/** 该消息是否失败轮(失败轮不是内容:不得进历史持久化 / 收藏 / 分享 / 复制) */
export function isErrorTurn(msg: ErrorAwareMessage | undefined | null): boolean {
  return msg?.error === true
}

/**
 * 重发目标:最后一条 user 消息的文本;null 表示没有可重发的输入。
 *
 * 调用方据此隐藏重发动作,而不是发一条空消息出去(那会真打一次 API 并产生无意义回答)。
 */
export function resendTargetText(messages: readonly ErrorAwareMessage[]): string | null {
  const idx = messages.map((m) => m.role).lastIndexOf('user')
  if (idx < 0) return null
  const text = messages[idx]?.content?.trim()
  return text ? text : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
