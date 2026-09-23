// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D103 流内多智能体批量动作卡(G-141) —— 对话流内渲染件。
//
// 形状:**「动作 × 三态」矩阵**(`@ihui/shared/chat` 的 AGENT_ACTION_MATRIX 是唯一矩阵定义处)。
// 标题用组合式 `{动作名} {countLabel}`,其中 countLabel 走 **ICU plural**
// (H28 已验证链路;一种语义一个键,避免 5 语言词表爆炸)。
// 行级模板 `{action} {agent}{stateSuffix}`。
//
// **不另建第二套状态枚举**:动作相位(`inProgress/completed/failed`)与实例状态
// (`AgentInstanceState` 七态,定义在 `@ihui/types`)是两个正交维度,本卡只消费,不重定义。
// `notFound` 这一终态**必须显式渲染**(我方此前无处表达它,静默留空等于把"找不到"伪装成"还在跑")。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import type { AgentInstanceState } from '@ihui/types'
import type { AgentAction, AgentActionPhase } from '@ihui/shared/chat'

export interface AgentActionEntry {
  /** 动作 */
  action: AgentAction
  /** 该次动作的相位 */
  phase: AgentActionPhase
  /** 目标智能体名(展示用) */
  agent: string
  /** 实例状态(七态;可选 —— 事件补齐前未知就是不传,不猜) */
  instanceState?: AgentInstanceState
  /** 入参提示(有则渲染 `输入：…` 行) */
  prompt?: string
}

export interface AgentActionsCardProps {
  entries: readonly AgentActionEntry[]
  className?: string
  'data-testid'?: string
}

const PHASE_TONE: Record<AgentActionPhase, string> = {
  inProgress: 'text-muted-foreground',
  completed: 'text-emerald-600 dark:text-emerald-500',
  failed: 'text-destructive',
}

const INSTANCE_TONE: Record<AgentInstanceState, string> = {
  running: 'text-muted-foreground',
  completed: 'text-emerald-600 dark:text-emerald-500',
  errored: 'text-destructive',
  interrupted: 'text-amber-600 dark:text-amber-500',
  pendingInit: 'text-muted-foreground',
  shutdown: 'text-muted-foreground',
  notFound: 'text-amber-600 dark:text-amber-500',
}

export function AgentActionsCard({
  entries,
  className,
  'data-testid': testId,
}: AgentActionsCardProps) {
  const t = useTranslations('ai.pane.agentActions')

  // 动作名(组合式标题用)
  const actionLabel: Record<AgentAction, string> = {
    spawn: t('action.spawn.label'),
    resume: t('action.resume.label'),
    sendInput: t('action.sendInput.label'),
    interrupt: t('action.interrupt.label'),
    close: t('action.close.label'),
    list: t('action.list.label'),
  }

  // 相位文案:18 格逐格静态(每个动作的三态措辞不同,不能只按相位取词)
  const phaseText: Record<AgentAction, Record<AgentActionPhase, string>> = {
    spawn: {
      inProgress: t('action.spawn.inProgress'),
      completed: t('action.spawn.completed'),
      failed: t('action.spawn.failed'),
    },
    resume: {
      inProgress: t('action.resume.inProgress'),
      completed: t('action.resume.completed'),
      failed: t('action.resume.failed'),
    },
    sendInput: {
      inProgress: t('action.sendInput.inProgress'),
      completed: t('action.sendInput.completed'),
      failed: t('action.sendInput.failed'),
    },
    interrupt: {
      inProgress: t('action.interrupt.inProgress'),
      completed: t('action.interrupt.completed'),
      failed: t('action.interrupt.failed'),
    },
    close: {
      inProgress: t('action.close.inProgress'),
      completed: t('action.close.completed'),
      failed: t('action.close.failed'),
    },
    list: {
      inProgress: t('action.list.inProgress'),
      completed: t('action.list.completed'),
      failed: t('action.list.failed'),
    },
  }

  const stateLabel: Record<AgentInstanceState, string> = {
    running: t('state.running'),
    completed: t('state.completed'),
    errored: t('state.errored'),
    interrupted: t('state.interrupted'),
    pendingInit: t('state.pendingInit'),
    shutdown: t('state.shutdown'),
    notFound: t('state.notFound'),
  }

  // 按动作分组:标题显示 `{动作名} {count}`(count 走 ICU plural)
  const groups = React.useMemo(() => {
    const map = new Map<AgentAction, AgentActionEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.action)
      if (list) list.push(entry)
      else map.set(entry.action, [entry])
    }
    return [...map.entries()]
  }, [entries])

  if (entries.length === 0) return null

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-agent-action-groups={groups.length}
    >
      {groups.map(([action, group]) => (
        <div key={action} className="flex flex-col gap-1" data-action-group={action}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {actionLabel[action]} {t('header.count', { count: group.length })}
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {group.map((entry, index) => (
              <li
                key={`${entry.agent}-${entry.phase}-${index}`}
                className="flex flex-wrap items-center gap-1.5 text-[11px]"
              >
                <span className={cn(PHASE_TONE[entry.phase])} data-action-phase={entry.phase}>
                  {phaseText[entry.action][entry.phase]}
                </span>
                <span className="truncate text-muted-foreground">{entry.agent}</span>
                {entry.instanceState ? (
                  <span
                    className={cn(INSTANCE_TONE[entry.instanceState])}
                    data-instance-state={entry.instanceState}
                  >
                    {stateLabel[entry.instanceState]}
                  </span>
                ) : null}
                {entry.prompt ? (
                  <span className="truncate text-muted-foreground/70" data-agent-prompt>
                    {t('meta.prompt', { prompt: entry.prompt })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
