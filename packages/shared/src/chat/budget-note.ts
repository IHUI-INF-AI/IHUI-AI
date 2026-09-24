// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `budget` 帧(额度分档告警)的**跨端措辞装配**(AGENTS §3 共享层优先,D106/D107)。
 *
 * 为什么在共享层而不是各端各写一份:网关只发一份载荷,而"已用多少 / 何时重置 / 哪一档"
 * 这三段的**取舍规则**必须五端一致 —— 逐端实现已经出现过一次漂移(web 无条件播报
 * "明日 0 点重置",而 `resetAt` 是可选字段;还把 85300 印成「8.5 万」,该单位在
 * en/ja/ko 都不成立)。规则收在这里,端内只提供取词函数与本端键名。
 *
 * 载荷形状与 `@ihui/api-client` 的 `BudgetEvent` 一致;此处刻意用**结构性输入类型**
 * 而不是 import 它,好让 `packages/shared` 的呈现层不被上游类型牵着走
 * (字段只多不少时本函数不受影响)。
 */
import type { BudgetEvent } from '@ihui/api-client'
// 复用既有共享格式化(K/M 单位,ASCII、五语言通用),不在此另立一份 token 计数实现。
// 注:web 端 budget toast 用的是「8.5 万」中文缩写 —— 那是本函数刻意不复制的写法。
import { formatTokenCount } from '../utils/format'

/** 装配一行所需的措辞槽位(各端命名空间不同,由调用方给全六个键) */
export interface BudgetNoteKeys {
  /** "{title}:{detail}" —— 只在确有 detail 时使用 */
  note: string
  warningTitle: string
  criticalTitle: string
  /** "已用 {used} / {limit} tokens" */
  usedTokens: string
  /** 仅在载荷带 resetAt 时取用 */
  resetTomorrow: string
  /** "{tier} 档" —— 仅在载荷带 tier 时取用 */
  tier: string
}

export type BudgetNoteTranslate = (key: string, params?: Record<string, string | number>) => string

/** 段间分隔符:语言中立的中点,不写进任何译文(写进译文就无法复用它拼多段) */
export const BUDGET_DETAIL_SEPARATOR = ' · '

/**
 * 产出一行额度交代。
 * 三条硬规则(每条各有一枚反向用例钉住):
 *  ① 载荷没给的字段**不说**:缺 `resetAt` 就不提重置时间,缺 tokens 就不提 tokens;
 *  ② 全字段皆缺(只有 `level`)时只出标题,不留 "标题:" 这种悬空尾巴;
 *  ③ `level` 只有 `critical` 才升级措辞,其余按 warning 出(未知档位不得静默不出行)。
 */
export function formatBudgetNote(
  event: BudgetEvent,
  t: BudgetNoteTranslate,
  keys: BudgetNoteKeys,
): string {
  const parts: string[] = []
  if (typeof event.usedTokens === 'number' && typeof event.limitTokens === 'number') {
    parts.push(
      t(keys.usedTokens, {
        used: formatTokenCount(event.usedTokens),
        limit: formatTokenCount(event.limitTokens),
      }),
    )
  }
  if (typeof event.percent === 'number') parts.push(`${event.percent}%`)
  if (event.resetAt) parts.push(t(keys.resetTomorrow))
  if (event.tier) parts.push(t(keys.tier, { tier: event.tier }))

  const title = event.level === 'critical' ? t(keys.criticalTitle) : t(keys.warningTitle)
  const detail = parts.join(BUDGET_DETAIL_SEPARATOR)
  return detail ? t(keys.note, { title, detail }) : title
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
