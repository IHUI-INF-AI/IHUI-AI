// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ClipboardList,
  Check,
  Pencil,
  Play,
  Flag,
  Undo2,
  RotateCcw,
  FileEdit,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

// ============================================================================
// W21 Plan 五阶段状态机(2026-09-14 立,对标 CodeBuddy):
// Draft → Review → Approved → Executing → Done,含阶段徽章轨道与回退。
// 迁移表与后端 services/plan_mode.py _PLAN_TRANSITIONS 五阶段语义对齐
// (draft/review 对应后端 draft/pending_approval,done 允许 replan 回 draft)。
// ============================================================================

export type PlanPhase = 'draft' | 'review' | 'approved' | 'executing' | 'done'

/** 五阶段顺序(徽章轨道渲染顺序) */
export const PLAN_PHASES: PlanPhase[] = ['draft', 'review', 'approved', 'executing', 'done']

/** 合法阶段迁移表(键=当前阶段,值=允许迁移到的目标阶段) */
export const PLAN_PHASE_TRANSITIONS: Record<PlanPhase, PlanPhase[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['executing', 'review'],
  executing: ['done', 'approved'],
  done: ['draft'],
}

/** 判断阶段迁移是否合法 */
export function canTransitionPlanPhase(from: PlanPhase, to: PlanPhase): boolean {
  return PLAN_PHASE_TRANSITIONS[from]?.includes(to) ?? false
}

const PHASE_LABEL_KEYS: Record<PlanPhase, string> = {
  draft: 'phaseDraft',
  review: 'phaseReview',
  approved: 'phaseApproved',
  executing: 'phaseExecuting',
  done: 'phaseDone',
}

interface PlanStep {
  id: string
  description: string
  tools?: string[]
}

interface Plan {
  steps: PlanStep[]
  summary?: string
}

interface PlanReviewPanelProps {
  plan: Plan
  /** 受控阶段(可选;不传则面板内部自管状态机) */
  phase?: PlanPhase
  /** 阶段变化回调(受控/非受控均回调) */
  onPhaseChange?: (phase: PlanPhase) => void
  /** 批准/开始执行时触发(兼容既有审批回调) */
  onApprove?: () => void
  /** 修改(回退到草稿)时触发(兼容既有审批回调) */
  onModify?: () => void
  /**
   * D98④:PR 入口复用 D15 数据 —— 调用方传入环境面板同一 PR URL
   * (snapshot.pullRequest.url),本面板只做跳转展示,不另建 PR 数据面/查询。
   * 缺省不渲染入口(既有调用方零改动)。
   */
  pullRequestUrl?: string
  pullRequestNumber?: number
}

interface PhaseAction {
  target: PlanPhase
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  /** 是否主按钮(default)/次按钮(outline) */
  primary: boolean
}

/** 各阶段可用动作(与 PLAN_PHASE_TRANSITIONS 一一对应) */
const PHASE_ACTIONS: Record<PlanPhase, PhaseAction[]> = {
  draft: [{ target: 'review', labelKey: 'submitReview', icon: FileEdit, primary: true }],
  review: [
    { target: 'approved', labelKey: 'approve', icon: Check, primary: true },
    { target: 'draft', labelKey: 'modify', icon: Pencil, primary: false },
  ],
  approved: [
    { target: 'executing', labelKey: 'startExecute', icon: Play, primary: true },
    { target: 'review', labelKey: 'rollback', icon: Undo2, primary: false },
  ],
  executing: [
    { target: 'done', labelKey: 'markDone', icon: Flag, primary: true },
    { target: 'approved', labelKey: 'rollback', icon: Undo2, primary: false },
  ],
  done: [{ target: 'draft', labelKey: 'replan', icon: RotateCcw, primary: false }],
}

export function PlanReviewPanel({
  plan,
  phase: controlledPhase,
  onPhaseChange,
  onApprove,
  onModify,
  pullRequestUrl,
  pullRequestNumber,
}: PlanReviewPanelProps) {
  const t = useTranslations('planReview')
  // 非受控默认从 review 起步(计划产出即进入评审)
  const [internalPhase, setInternalPhase] = React.useState<PlanPhase>('review')
  const phase = controlledPhase ?? internalPhase
  const phaseIdx = PLAN_PHASES.indexOf(phase)

  const changePhase = React.useCallback(
    (target: PlanPhase) => {
      if (!canTransitionPlanPhase(phase, target)) return
      if (target === 'approved' || target === 'executing') onApprove?.()
      if (target === 'draft' && phase === 'review') onModify?.()
      onPhaseChange?.(target)
      if (controlledPhase === undefined) setInternalPhase(target)
    },
    [phase, onApprove, onModify, onPhaseChange, controlledPhase],
  )

  const actions = PHASE_ACTIONS[phase]

  return (
    <div className="rounded-xl border bg-card" data-testid="plan-review-panel">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {/* D98④:查看 PR(与 D15 同 URL 源,仅跳转) */}
        {pullRequestUrl && (
          <a
            href={pullRequestUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            data-testid="plan-review-pr-link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>
              {t('viewPullRequest')}
              {pullRequestNumber !== undefined ? ` #${pullRequestNumber}` : ''}
            </span>
          </a>
        )}
      </div>
      {/* 五阶段徽章轨道:已过阶段 primary/10,当前阶段 primary 实心,未到阶段 muted */}
      <div className="flex items-center gap-1 px-4 pb-2" data-testid="plan-phase-track">
        {PLAN_PHASES.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && (
              <span
                className={cn('h-px w-3 shrink-0', i <= phaseIdx ? 'bg-primary/40' : 'bg-border')}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                i < phaseIdx
                  ? 'bg-primary/10 text-primary'
                  : i === phaseIdx
                    ? 'bg-cta text-cta-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
              data-testid={`plan-phase-badge-${p}`}
              aria-current={p === phase ? 'step' : undefined}
            >
              {t(PHASE_LABEL_KEYS[p])}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="space-y-3 p-3">
        {plan.steps.length === 0 && !plan.summary ? (
          <p
            className="py-6 text-center text-sm text-muted-foreground"
            data-testid="plan-review-empty"
          >
            {t('empty')}
          </p>
        ) : (
          <>
            {plan.summary && (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {plan.summary}
              </p>
            )}
            <ol className="space-y-2">
              {plan.steps.map((step, idx) => (
                <li key={step.id} className="rounded-lg border bg-background/50 p-3">
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-cta/10 text-xs font-medium text-primary">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{step.description}</p>
                      {step.tools && step.tools.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {step.tools.map((tool) => (
                            <span
                              key={tool}
                              className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      {/* 阶段动作条:批准/修改/回退/开始执行/标记完成,随 phase 切换 */}
      <div className="mt-3 flex gap-2 px-4 pb-4" data-testid="plan-phase-actions">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.target}
              variant={action.primary ? 'default' : 'outline'}
              size="sm"
              onClick={() => changePhase(action.target)}
              className="flex-1"
              data-testid={`plan-action-${action.target}`}
            >
              <Icon className="h-4 w-4" />
              {t(action.labelKey)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export default PlanReviewPanel
//
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
