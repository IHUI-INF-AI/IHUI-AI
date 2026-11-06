// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 七类上下文账本在 RN 端的纯派生出口(批次 3,2026-11-06)。
 *
 * 口径与 `packages/shared/src/sse/contract.ts` 的 `ContextLedger` 对齐:
 *  - 七类顺序**固定**,渲染端不得自行排序;乱序的入参在这里按契约顺序重排,
 *    缺类/重类一律返回 null(不拿 0 冒充"确实未占用",否则账本恒等式会被假数据凑平)。
 *  - `usedTokens` = 前五类之和;`usedTokens + free_space + auto_compact = contextLimit`。
 *    两条恒等式供用例对账,UI 只展示服务端下发的 percentage,不在端内重算百分比。
 */
import type { ContextLedger, ContextLedgerCategory, ContextLedgerCategoryUsage } from '@ihui/shared'

/**
 * 七类固定顺序。
 *
 * 本端不 import shared 的 `CONTEXT_LEDGER_CATEGORIES`,是因为 shared 未导出
 * `./sse/*` 子路径,从根入口取会在 RN 测试替身里落空;顺序由用例直连契约源码逐项对账
 * (`tests/chat-ledger-batch3.test.ts`),漂移会被钉红。
 */
export const CONTEXT_LEDGER_ORDER = [
  'system_prompt',
  'system_tools',
  'skills',
  'messages',
  'other',
  'free_space',
  'auto_compact',
] as const satisfies readonly ContextLedgerCategory[]

export interface OrderedContextLedgerRow {
  category: ContextLedgerCategory
  tokens: number
  percent: number
}

/**
 * 按固定顺序重排七类;入参必须恰好七类、名字唯一且都在闭集内,否则返回 null。
 * null 的语义是"这份账本不可展示",调用方应回退到既有本地估算,而不是渲染半张表。
 */
export function orderContextLedgerCategories(
  categories: readonly ContextLedgerCategoryUsage[],
): OrderedContextLedgerRow[] | null {
  if (categories.length !== CONTEXT_LEDGER_ORDER.length) return null
  const byCategory = new Map<ContextLedgerCategory, ContextLedgerCategoryUsage>()
  for (const entry of categories) {
    if (byCategory.has(entry.category)) return null
    byCategory.set(entry.category, entry)
  }
  const rows: OrderedContextLedgerRow[] = []
  for (const category of CONTEXT_LEDGER_ORDER) {
    const entry = byCategory.get(category)
    if (!entry) return null
    rows.push({ category, tokens: entry.tokens, percent: entry.percent })
  }
  return rows
}

export interface ContextLedgerIdentity {
  /** 前五类之和(契约口径的"已用") */
  usedTokensFromCategories: number
  /** 已用 + free_space + auto_compact */
  accountedTokens: number
  /** usedTokens 字段与前五类之和一致 */
  usedMatches: boolean
  /** 七类总和与 contextLimit 一致 */
  balanceMatches: boolean
}

/** 账本两条恒等式的对账结果;七类不齐全时返回 null(不拿半张表凑恒等式)。 */
export function contextLedgerIdentity(ledger: ContextLedger): ContextLedgerIdentity | null {
  const rows = orderContextLedgerCategories(ledger.categories)
  if (!rows) return null
  const usedTokensFromCategories = rows.slice(0, 5).reduce((sum, row) => sum + row.tokens, 0)
  const freeSpaceTokens = rows.find((row) => row.category === 'free_space')?.tokens ?? 0
  const autoCompactTokens = rows.find((row) => row.category === 'auto_compact')?.tokens ?? 0
  const accountedTokens = usedTokensFromCategories + freeSpaceTokens + autoCompactTokens
  return {
    usedTokensFromCategories,
    accountedTokens,
    usedMatches: ledger.usedTokens === usedTokensFromCategories,
    balanceMatches: ledger.contextLimit === accountedTokens,
  }
}

/** 七类中文标签(仅本端渲染用;契约里只有英文闭集,不引入第二套词表出口)。 */
export const CONTEXT_LEDGER_LABELS: Record<ContextLedgerCategory, string> = {
  system_prompt: '系统提示词',
  system_tools: '系统工具',
  skills: '技能',
  messages: '消息',
  other: '其他',
  free_space: '空闲空间',
  auto_compact: '自动压缩预留',
}

/** 计量口径的中文说明:上游计量与本地估算必须区分,不把估算读成精确值。 */
export function contextLedgerTokenizerLabel(tokenizer: ContextLedger['tokenizer']): string {
  return tokenizer === 'provider_usage' ? '上游计量' : '本地估算'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
