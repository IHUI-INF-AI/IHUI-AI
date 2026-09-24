// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D103 流内多智能体批量动作卡(G-141) —— 对话流渲染位。
//
// 形状是**「动作 × 三态」矩阵**:`@ihui/shared/chat` 的 AGENT_ACTIONS(六动作)/
// AGENT_ACTION_PHASES(三相位)是唯一矩阵定义处,本卡只消费,不重定义。
// 标题用组合式 `{动词}{count}`,动词在组内相位一致时取该相位文案(如「正在中断 2 个智能体」
// 「中断未成功 1 个智能体」),混合相位回退动作名(「创建 3 个智能体」);count 走 ICU plural。
//
// 失败态 text-destructive(与时间线既有失败语义同源,可辨识不刺眼);
// 进行中态沿用 Loader2 + animate-spin 惯例。

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  type AgentAction,
  type AgentActionPhase,
} from '@ihui/shared/chat'

export interface MultiAgentActionEntry {
  /** 动作(六动作之一) */
  action: AgentAction
  /** 该次动作的相位(三态) */
  phase: AgentActionPhase
  /** 目标智能体名(展示用) */
  agent: string
}

export interface MultiAgentActionCardProps {
  entries: readonly MultiAgentActionEntry[]
  className?: string
  'data-testid'?: string
}

/** 三态配色(failed 可辨识但不刺眼,与 timeline-event 的 STATUS_CLS.failed 同源) */
const PHASE_TONE: Record<AgentActionPhase, string> = {
  inProgress: 'text-muted-foreground',
  completed: 'text-emerald-600 dark:text-emerald-500',
  failed: 'text-destructive',
}

export function MultiAgentActionCard({
  entries,
  className,
  'data-testid': testId,
}: MultiAgentActionCardProps) {
  const t = useTranslations('multiAgentAction')

  // 动作名(混合相位时组合式标题回退用)
  const actionLabel: Record<AgentAction, string> = {
    spawn: t('action.spawn.label'),
    resume: t('action.resume.label'),
    sendInput: t('action.sendInput.label'),
    interrupt: t('action.interrupt.label'),
    close: t('action.close.label'),
    list: t('action.list.label'),
  }

  // 18 格逐格静态取词(next-intl 类型检查可过;键名与 @ihui/shared/chat 的
  // agentActionPhaseKey 同构,五语言词包语义对齐)
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

  // 按动作分组(每个动作族一行/组)
  const groups = React.useMemo(() => {
    const map = new Map<AgentAction, MultiAgentActionEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.action)
      if (list) list.push(entry)
      else map.set(entry.action, [entry])
    }
    return [...map.entries()]
  }, [entries])

  // 组合式标题动词:组内相位一致 → 该相位文案;混合 → 动作名
  const titleVerb = (action: AgentAction, group: readonly MultiAgentActionEntry[]): string => {
    const first = group[0]?.phase
    if (first !== undefined && group.every((e) => e.phase === first)) {
      return phaseText[action][first]
    }
    return actionLabel[action]
  }

  if (entries.length === 0) return null

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-agent-action-groups={groups.length}
    >
      {groups.map(([action, group]) => (
        <div key={action} className="flex flex-col gap-1" data-action-group={action}>
          <span
            className="text-xs font-medium text-foreground"
            data-testid={testId ? `${testId}-title` : 'multi-agent-action-title'}
          >
            {titleVerb(action, group)} {t('header.count', { count: group.length })}
          </span>
          <ul className="flex flex-col gap-0.5">
            {group.map((entry, index) => (
              <li
                key={`${entry.agent}-${entry.phase}-${index}`}
                className="flex items-center gap-1.5 text-[11px]"
              >
                {entry.phase === 'inProgress' && (
                  <Loader2
                    className="h-3 w-3 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className={cn(PHASE_TONE[entry.phase])} data-action-phase={entry.phase}>
                  {phaseText[action][entry.phase]}
                </span>
                <span className="truncate text-muted-foreground">{entry.agent}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default MultiAgentActionCard
