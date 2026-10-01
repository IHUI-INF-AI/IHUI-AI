// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D36 会话内输入历史栈(纯逻辑:push/去重/50 上限/游标导航;平台无关,web 接线在 use-prompt-history)。
// 语义对齐 Codex 输入历史:最新在队尾,cursor=0 表示草稿,↑ 向更旧前进,↓ 向更新后退。

/** 历史栈上限:超限淘汰最旧一条(淘汰发生在写入路径 pushPromptEntry)。 */
export const PROMPT_HISTORY_LIMIT = 50

/** 历史翻页方向:prev=向上(更旧),next=向下(更新)。 */
export type PromptHistoryDirection = 'prev' | 'next'

/**
 * 追加一条已发送输入到历史栈(最新在队尾)。
 * - 空白文本不入栈(原数组原样返回);
 * - 与栈顶(最近一条)连续重复不入栈(Codex 语义),非连续相同可再次入栈;
 * - 超过 PROMPT_HISTORY_LIMIT 时淘汰最旧,保留最近 N 条。
 */
export function pushPromptEntry(entries: readonly string[], text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return [...entries]
  if (entries.length > 0 && entries[entries.length - 1] === trimmed) return [...entries]
  const next = [...entries, trimmed]
  return next.length > PROMPT_HISTORY_LIMIT ? next.slice(next.length - PROMPT_HISTORY_LIMIT) : next
}

/**
 * 移动历史游标。cursor=0 表示草稿,1..stackLength 依次指向最新→最旧。
 * prev 向上前进且在 stackLength 封顶;next 向下后退且在 0(草稿)封底。
 */
export function navigateCursor(
  cursor: number,
  direction: PromptHistoryDirection,
  stackLength: number,
): number {
  if (direction === 'prev') return Math.min(cursor + 1, Math.max(stackLength, 0))
  return Math.max(cursor - 1, 0)
}

/**
 * 解析当前游标对应的文本:cursor=0 返回草稿,否则取队尾倒数第 cursor 条
 * (cursor=1 → 最新,cursor=栈长 → 最旧)。
 */
export function resolveHistoryText(
  entries: readonly string[],
  cursor: number,
  draft: string,
): string {
  if (cursor <= 0 || cursor > entries.length) return draft
  return entries[entries.length - cursor] ?? draft
}

/** 从持久化 JSON 字符串读回历史栈:合法 JSON 数组只保留字符串项;损坏/非数组返回空数组。 */
export function parsePromptHistory(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}
