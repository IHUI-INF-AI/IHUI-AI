'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SubAgentActivity, AgentStatus } from './types'
import { MarkdownStream } from './markdown-stream'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
}

const STATUS_DOT_COLOR: Record<AgentStatus, string> = {
  idle: 'bg-muted-foreground/50',
  pending: 'bg-amber-400',
  thinking: 'bg-amber-500',
  acting: 'bg-violet-500',
  reflecting: 'bg-cyan-500',
  waiting: 'bg-amber-400',
  running: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-muted-foreground/50',
}

function isAgentActive(agent: SubAgentActivity): boolean {
  return (
    agent.status !== 'completed' &&
    agent.status !== 'failed' &&
    agent.status !== 'cancelled'
  )
}

interface SubAgentCardProps {
  agent: SubAgentActivity
  badgeLabel: string
  defaultName: string
  statusLabel: string
}

/**
 * 单个 subagent 卡片:标题栏点击切换折叠,运行中或有流式输出时默认展开。
 * 流式 token 输出区(completedSteps 下方)用 MarkdownStream 渲染,按 agent 分流。
 */
function SubAgentCard({ agent, badgeLabel, defaultName, statusLabel }: SubAgentCardProps) {
  const active = isAgentActive(agent)
  const streaming = agent.streamingContent
  const hasStreaming = !!streaming && streaming.length > 0
  const [open, setOpen] = React.useState(active || hasStreaming)

  // 流式开始或 agent 转为运行中时自动展开(用户手动折叠后不会强行重开,除非状态再变化)
  React.useEffect(() => {
    if ((active || hasStreaming) && !open) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasStreaming])

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            STATUS_DOT_COLOR[agent.status],
          )}
        />
        <span className="font-medium">{agent.name || agent.type || defaultName}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {badgeLabel}
        </span>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
        <ChevronDown
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="ml-4 mt-1 space-y-1.5 border-l pl-3">
          {(agent.completedSteps.length > 0 || agent.currentStep) && (
            <div className="space-y-0.5">
              {agent.completedSteps.map((step, i) => (
                <div
                  key={`${agent.agentId}-${i}-${step.createdAt}`}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="text-muted-foreground">{step.stepAction}</span>
                </div>
              ))}
              {agent.currentStep && active && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                  <span>{agent.currentStep}</span>
                </div>
              )}
            </div>
          )}

          {hasStreaming && streaming && (
            <div className="rounded-md bg-muted/40 p-2">
              <MarkdownStream content={streaming} isStreaming={!agent.streamingDone} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * SubAgentActivityFeed - 子 Agent 活动流
 * 显示 Agentic 模式下每个子智能体的实时活动(步骤级 + token 级流式)
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
}: SubAgentActivityFeedProps) {
  const t = useTranslations('ai.subAgentFeed')
  const ts = useTranslations('ai.status')
  const hasRunning = activities.some(isAgentActive)
  const [expanded, setExpanded] = React.useState(initiallyExpanded ?? (hasRunning && !completed))

  const totalSteps = activities.reduce((sum, a) => sum + a.completedSteps.length, 0)

  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        completed && 'border-emerald-500/30 bg-emerald-500/[0.03]',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {!completed && hasRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Zap className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            {completed ? (
              <>
                {t('coordinated', { count: activities.length })}
                {totalSteps > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    {t('totalSteps', { count: totalSteps })}
                  </span>
                )}
              </>
            ) : (
              <>{t('working', { count: activities.length })}</>
            )}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t px-3 py-2">
          {activities.map((agent) => (
            <SubAgentCard
              key={agent.agentId}
              agent={agent}
              badgeLabel={t('badge')}
              defaultName={t('defaultName')}
              statusLabel={ts(agent.status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SubAgentActivityFeed
