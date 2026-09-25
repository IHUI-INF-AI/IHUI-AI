// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CircleCheck, Loader2, ShieldBan, TriangleAlert, Webhook } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAgentHooksStore } from '@/stores/agent-hooks'
import { countFailedHookEvents, deriveHookSummary, type HookSummaryState } from './hook-summary'

/**
 * HookSummaryCard —— D86(G-117)钩子摘要卡。
 *
 * 折叠进 TaskStatusBar(活动条)展开区,空闲态返回 null,不抢主流程。
 * 视图推导全部走纯函数 `deriveHookSummary`(./hook-summary),本文件只渲染:
 *  - 五态:running / blocked / failed / ok 上屏,idle 不渲染
 *  - 计数:· 运行了 N 次(+ 失败 / 拦截 >0 时)
 *  - 来源归属枚举行:数据面未提供 sources 时不出现(不伪造)
 */

const STATE_GLYPH: Record<
  Exclude<HookSummaryState, 'idle'>,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  running: { icon: Loader2, cls: 'text-primary animate-spin' },
  blocked: { icon: ShieldBan, cls: 'text-red-600 dark:text-red-400' },
  failed: { icon: TriangleAlert, cls: 'text-amber-600 dark:text-amber-400' },
  ok: { icon: CircleCheck, cls: 'text-emerald-600 dark:text-emerald-400' },
}

export function HookSummaryCard({ running = false }: { running?: boolean }) {
  const t = useTranslations('ai.pane')
  const events = useAgentHooksStore((s) => s.events)

  const failed = React.useMemo(() => countFailedHookEvents(events), [events])
  // 数据面未接线:ai-service hook_runtime 的 denial_reason 尚无客户端通道,显式传 0,不伪造
  const view = React.useMemo(
    () => deriveHookSummary({ runs: events.length, failed, blocked: 0, running, sources: null }),
    [events.length, failed, running],
  )

  if (view.state === 'idle') return null

  const { icon: Glyph, cls: glyphCls } = STATE_GLYPH[view.state]
  const stateLabel = t(`hookSummary.state.${view.state}`)

  return (
    <div
      data-testid="hook-summary-card"
      data-state={view.state}
      aria-label={t('hookSummary.ariaLabel')}
      className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5"
    >
      <Glyph className={cn('h-3.5 w-3.5 shrink-0', glyphCls)} aria-hidden />
      <span className="shrink-0 text-xs font-medium text-foreground">{stateLabel}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {t('hookSummary.runs', { n: view.runs })}
      </span>
      {view.failed > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-amber-600 dark:text-amber-400">
          {t('hookSummary.failedCount', { n: view.failed })}
        </span>
      ) : null}
      {view.blocked > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-red-600 dark:text-red-400">
          {t('hookSummary.blockedCount', { n: view.blocked })}
        </span>
      ) : null}
      {view.hasSourceData ? (
        <span className="ml-auto flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
          <Webhook className="h-3 w-3 shrink-0" aria-hidden />
          <span className="shrink-0">{t('hookSummary.sourceLabel')}</span>
          <span className="min-w-0 truncate">
            {view.sources.map((s) => t(`hookSummary.source.${s}`)).join(' · ')}
          </span>
        </span>
      ) : null}
    </div>
  )
}

export default HookSummaryCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
