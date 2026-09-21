// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import type { ResearchReportDto } from '@ihui/api-client'

// 阶段顺序(与后端 phase 对应)
const PHASES = ['planning', 'retrieving', 'deepening', 'synthesizing', 'done', 'error'] as const

export interface RunStatusPanelProps {
  state: ResearchReportDto
  /** 当前会话/回看的 research_id(快照缺 research_id 时兜底展示) */
  activeId: string | null
}

/** 研究状态面板(2026-09-07 工作线 B 自 page.tsx 抽出):Research ID / 状态 / 当前阶段 / 阶段条 */
export function RunStatusPanel({ state, activeId }: RunStatusPanelProps) {
  const t = useTranslations('deepResearch')
  const PHASE_LABEL: Record<string, string> = {
    planning: t('phasePlanning'),
    retrieving: t('phaseRetrieving'),
    deepening: t('phaseDeepening'),
    synthesizing: t('phaseSynthesizing'),
    done: t('phaseDone'),
    error: t('phaseError'),
  }
  const statusText =
    state.status === 'error'
      ? t('statusError')
      : state.running
        ? t('statusRunning')
        : state.finished
          ? t('statusFinished')
          : t('statusIdle')
  const currentPhase = React.useMemo(() => {
    if (!state.stages?.length) return null
    for (const p of PHASES) {
      if (state.stages.some((s) => s.phase === p && s.status === 'running')) return p
    }
    return state.stages[state.stages.length - 1]?.phase ?? null
  }, [state])

  return (
    <div className="mb-6 rounded-xl border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Research ID:{' '}
          <code className="rounded bg-muted px-1">
            {(state.research_id || activeId || '').slice(0, 18)}
          </code>
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span
            className={
              state.status === 'error'
                ? 'h-2 w-2 rounded-full bg-destructive'
                : state.running
                  ? 'h-2 w-2 animate-pulse rounded-full bg-primary'
                  : 'h-2 w-2 rounded-full bg-emerald-500'
            }
          />
          {statusText}
        </span>
      </div>
      {currentPhase && (
        <div className="mb-3 text-sm">
          {t('currentPhase')}:
          <span className="font-medium">{PHASE_LABEL[currentPhase] || currentPhase}</span>
          {typeof state.iteration === 'number' && state.iteration > 0 && (
            <span className="ml-3 text-muted-foreground">
              {t('iteration', {
                iteration: state.iteration,
                max: state.max_iterations ?? state.iteration,
              })}
            </span>
          )}
        </div>
      )}
      {/* 阶段条 */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {PHASES.slice(0, 5).map((p) => {
          const active = state.stages?.some((s) => s.phase === p && s.status === 'running')
          const done = state.stages?.some((s) => s.phase === p && s.status === 'done')
          return (
            <li
              key={p}
              className={`rounded-md border px-3 py-1 ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : done
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                    : 'text-muted-foreground'
              }`}
            >
              {active ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : done ? '✓ ' : ''}
              {PHASE_LABEL[p]}
            </li>
          )
        })}
      </ol>
      {state.error && <p className="mt-3 text-sm text-destructive">{state.error}</p>}
    </div>
  )
}

export default RunStatusPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
