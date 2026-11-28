// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-C：Agent Loop 多轮累计上下文预算（2026-11-27）。
 *
 * `TOOL_OUTPUT_MAX_CHARS` 只管单条工具输出；10 轮 × 每轮 8 个工具仍可能把模型上下文顶爆。
 * 本模块只做“发请求前的有界化”：保留最近两条消息原样，把更早的 tool 结果按剩余预算压到
 * 头尾预览；不改 `messages` 原数组，不删除 assistant/tool 配对，避免模型收到孤立的
 * `tool_call_id`。
 */

export const AGENT_CONTEXT_MAX_CHARS_DEFAULT = 120_000
export const AGENT_CONTEXT_MIN_CHARS = 20_000
export const AGENT_CONTEXT_MAX_CHARS_LIMIT = 500_000

export function resolveAgentContextMaxChars(raw = process.env.IHUI_AGENT_CONTEXT_MAX_CHARS): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return AGENT_CONTEXT_MAX_CHARS_DEFAULT
  return Math.max(AGENT_CONTEXT_MIN_CHARS, Math.min(AGENT_CONTEXT_MAX_CHARS_LIMIT, Math.floor(parsed)))
}

export function estimateMessagesChars(messages: Array<Record<string, unknown>>): number {
  return JSON.stringify(messages).length
}

function compactText(text: string, limit: number): string {
  if (text.length <= limit) return text
  const marker = `\n…[上下文预算压缩：原 ${text.length} 字符，仅保留首尾；完整内容见工具落盘/原轨迹]…\n`
  if (limit <= marker.length + 200) return text.slice(0, Math.max(0, limit))
  const remaining = limit - marker.length
  const head = Math.floor(remaining * 0.6)
  const tail = remaining - head
  return `${text.slice(0, head)}${marker}${text.slice(-tail)}`
}

/**
 * 返回可直接发给 LLM 的消息副本；超预算时优先压旧 tool 结果，其次压旧非 system 内容。
 * 不保证在 system/user 本身就超预算时还能压到 maxChars —— 那种情况属于调用方配置错误。
 */
export function compactAgentContext(
  messages: Array<Record<string, unknown>>,
  maxChars = AGENT_CONTEXT_MAX_CHARS_DEFAULT,
): {
  messages: Array<Record<string, unknown>>
  compacted: boolean
  beforeChars: number
  afterChars: number
} {
  const beforeChars = estimateMessagesChars(messages)
  if (beforeChars <= maxChars) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars }
  }

  const working = messages.map((message) => ({ ...message }))
  // 最近两条通常是本轮 assistant.tool_calls + 最新 tool 结果，保留原样给模型续推。
  const tailStart = Math.max(0, working.length - 2)
  const old = working.slice(0, tailStart)
  const tail = working.slice(tailStart)
  const oldToolMessages = old.filter((message) => message['role'] === 'tool')
  const fixedChars =
    estimateMessagesChars(old.filter((message) => message['role'] !== 'tool')) +
    estimateMessagesChars(tail)
  const available = Math.max(0, maxChars - fixedChars - 256)
  const perTool = oldToolMessages.length
    ? Math.max(800, Math.floor(available / oldToolMessages.length))
    : 0

  for (const message of oldToolMessages) {
    if (typeof message['content'] === 'string') {
      message['content'] = compactText(message['content'], perTool)
    }
  }

  // 最近两条里的 tool 结果也可能单条就超预算；旧结果压完仍超时，再把尾部 tool 结果压到剩余空间。
  if (estimateMessagesChars(working) > maxChars) {
    const tailToolMessages = tail.filter((message) => message['role'] === 'tool')
    const beforeTail = working.slice(0, tailStart)
    const tailNonTool = tail.filter((message) => message['role'] !== 'tool')
    const availableForTail = Math.max(
      800,
      Math.floor(
        (maxChars - estimateMessagesChars(beforeTail) - estimateMessagesChars(tailNonTool) - 256) /
          Math.max(1, tailToolMessages.length),
      ),
    )
    for (const message of tailToolMessages) {
      if (typeof message['content'] === 'string') {
        message['content'] = compactText(message['content'], availableForTail)
      }
    }
  }

  // 旧 tool 结果压完仍超预算时，再压旧的非 system 消息（通常是过长的 assistant 内容/参数）。
  if (estimateMessagesChars(working) > maxChars) {
    const oldNonSystem = old.filter((message) => message['role'] !== 'system')
    const remaining = Math.max(
      1_000,
      Math.floor((maxChars - estimateMessagesChars(tail) - 256) / Math.max(1, oldNonSystem.length)),
    )
    for (const message of oldNonSystem) {
      if (typeof message['content'] === 'string') {
        message['content'] = compactText(message['content'], remaining)
      }
    }
  }

  const afterChars = estimateMessagesChars(working)
  return {
    messages: working,
    compacted: afterChars < beforeChars,
    beforeChars,
    afterChars,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
