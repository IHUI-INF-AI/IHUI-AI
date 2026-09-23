// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D105 PR 检查状态与动作卡(G-146) —— 对话流内渲染件。
//
// **数据面纪律(台账 D105 明文)**:本卡**不取数**。`checks` 由调用方从既有 PR 通道
// (`ide-workspace` 的 `pullRequest.checks`,数据源仍是既有 `review_pr_github` / PR API)传入;
// 状态判定一律走 `@ihui/shared/chat` 的 `deriveChecksSummary` / `countChecksByState`
// —— 与 extension / miniapp-taro / mobile-rn / cli **同源**,不得各建一套判定。
//
// 六态含 `neutral` 与 `unknown` 两个极易漏掉的态(「看着没事其实没结论」的典型):
// 前者不阻塞成功,后者归 pending(状态未知时**不得宣称成功**)。
//
// 动作族四键沿用 Codex 一手形状:`checksFix` / `checksRemove` / `commentsAddress` / `commentsRemove`。
// 其中「修复」只在**确有失败**时提供(`shouldOfferFix`)—— 无失败还给「修复」入口是对用户撒谎。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import {
  countChecksByState,
  deriveChecksSummary,
  shouldOfferFix,
  type CiChecksSummary,
  type CiCheckState,
  type CiCheck,
  type PrCheckAction,
} from '@ihui/shared/chat'

/** 聚合态配色(涨跌语义不适用;按"通过/待定/失败"语义着色) */
const SUMMARY_TONE: Record<CiChecksSummary, string> = {
  failing: 'text-destructive',
  pending: 'text-amber-600 dark:text-amber-500',
  successful: 'text-emerald-600 dark:text-emerald-500',
  none: 'text-muted-foreground',
}

/** 六态字形(纯符号,避免额外图标依赖;tooltip 出文案) */
const STATE_GLYPH: Record<CiCheckState, string> = {
  failed: '✕',
  passed: '✓',
  pending: '◌',
  skipped: '⊘',
  neutral: '○',
  unknown: '?',
}

export interface PrChecksCardProps {
  /** CI 检查明细(来自既有 PR 通道);缺省或空数组 ⇒ 渲染空态「无 CI 检查」 */
  checks?: readonly CiCheck[]
  /** 后端已给的聚合态;缺省时本地用 `deriveChecksSummary(checks)` 归并(两端口径同源) */
  summary?: CiChecksSummary
  /** 动作族回调。**数据面在调用方**,本卡只负责触发;不传则不渲染动作行 */
  onAction?: (action: PrCheckAction) => void
  className?: string
  'data-testid'?: string
}

export function PrChecksCard({
  checks,
  summary,
  onAction,
  className,
  'data-testid': testId,
}: PrChecksCardProps) {
  const t = useTranslations('ai.pane.prChecks')

  const list = checks ?? []
  const resolved = summary ?? deriveChecksSummary(list)
  const counts = countChecksByState(list)

  // 键一律写成**静态字面量**(next-intl 类型检查可过),只此一处映射;
  // 键名与 @ihui/shared/chat 的 ciCheckStateKey / checksSummaryKey / prCheckActionKey 保持一致。
  const summaryLabel: Record<CiChecksSummary, string> = {
    failing: t('summary.failing'),
    pending: t('summary.pending'),
    successful: t('summary.successful'),
    none: t('summary.none'),
  }
  const stateLabel: Record<CiCheckState, string> = {
    failed: t('state.failed'),
    passed: t('state.passed'),
    pending: t('state.pending'),
    skipped: t('state.skipped'),
    neutral: t('state.neutral'),
    unknown: t('state.unknown'),
  }
  const actionLabel: Record<PrCheckAction, string> = {
    checksFix: t('action.checksFix'),
    checksRemove: t('action.checksRemove'),
    commentsAddress: t('action.commentsAddress'),
    commentsRemove: t('action.commentsRemove'),
  }

  // 有失败 → 给「修复 / 移除」;无失败 → 给「评论入对话 / 移除」。
  const visibleActions: readonly PrCheckAction[] = shouldOfferFix(resolved)
    ? (['checksFix', 'checksRemove'] as const)
    : (['commentsAddress', 'commentsRemove'] as const)

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-checks-summary={resolved}
    >
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-medium', SUMMARY_TONE[resolved])} data-testid="pr-checks-summary">
          {summaryLabel[resolved]}
        </span>
        {list.length > 0 ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t('countLabel', { passed: counts.passed, total: list.length })}
          </span>
        ) : null}
      </div>

      {list.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {list.map((check) => (
            <li key={check.name} className="flex items-center gap-1.5 text-[11px]">
              <Tooltip content={stateLabel[check.state]}>
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted/50 text-[10px] leading-none"
                  aria-label={stateLabel[check.state]}
                  data-check-state={check.state}
                >
                  {STATE_GLYPH[check.state]}
                </span>
              </Tooltip>
              <span className="truncate text-muted-foreground">{check.name}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {onAction ? (
        <div className="flex flex-wrap items-center gap-1">
          {visibleActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              data-action={action}
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {actionLabel[action]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
