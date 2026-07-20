/**
 * Token 估算工具
 *
 * 简易客户端估算:英文 ~4 字符/token,中文 ~1.5 字符/token。
 * 与服务端 tiktoken 精确计数存在 ±10% 误差,仅用于 UI 进度条展示。
 *
 * 从 hooks/use-context-manager.ts 提取为共享工具,供 ContextUsageRing 等组件复用。
 */

import type { ChatMessage } from '@/stores/chat'

/** 估算单段文本的 token 数 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const other = text.length - cjk
  return Math.ceil(cjk / 1.5 + other / 4)
}

/** 估算单条消息的 token 数(含 role 标记开销 ~4 token) */
export function estimateMessageTokens(message: { content: string }): number {
  return estimateTokens(message.content ?? '') + 4
}

/** 估算消息列表的总 token 数 */
export function estimateConversationTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

/** 估算 ChatMessage[] 的总 token 数(过滤 error 消息) */
export function estimateChatMessagesTokens(messages: ChatMessage[]): number {
  return messages
    .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
    .reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}
