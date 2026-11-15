// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 逐轮轨迹统计表(2026-11-13 立)
 *
 * 与 `AgentTraceViewer` 的关系是**两层视图**,不是替代:
 *  - AgentTraceViewer:一次回答内部的迭代 / 工具展开(纵向);
 *  - 本表:整个会话每一轮的模型 / 用时 / token / 工具数(横向汇总)。
 *
 * 数据全部来自本地消息,不发额外请求;行由 `lib/turn-trace` 纯函数算出,组件只负责画。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buildTurnTraceRows, type TurnTraceMessageLike } from '@/lib/turn-trace'

export interface TurnTraceTableProps {
  messages: readonly TurnTraceMessageLike[]
  className?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function TurnTraceTable({ messages, className }: TurnTraceTableProps) {
  const t = useTranslations('ai.pane')
  const summary = React.useMemo(() => buildTurnTraceRows(messages), [messages])
  if (summary.rows.length === 0) return null

  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-stroke-subtle', className)}
      data-testid="turn-trace-table"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-stroke-default bg-muted/30 px-3 py-2">
        <span className="text-label font-medium">{t('traceTurnTable')}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {t('traceTurnTotal', {
            count: summary.totals.turns,
            tokens: formatNumber(summary.totals.usage.totalTokens),
          })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">{t('traceTurn')}</th>
              <th className="px-2 py-1.5 font-medium">{t('traceModel')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('traceDuration')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('traceTokens')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('traceTools')}</th>
              <th className="px-3 py-1.5 font-medium">{t('traceStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr
                key={`${row.ordinal}-${row.label}`}
                className="border-t border-stroke-default align-top"
                data-testid={`turn-trace-row-${row.ordinal}`}
              >
                <td className="px-3 py-1.5">
                  <div className="tabular-nums text-foreground/80">#{row.ordinal}</div>
                  {row.label ? (
                    <div className="max-w-[160px] truncate text-muted-foreground" title={row.label}>
                      {row.label}
                    </div>
                  ) : null}
                </td>
                <td className="max-w-[140px] truncate px-2 py-1.5" title={row.model ?? ''}>
                  {row.model ?? '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {row.durationMs > 0 ? formatDuration(row.durationMs) : '—'}
                </td>
                <td
                  className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
                  title={`${t('tracePromptTokens')} / ${t('traceCompletionTokens')}`}
                >
                  {row.usage.totalTokens > 0
                    ? `${formatNumber(row.usage.promptTokens)} / ${formatNumber(row.usage.completionTokens)}`
                    : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {row.toolCalls > 0 ? row.toolCalls : '—'}
                </td>
                <td className="px-3 py-1.5">
                  {row.status === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" aria-hidden />
                      {t('traceStatusError')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      {t('traceStatusOk')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TurnTraceTable
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
