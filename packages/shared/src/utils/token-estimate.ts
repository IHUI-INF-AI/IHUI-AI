/**
 * Token 估算工具(跨端共享,2026-08-01 P3-4.2 批次5 立,从 apps/web/src/lib/token-estimate.ts 下沉)。
 *
 * 简易客户端估算:英文 ~4 字符/token,中文 ~1.5 字符/token。
 * 与服务端 tiktoken 精确计数存在 ±10% 误差,仅用于 UI 进度条展示。
 *
 * 注:精确 token 计数(BPE 真实分词)在 @ihui/context-compaction 包,
 * 本工具仅用于 UI 估算场景(如 ContextUsageRing 进度环)。
 */

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
