// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2, Package } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/date-utils'
import { Tooltip } from '@/components/feedback'
import { CitationBar } from '@/components/ai/progress-sections/citation-bar'
import { TruncatedText } from '@/components/common/TruncatedText'
import type { DeliverableFileChange, TaskDeliverables } from '@/types/agent-delivery'

/**
 * DeliveryReviewPanel — D27(2026-09-20 立)交付审查视图核心面板。
 *
 * 职责:渲染 TaskDeliverables 的三段式审查内容 —
 *   1. 总结区:outputSummary 全文 + toolsSummary 调用量 top5 徽章;
 *   2. 溯源引用:CitationBar 复用(结构兼容 DeliverableCitation);
 *   3. 文件变更区:kind 徽章色(add=emerald/delete=rose/update=amber)
 *      + 路径 + +n/-n 统计 + stepIds 悬浮提示。
 * 供 TaskDetailDialog(交付清单 tab)与 agent-task-progress-pane(实时交付卡)复用。
 * deliverables 为 null 时按 loading 展示加载态或空态,不抛错。
 */

interface DeliveryReviewPanelProps {
  /** 交付清单数据(null = 无数据,展示空态/加载态) */
  deliverables: TaskDeliverables | null
  /** 无数据且 loading=true 时展示"生成中"加载态(端点拉取中) */
  loading?: boolean
}

/** 文件变更 kind → 徽章配色(D27 钉死:add=emerald/delete=rose/update=amber) */
export const FILE_KIND_BADGE_CLS: Record<DeliverableFileChange['kind'], string> = {
  add: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  delete: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  update: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
}

/** toolsSummary.byTool → 调用量降序 top5 条目 */
function top5Tools(byTool: Record<string, number>): Array<[string, number]> {
  return Object.entries(byTool)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
}

/**
 * DeliveryFileChangeList — 文件变更行列表(导出复用)。
 * TaskDetailDialog 的"代码变更"tab 跨会话回溯合并后复用同一渲染,保证视觉一致。
 */
export function DeliveryFileChangeList({ files }: { files: DeliverableFileChange[] }) {
  const t = useTranslations('deliveryReview')
  return (
    <div className="space-y-0.5">
      {files.map((f, i) => (
        <div
          key={`${f.kind}-${f.path}-${i}`}
          className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs transition-colors hover:bg-accent/40"
          data-testid={`delivery-review-file-${i}`}
        >
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 py-px text-[9px] font-medium uppercase',
              FILE_KIND_BADGE_CLS[f.kind],
            )}
            data-testid={`delivery-review-kind-${i}`}
          >
            {f.kind === 'add'
              ? t('kindAdd')
              : f.kind === 'delete'
                ? t('kindDelete')
                : t('kindUpdate')}
          </span>
          {/* §4 禁原生 title:截断全文改走 TruncatedText(只在真截断时挂项目 Tooltip,
              比原生 title 少一层"没截断也弹"的噪音) */}
          <TruncatedText value={f.path} className="min-w-0 flex-1 text-[11px]" mono />
          {f.stepIds.length > 0 && (
            <Tooltip
              content={
                <span className="font-mono">
                  {t('stepsTooltip')}: {f.stepIds.join(', ')}
                </span>
              }
            >
              <span
                className="shrink-0 rounded-sm border border-border/60 px-1 py-px text-[9px] text-muted-foreground cursor-default"
                data-testid={`delivery-review-steps-${i}`}
              >
                S{f.stepIds.length}
              </span>
            </Tooltip>
          )}
          <span className="shrink-0 tabular-nums text-[10px] text-emerald-600 dark:text-emerald-400">
            +{f.additions}
          </span>
          <span className="shrink-0 tabular-nums text-[10px] text-rose-600 dark:text-rose-400">
            -{f.deletions}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DeliveryReviewPanel({ deliverables, loading = false }: DeliveryReviewPanelProps) {
  const t = useTranslations('deliveryReview')
  const locale = useLocale()

  // 空态分支:null + loading → 加载态;null + !loading → 空数据提示(不渲染主体,不出空 DOM)
  if (deliverables === null) {
    if (loading) {
      return (
        <div
          className="flex items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground"
          data-testid="delivery-review-loading"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>{t('loading')}</span>
        </div>
      )
    }
    return (
      <div
        className="flex items-center justify-center py-6 text-xs text-muted-foreground"
        data-testid="delivery-review-empty"
      >
        {t('empty')}
      </div>
    )
  }

  const toolBadges = top5Tools(deliverables.toolsSummary.byTool)
  const generatedAtLabel = formatRelativeTime(deliverables.generatedAt, locale)

  return (
    <div className="space-y-2.5 text-sm" data-testid="delivery-review-panel">
      {/* 1. 总结区:输出摘要全文 + 工具调用量 top5 徽章 */}
      <div className="rounded-md bg-muted/50 p-2.5" data-testid="delivery-review-summary">
        <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground/80">
          <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('summary')}</span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
          {deliverables.outputSummary}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70">{t('toolsSummary')}</span>
          {toolBadges.map(([tool, count]) => (
            <span
              key={tool}
              className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              data-testid={`delivery-review-tool-${tool}`}
            >
              {tool}
              <span className="tabular-nums opacity-70">×{count}</span>
            </span>
          ))}
          <span className="tabular-nums text-[10px] text-muted-foreground/70">
            Σ{deliverables.toolsSummary.total}
          </span>
        </div>
      </div>

      {/* 2. 溯源引用:CitationBar 复用(DeliverableCitation 与 CitationEntry 结构一致) */}
      {deliverables.citations.length > 0 && <CitationBar citations={deliverables.citations} />}

      {/* 3. 文件变更区:kind 徽章 + 路径 + 增删统计 + 涉及步骤提示 */}
      <div data-testid="delivery-review-files">
        <div className="mb-1 text-xs font-medium text-muted-foreground/80">
          {t('filesChanged')}
          <span className="ml-1 tabular-nums text-[10px] opacity-70">
            ({deliverables.filesChanged.length})
          </span>
        </div>
        {deliverables.filesChanged.length === 0 ? (
          <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
            {t('filesEmpty')}
          </div>
        ) : (
          <DeliveryFileChangeList files={deliverables.filesChanged} />
        )}
      </div>

      {/* 4. 生成时间(相对时间) */}
      <div
        className="text-right text-[10px] text-muted-foreground/70"
        data-testid="delivery-review-generated-at"
      >
        {t('generatedAt', { time: generatedAtLabel })}
      </div>
    </div>
  )
}

export default DeliveryReviewPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
