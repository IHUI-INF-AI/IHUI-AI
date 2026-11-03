// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话内输入历史栈(纯逻辑,平台无关)。
 *
 * 行为对标 Codex prompt-history:
 * - 按会话分桶(由调用方决定 localStorage key,本模块只操作字符串数组)
 * - 每条用户发送文本入栈;与栈顶连续相同则视为重复,不入栈
 * - 上限 50 条,超出淘汰最旧(数组头部)
 * - 游标导航:cursor = 从「实时草稿」向后回退的步数(0 = 草稿,length = 最旧)
 *
 * 本模块不触碰 localStorage / DOM,纯函数便于单测与多端复用。
 * web 端接线见 apps/web/src/hooks/use-prompt-history.ts。
 */

export const PROMPT_HISTORY_LIMIT = 50

export type HistoryDirection = 'prev' | 'next'

/**
 * 入栈一条用户发送文本。
 * - 空文本(仅空白)不入栈
 * - 与栈顶连续相同则视为重复,不入栈
 * - 超过上限时淘汰最旧(数组头部),保留最近 PROMPT_HISTORY_LIMIT 条
 */
export function pushPromptEntry(entries: readonly string[], text: string): string[] {
  const value = text
  if (!value.trim()) return [...entries]
  const top = entries[entries.length - 1]
  if (top !== undefined && top === value) return [...entries]
  const next = [...entries, value]
  if (next.length > PROMPT_HISTORY_LIMIT) {
    return next.slice(next.length - PROMPT_HISTORY_LIMIT)
  }
  return next
}

/**
 * 游标前进 / 后退。
 * - prev(↑,更旧):cursor + 1,上限 = 栈长(指向最旧)
 * - next(↓,更新):cursor - 1,下限 = 0(指向草稿)
 */
export function navigateCursor(cursor: number, dir: HistoryDirection, length: number): number {
  const max = Math.max(0, length)
  if (dir === 'prev') return Math.min(cursor + 1, max)
  return Math.max(cursor - 1, 0)
}

/**
 * 解析某游标对应的展示文本。
 * - cursor <= 0:返回草稿(draft)
 * - 否则返回 entries[length - cursor](cursor=1 → 最新,cursor=length → 最旧)
 */
export function resolveHistoryText(
  entries: readonly string[],
  cursor: number,
  draft: string,
): string {
  if (cursor <= 0) return draft
  const idx = entries.length - cursor
  if (idx < 0) return entries[0] ?? draft
  return entries[idx] ?? draft
}

/** 安全解析 localStorage 中的历史 JSON(损坏 / 缺失 / 非字符串数组均返回空数组)。 */
export function parsePromptHistory(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
    return []
  } catch {
    return []
  }
}
