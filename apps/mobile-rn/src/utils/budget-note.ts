// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * budget 额度分档告警在 RN 端的一行措辞。
 *
 * 装配规则(哪些字段缺就不说 / 分隔符 / token 计数)在 `@ihui/shared/chat` 的
 * `formatBudgetNote`,本文件只贴本端键名(AGENTS §3 共享层优先:两屏共用一份,
 * 不在 ChatScreen 与 AiAssistantN8nScreen 各抄一遍)。
 *
 * 键挂在 `common.*`:RN 两个聊天面(`ChatScreen` 主聊天 / `AiAssistantN8nScreen` 助手)
 * 都要用同一句话,而本端取词是全包扁平命名空间 —— 挂任一屏的命名空间都会逼另一屏跨引。
 */
import type { BudgetEvent } from '@ihui/api-client'
import { formatBudgetNote, type BudgetNoteKeys } from '@ihui/shared/chat'
// 批次 3:硬停止原因码文案的唯一出口在 shared(三端同源),本端只转发,不再抄第二份六值映射。
import { budgetStopReasonText } from '@ihui/shared/chat/budget-stop-note'

export {
  BUDGET_STOP_FALLBACK_TEXT,
  budgetStopReasonText,
  budgetStopReasonTexts,
} from '@ihui/shared/chat/budget-stop-note'

/** 导出给用例:词包与键表必须成对存在(缺键会回显键名,即 D111/守门 56 那一类静默失效) */
export const RN_BUDGET_NOTE_KEYS: BudgetNoteKeys = {
  note: 'common.budgetNote',
  warningTitle: 'common.budgetWarningTitle',
  criticalTitle: 'common.budgetCriticalTitle',
  usedTokens: 'common.budgetUsedTokens',
  resetTomorrow: 'common.budgetResetTomorrow',
  tier: 'common.budgetTier',
}

export function budgetNoteText(
  event: BudgetEvent,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  // 硬停止不是"额度告警"的一个更高级:它有独立原因码文案,不能落进 warning/critical 的标题。
  if (event.level === 'stopped') return budgetStopReasonText(event.reasonCode)
  return formatBudgetNote(event, t, RN_BUDGET_NOTE_KEYS)
}

/**
 * 预算档位的终态合并。
 *
 * `stopped` 是硬停止终态:本轮流已被护栏主动结束,后到的 warning/critical(重放帧、
 * 重连帧、预算余额回升后的下一次告警)都不得把它覆盖回"可继续"的档位。
 * 纯函数放在这里,屏幕只做 `setState`,不把判据散落进各回调。
 */
export function nextBudgetLevel(
  previous: BudgetEvent['level'] | null,
  incoming: BudgetEvent['level'],
): BudgetEvent['level'] {
  return previous === 'stopped' ? 'stopped' : incoming
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
