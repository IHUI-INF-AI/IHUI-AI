// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
// goal 模式「独立校验闸门」结论的展示件(AGENTS.md §8 第 3 步"结论必须到人"的落点)。
//
// 为什么落在这里而不是工具面板的 GoalCard:GoalCard(`components/ai/goal-card.tsx`)由
// `stores/goal.ts` 的本地 zustand 驱动,写入方只有 `/goal` 斜杠命令与人工按钮,
// **没有任何服务端执行循环**,拿不到 done 帧;而本面板是 `executeAgentStream` 在全仓
// 唯一的 UI 调用方(`AgentPane.tsx`),闸门结论只可能从这里到达人眼。
//
// 三条展示铁律(改本文件前先读):
//  1. `undetermined` 不得渲染成"完成"、不得用绿色、**也不得整块不显示** —— 静默等于
//     把闸门判过的事重新变回模型自评;它用琥珀 + 明写"不视为完成"。
//  2. `achieved` 只在闸门放行(`treat_as_complete === true`)时由 model.ts 给出,
//     本件不再自行推断。
//  3. 逐条指标的 verdict / reason / 证据按仓库既有 `<details>` 折叠形态呈现
//     (先例:agent-swarm-monitor.tsx、subagents/DispatchForm.tsx),不另造组件族。
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Gauge,
  HelpCircle,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { GoalVerificationView } from './model'

type VerificationKind = GoalVerificationView['kind']

/** 六档 → 徽章配色(与 GoalCard 的 STATUS_BADGE 同一套"浅底 + 同色系字"形态) */
const KIND_BADGE: Record<VerificationKind, string> = {
  achieved: 'bg-emerald-500/15 text-emerald-600',
  unmet: 'bg-destructive/10 text-destructive',
  // 未判定 ≠ 未达成:单独一档、单独一色,避免两档互相混淆
  undetermined: 'bg-amber-500/15 text-amber-600',
  blocked: 'bg-destructive/15 text-destructive',
  budget_limited: 'bg-amber-500/15 text-amber-700',
  not_declared: 'bg-muted text-muted-foreground',
}

const KIND_KEY: Record<VerificationKind, string> = {
  achieved: 'goalAchieved',
  unmet: 'goalUnmet',
  undetermined: 'goalUndetermined',
  blocked: 'goalBlocked',
  budget_limited: 'goalBudgetLimited',
  not_declared: 'goalNotDeclared',
}

const KIND_ICON: Record<VerificationKind, typeof CheckCircle2> = {
  achieved: CheckCircle2,
  unmet: XCircle,
  undetermined: HelpCircle,
  blocked: Ban,
  budget_limited: Gauge,
  not_declared: CircleDashed,
}

const VERDICT_KEY: Record<'met' | 'unmet' | 'unknown', string> = {
  met: 'goalVerdictMet',
  unmet: 'goalVerdictUnmet',
  unknown: 'goalVerdictUnknown',
}

const VERDICT_CLASS: Record<'met' | 'unmet' | 'unknown', string> = {
  met: 'text-emerald-600',
  unmet: 'text-destructive',
  unknown: 'text-amber-600',
}

/** 未知取值(服务端新增档)退回原样显示,不让 t(undefined) 把整块结论炸掉 */
function translateKnown(
  t: (key: string) => string,
  table: Record<string, string>,
  value: string,
): string {
  const key = table[value]
  return key ? t(`agentPane.${key}`) : value
}

const BASIS_KEY: Record<string, string> = {
  machine: 'goalBasisMachine',
  judge: 'goalBasisJudge',
  'missing-evidence': 'goalBasisMissingEvidence',
}

export interface AgentVerificationSectionProps {
  view: GoalVerificationView
}

export function AgentVerificationSection({ view }: AgentVerificationSectionProps) {
  const t = useTranslations('ide')
  // 本次请求没声明硬性指标 = 闸门未参与,不占版面(普通运行的既有观感零变更)
  if (view.kind === 'not_declared') return null

  const verification = view.verification
  const Icon = KIND_ICON[view.kind]
  const criteria = verification?.criteria ?? []
  const warnings = verification?.independence_warnings ?? []
  const failures = verification?.consecutive_failures ?? 0
  const maxFailures = verification?.max_consecutive_failures ?? 0

  return (
    <div
      data-testid="agent-goal-verification"
      data-goal-status={view.kind}
      className="shrink-0 space-y-1.5 bg-card px-2 pb-2 text-xs"
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        <span
          data-testid="agent-goal-status"
          className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', KIND_BADGE[view.kind])}
        >
          {t(`agentPane.${KIND_KEY[view.kind]}`)}
        </span>
        {view.totalCount !== null && view.metCount !== null && (
          <span
            data-testid="agent-goal-met-count"
            className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground"
          >
            {t('agentPane.goalCriteriaCount', { met: view.metCount, total: view.totalCount })}
          </span>
        )}
      </div>

      {verification?.unavailable_reason && (
        <p data-testid="agent-goal-unavailable" className="break-words text-amber-600">
          {t('agentPane.goalUnavailableReason')}: {verification.unavailable_reason}
        </p>
      )}

      {failures > 0 && (
        <p data-testid="agent-goal-consecutive" className="text-destructive">
          {t('agentPane.goalConsecutive', { failures, max: maxFailures })}
        </p>
      )}

      {criteria.length > 0 && (
        <ul data-testid="agent-goal-criteria" className="space-y-1">
          {criteria.map((item) => (
            <li key={item.criterion_id}>
              <details className="rounded-md border border-border bg-background px-2 py-1">
                <summary className="list-none cursor-pointer break-words">
                  <span className={VERDICT_CLASS[item.verdict]}>
                    {translateKnown(t, VERDICT_KEY, item.verdict)}
                  </span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {translateKnown(t, BASIS_KEY, item.basis)}
                  </span>
                </summary>
                <p className="mt-1 break-words">{item.statement}</p>
                {item.reason && (
                  <p className="mt-1 break-words text-muted-foreground">
                    {t('agentPane.goalReason')}: {item.reason}
                  </p>
                )}
                <p className="mt-1 break-words text-muted-foreground">
                  {item.evidence_ids.length > 0
                    ? t('agentPane.goalEvidence', { ids: item.evidence_ids.join(', ') })
                    : t('agentPane.goalNoEvidence')}
                </p>
                {item.contradicted && (
                  <p className="mt-1 flex items-start gap-1 break-words text-destructive">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    <span>{t('agentPane.goalContradicted')}</span>
                  </p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <div data-testid="agent-goal-warnings" className="space-y-0.5 text-muted-foreground">
          <p>{t('agentPane.goalWarnings')}</p>
          {warnings.map((warning) => (
            <p key={warning} className="break-words">
              · {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentVerificationSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
