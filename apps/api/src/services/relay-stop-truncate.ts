// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * stop 序列的本地截断(2026-10-23 立)。
 *
 * 为什么要本地做:WorkBuddy 上游对 `stop` 的实测行为是——字符串形态直接 400
 * (`json: cannot unmarshal string into Go struct field Request`),数组形态收下但**不生效**
 * (实测 stop=["OK"] 仍返回 "OK")。协议注释里"账号池由适配器本地截断"此前只是注释,没有实现。
 *
 * 语义按 OpenAI:命中的 stop 串本身不出现在输出里;流式下必须跨 chunk 检测,
 * 所以保留 maxStopLen-1 个字符的尾巴;命中后丢弃其后所有内容。只作用于可见 content,
 * 不动 reasoning_content / tool_calls。
 */

export interface StopTruncateResult {
  text: string
  matched: boolean
}

export interface StopTruncator {
  push(text: string): StopTruncateResult
  flush(): StopTruncateResult
}

export function normalizeStopList(stop?: string | string[] | null): string[] {
  const list = Array.isArray(stop) ? stop : typeof stop === 'string' ? [stop] : []
  return [...new Set(list.filter((s) => typeof s === 'string' && s.length > 0))]
}

/** 切分时不要劈开代理对(emoji 等),否则会输出半个字符 */
function safePrefix(text: string, end: number): string {
  if (end <= 0) return ''
  if (end >= text.length) return text
  const code = text.charCodeAt(end - 1)
  if (code >= 0xd800 && code <= 0xdbff) return text.slice(0, end - 1)
  return text.slice(0, end)
}

function earliestMatch(buffer: string, stops: string[]): number {
  let best = -1
  for (const s of stops) {
    const i = buffer.indexOf(s)
    if (i !== -1 && (best === -1 || i < best)) best = i
  }
  return best
}

export function createStopTruncator(stop?: string | string[] | null): StopTruncator | null {
  const stops = normalizeStopList(stop)
  if (stops.length === 0) return null
  const holdback = Math.max(...stops.map((s) => s.length)) - 1
  let buffer = ''
  let matched = false

  return {
    push(text: string): StopTruncateResult {
      if (matched) return { text: '', matched: true }
      if (!text) return { text: '', matched: false }
      buffer += text
      const idx = earliestMatch(buffer, stops)
      if (idx !== -1) {
        const emit = buffer.slice(0, idx)
        buffer = ''
        matched = true
        return { text: emit, matched: true }
      }
      if (buffer.length <= holdback) return { text: '', matched: false }
      const emit = safePrefix(buffer, buffer.length - holdback)
      buffer = buffer.slice(emit.length)
      return { text: emit, matched: false }
    },
    flush(): StopTruncateResult {
      if (matched) return { text: '', matched: true }
      const out = buffer
      buffer = ''
      return { text: out, matched: false }
    },
  }
}

/** 一次性文本截断(非流式聚合/JSON 响应用) */
export function truncateAtStops(
  text: string,
  stop?: string | string[] | null,
): StopTruncateResult {
  const stops = normalizeStopList(stop)
  if (stops.length === 0) return { text, matched: false }
  const idx = earliestMatch(text, stops)
  return idx === -1 ? { text, matched: false } : { text: text.slice(0, idx), matched: true }
}

/** 对已聚合的 chat.completion 就地截断(choices[].message.content) */
export function applyStopToCompletion(
  completion: Record<string, unknown>,
  stop?: string | string[] | null,
): boolean {
  const choices = Array.isArray(completion.choices) ? completion.choices : []
  let anyMatched = false
  for (const raw of choices) {
    if (!raw || typeof raw !== 'object') continue
    const choice = raw as Record<string, unknown>
    const message = (choice.message ?? choice.delta) as Record<string, unknown> | undefined
    if (!message || typeof message.content !== 'string') continue
    const r = truncateAtStops(message.content, stop)
    if (!r.matched) continue
    message.content = r.text
    choice.finish_reason = 'stop'
    anyMatched = true
  }
  return anyMatched
}

export const __test__ = {
  normalizeStopList,
  createStopTruncator,
  truncateAtStops,
  applyStopToCompletion,
  safePrefix,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
