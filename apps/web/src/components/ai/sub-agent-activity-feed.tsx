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

  // open 用 ref 读取:避免把 open 加入 deps 后,用户手动折叠会触发 effect 立即重开
  const openRef = React.useRef(open)
  openRef.current = open

  // 流式开始或 agent 转为运行中时自动展开(用户手动折叠后不会强行重开,除非状态再变化)
  React.useEffect(() => {
    if ((active || hasStreaming) && !openRef.current) setOpen(true)
  }, [active, hasStreaming])

  return (
    <div className="text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={statusLabel}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150',
            STATUS_DOT_COLOR[agent.status],
            active && 'animate-pulse',
          )}
        />
        <span className="font-medium text-foreground/80">{agent.name || agent.type || defaultName}</span>
        <span className="rounded-sm bg-muted/50 px-1 py-0.5 text-[10px] text-muted-foreground/70">
          {badgeLabel}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="ml-3 mt-0.5 space-y-1 border-l border-border/20 pl-2">
          {(agent.completedSteps.length > 0 || agent.currentStep) && (
            <div className="space-y-0.5">
              {agent.completedSteps.map((step, i) => (
                <div
                  key={`${agent.agentId}-${i}-${step.createdAt}`}
                  className="flex items-center gap-1 text-[10px]"
                >
                  <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                  <span className="text-muted-foreground/70">{step.stepAction}</span>
                </div>
              ))}
              {agent.currentStep && active && (
                <div className="flex items-center gap-1 text-[10px]">
                  <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-primary/70" />
                  <span className="text-foreground/70">{agent.currentStep}</span>
                  {agent.progressIteration !== undefined && agent.progressIteration > 1 && (
                    <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/45">
                      ·{agent.progressIteration}轮
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 工具调用计数 + 输出预览(2026-07-28 立,subagent_progress 事件驱动) */}
          {agent.toolCallsCount !== undefined && agent.toolCallsCount > 0 && (
            <div className="text-[9px] tabular-nums text-muted-foreground/45">
              {agent.toolCallsCount} 次工具调用
            </div>
          )}
          {agent.outputPreview && active && (
            <div className="rounded-sm bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 line-clamp-2">
              {agent.outputPreview}
            </div>
          )}

          {hasStreaming && streaming && (
            <div className="rounded-sm bg-muted/30 p-1.5">
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
        'rounded-sm border border-border/30 bg-card/50',
        completed && 'border-emerald-500/25 bg-emerald-500/[0.02]',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          {!completed && hasRunning ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary/70" />
          ) : completed ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <Zap className="h-3 w-3 text-amber-500" />
          )}
          <span className="text-[11px] font-medium text-foreground/80">
            {completed ? (
              <>
                {t('coordinated', { count: activities.length })}
                {totalSteps > 0 && (
                  <span className="ml-1 text-muted-foreground/60">
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
          <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1.5 bg-muted/20 px-2 py-1.5">
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
