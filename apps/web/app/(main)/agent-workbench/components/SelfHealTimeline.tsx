// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ShieldCheck, Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { SelfHealEvent } from '@/hooks/use-agent-runtime'

/**
 * 自愈时间线(2-3 第四批 2026-09-12):
 * 呈现 agent_loop_v2._maybe_self_heal 经 /api/agents/tasks/stream 推送的
 * self-heal SSE 事件(started/finished 两 phase),让用户实时看到
 * 自愈引擎何时触发、跑了几轮、是否修复成功。
 */
interface Props {
  events: SelfHealEvent[]
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function HealItem({ evt, isLast }: { evt: SelfHealEvent; isLast: boolean }) {
  const t = useTranslations('agentWorkbench.selfHealTimeline')
  const finished = evt.phase === 'finished'
  const ok = evt.ok === true
  const cfg = finished
    ? ok
      ? { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-500' }
      : { icon: XCircle, color: 'text-destructive' }
    : { icon: Loader2, color: 'text-cyan-600 dark:text-cyan-400' }
  const Icon = cfg.icon
  return (
    <div className="relative pl-4">
      {!isLast && <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border" />}
      <span
        className={cn(
          'absolute left-0 top-3 h-1.5 w-1.5 rounded-sm bg-current',
          cfg.color,
          !finished && 'animate-pulse',
        )}
      />
      <div className="rounded-md border bg-background p-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color, !finished && 'animate-spin')} />
          <span className={cn('text-[10px] font-medium', cfg.color)}>
            {finished ? (ok ? t('resultOk') : t('resultFail')) : t('phaseStarted')}
          </span>
          {evt.iteration !== null && (
            <span className="shrink-0 rounded-sm border border-border/50 bg-muted/40 px-1 py-0.5 text-[9px] text-muted-foreground">
              {t('iterationLabel', { n: evt.iteration })}
            </span>
          )}
          <span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground">
            {timeFmt.format(new Date(evt.ts))}
          </span>
        </div>
        <Tooltip content={evt.command}>
          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {evt.command}
          </div>
        </Tooltip>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {evt.phase === 'started' && evt.failed !== null && evt.failed > 0 && (
            <span className="rounded-sm bg-red-500/10 px-1 py-0.5 text-red-600">
              {t('failedLabel', { count: evt.failed })}
            </span>
          )}
          {finished && evt.attempts !== null && (
            <span className="rounded-sm bg-muted/40 px-1 py-0.5">
              {t('attemptsLabel', { count: evt.attempts })}
            </span>
          )}
          {evt.rollbackCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/10 px-1 py-0.5 text-amber-600">
              <RotateCcw className="h-2.5 w-2.5" aria-hidden />
              {t('rollbacksLabel', { count: evt.rollbackCount })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function SelfHealTimeline({ events }: Props) {
  const t = useTranslations('agentWorkbench.selfHealTimeline')
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{t('title')}</span>
        <span className="text-xs text-muted-foreground">{events.length}</span>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="space-y-2">
          {events.map((evt, i) => (
            <HealItem key={evt.id} evt={evt} isLast={i === events.length - 1} />
          ))}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌‌‌​‌‍‍​‌‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌​‌‌‌​‌‌‌​‌‍‍‌‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌‌​​​‌‍‍​‌​​‌‌‌‌‍‍‌​‌​‌‌​‌‌​‍‍‌‌​​‌​‌‍‍​‌​​​‌‌‌​‍‍‌‌​​‌‌​‌​‌‍‍​‌​​‌‌‌​‍‍‌‌​‌​‌‌​‍‍‌‌​‌​‌​‌‍‍‌‌​​‌​‌‍‍‌‌​‌‌​‍‍‌‌​‌‌​​​‌‍‍‌‌​‌​​​‌‍‍‌​‌‌​​​‌‍‍​‌‌​‌‌‌‍‍‌‌​‌‌​‌​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​‌‌​‌‌​‍‍‌​‌​​‌‌‍‍​‌‌​​‌‌​‍‍‌‌​​​‌‌​‍‍‌‌​‌‌​‌‌‍‍‌‌​​‌​‌‍‍​‌​‌‌​‌‌‌​‌‌‌‍‍‌​‌‌​‌‍‍‌‌​​‌​‌‍‍‌‌​‌​‌​‌‍‍‌‌​‌​‌​‌‍‍‌​‌‌​‌​‌‍‍‌‌​‌‌​‌​‌‍‍‌​‌‌​‌‌​⁠
