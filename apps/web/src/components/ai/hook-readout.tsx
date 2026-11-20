// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { HookRunStats } from '@/hooks/hook-run-stats'
import { hookRunStatsAverageMs } from '@/hooks/hook-run-stats'
import type { HookAuditStats } from '@/hooks/use-hook-audit-summary'

/** next-intl 的 t 在组件内的最小投影(只用到"键 + 变量"这一档)。 */
export type HookReadoutTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string

interface HookReadoutProps {
  /** 会话内存累计(第 38 项);`total>0` 时优先显示 */
  sessionStats: HookRunStats
  /** 落盘台账摘要(第 41 项);只在会话累计为空(刷新/重连)时回落 */
  auditStats: HookAuditStats | null
  /**
   * 2026-11-21 第 43 项:把"该显示哪一条"收进组件 —— 两条同时出现会让人以为跑了两次。
   * 判断规则只有这里一份(此前写在 800 行面板的 JSX 表达式里,单测够不着)。
   */
  t: HookReadoutTranslate
}

function statsBody(t: HookReadoutTranslate, stats: HookRunStats): string {
  return t('runtimeHookStats', {
    total: stats.total,
    ok: stats.ok,
    timeout: stats.timeout,
    error: stats.error,
    avg: hookRunStatsAverageMs(stats),
    slowest: stats.slowestMs,
  })
}

export function HookReadout({ sessionStats, auditStats, t }: HookReadoutProps) {
  if (sessionStats.total > 0) {
    return (
      <div
        className="mx-2 mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground"
        data-testid="pane-runtime-hook-stats"
      >
        <span className="shrink-0 font-medium">{t('runtimeHookStatsTitle')}</span>
        <span className="font-mono tabular-nums">{statsBody(t, sessionStats)}</span>
      </div>
    )
  }
  if (auditStats && auditStats.total > 0) {
    return (
      <div
        className="mx-2 mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground"
        data-testid="pane-runtime-hook-audit"
      >
        <span className="shrink-0 font-medium">{t('runtimeHookAuditTitle')}</span>
        <span className="font-mono tabular-nums">{statsBody(t, auditStats)}</span>
        {/*
          2026-11-21 第 44 项:台账只读尾部时必须显式标注 —— 否则「两万行之前的历史」
          会被读成「没跑过」。只在截断时出现,不复述 total/linesRead 的算术。
        */}
        {auditStats.truncated ? (
          <span className="shrink-0" data-testid="pane-runtime-hook-audit-truncated">
            {t('runtimeHookAuditTruncated', { lines: auditStats.linesRead })}
          </span>
        ) : null}
      </div>
    )
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
