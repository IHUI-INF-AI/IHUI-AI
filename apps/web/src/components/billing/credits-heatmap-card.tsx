// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D64 ① Credits 热力图业务卡(G-72/79 族,2026-09-24 立)。
//
// **数据面纪律(同 D59「不得用假数据占位」)**:自证结论 —— web 侧 credits 数据面
// 只有 `lib/models-api.ts` 的模型类目 `category:'credits'`,**没有按日消耗时序**
// (stores / api 路由零命中)。本卡**不取数**:dayCounts / sessionCounts 全部由
// 调用方注入(props);**无数据一律返回 null**,不渲染空壳、不编造样例。
// 桶级四档判定一律走 `@ihui/shared/chat/element-pack`,端内不另建第二套分桶。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  dayDetailView,
  heatmapBucket,
  heatmapBucketTone,
  heatmapLegendKey,
  HEATMAP_BUCKETS,
  HEATMAP_VIEW_MODES,
  type HeatmapThresholds,
  type HeatmapViewMode,
} from '@ihui/shared/chat/element-pack'

/** 语义色档 → 样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_CLASS: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/25 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/30 text-red-700 dark:text-red-400',
}

export interface CreditsHeatmapCardProps {
  /** 按日消耗映射(dateKey → 次数);缺省/空 ⇒ 本卡不渲染任何内容(无数据不占位) */
  dayCounts?: Record<string, number>
  /** 会话明细映射(会话标识 → 次数);会话视图的数据面,缺省渲染显式空态 */
  sessionCounts?: Record<string, number>
  /** 分桶阈值(可配,传给判定层;缺省 { mid: 5, high: 20 }) */
  thresholds?: HeatmapThresholds
  className?: string
  'data-testid'?: string
}

export function CreditsHeatmapCard({
  dayCounts,
  sessionCounts,
  thresholds,
  className,
  'data-testid': testId,
}: CreditsHeatmapCardProps) {
  const t = useTranslations('ai.pane.elementPack.heatmap')

  const dayEntries = React.useMemo(
    () =>
      Object.entries(dayCounts ?? {}).filter(
        ([key, count]) => key.trim() !== '' && Number.isFinite(count),
      ),
    [dayCounts],
  )

  // 视图模式切换判据:两模式都在 HEATMAP_VIEW_MODES 内,状态只取该联合
  const [mode, setMode] = React.useState<HeatmapViewMode>('heatmap')
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null)

  // 无数据不占位:连会话明细也没有时整卡不渲染(空态只在「有日数据、切到会话视图」时出现)
  // 注意:必须在上面两个 useState **之后** —— 提前 return 会把 hook 次序打乱(条件 hook)
  if (dayEntries.length === 0) return null

  const detail = selectedDay
    ? dayDetailView(selectedDay, dayCounts?.[selectedDay] ?? 0, thresholds)
    : null

  const sessionEntries = Object.entries(sessionCounts ?? {}).filter(
    ([key, count]) => key.trim() !== '' && Number.isFinite(count),
  )

  return (
    <div
      role="group"
      aria-label={t('title')}
      className={cn('flex flex-col gap-2 rounded-md border p-3', className)}
      data-testid={testId}
      data-heatmap-mode={mode}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
        <div className="ml-auto flex gap-1" role="tablist" aria-label={t('title')}>
          {HEATMAP_VIEW_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              data-heatmap-tab={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-sm px-1.5 py-0.5 text-[11px] transition-colors',
                mode === m ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t(m === 'heatmap' ? 'tab.heatmap' : 'tab.sessions')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'heatmap' ? (
        <>
          <div className="flex flex-wrap gap-1" data-testid="credits-heatmap-grid">
            {dayEntries.map(([key, count]) => {
              const bucket = heatmapBucket(count, thresholds)
              return (
                <button
                  key={key}
                  type="button"
                  data-heatmap-day={key}
                  data-heatmap-bucket={bucket}
                  // §4 禁用原生提示窗:不得用 title,读屏走 aria-label
                  aria-label={t('dayTitle', { date: key })}
                  onClick={() => setSelectedDay((prev) => (prev === key ? null : key))}
                  className={cn(
                    'h-6 min-w-6 rounded-sm px-1 text-[10px] tabular-nums transition-colors hover:opacity-75',
                    TONE_CLASS[heatmapBucketTone(bucket)],
                  )}
                >
                  {count}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{t('legendLabel')}</span>
            {HEATMAP_BUCKETS.map((bucket) => (
              <span
                key={bucket}
                data-heatmap-legend={bucket}
                className={cn('rounded-sm px-1.5 py-0.5', TONE_CLASS[heatmapBucketTone(bucket)])}
              >
                {t(heatmapLegendKey(bucket))}
              </span>
            ))}
          </div>
          {detail ? (
            <div
              className="rounded-sm bg-muted/40 px-2 py-1.5 text-[11px]"
              data-day-detail={detail.dateKey}
              data-day-bucket={detail.bucket}
            >
              {t(detail.titleKey, detail.values)} · {detail.count}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-1" data-testid="credits-session-list">
          {sessionEntries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground" data-session-empty>
              {t('sessionsEmpty')}
            </p>
          ) : (
            sessionEntries.map(([key, count]) => (
              <div
                key={key}
                data-session-row={key}
                className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1 text-[11px]"
              >
                <span className="min-w-0 truncate">{key}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
