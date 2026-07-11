'use client'

import * as React from 'react'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SubAgentActivity, AgentStatus } from './types'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
}

const STATUS_DOT_COLOR: Record<AgentStatus, string> = {
  idle: 'bg-zinc-400',
  pending: 'bg-amber-400',
  thinking: 'bg-amber-500',
  acting: 'bg-violet-500',
  reflecting: 'bg-cyan-500',
  waiting: 'bg-amber-400',
  running: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-zinc-400',
}

const STATUS_TEXT: Record<AgentStatus, string> = {
  idle: '空闲',
  pending: '等待',
  thinking: '思考中',
  acting: '执行中',
  reflecting: '反思中',
  waiting: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

/**
 * SubAgentActivityFeed - 子 Agent 活动流
 * 显示 Agentic 模式下每个子智能体的实时活动
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
}: SubAgentActivityFeedProps) {
  const hasRunning = activities.some(
    (a) => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'cancelled',
  )
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
                已协调 {activities.length} 个子智能体完成
                {totalSteps > 0 && (
                  <span className="ml-1 text-muted-foreground">（共 {totalSteps} 步）</span>
                )}
              </>
            ) : (
              <>{activities.length} 个子智能体协作中</>
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
            <div key={agent.agentId} className="text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block h-2 w-2 shrink-0 rounded-full',
                    STATUS_DOT_COLOR[agent.status],
                  )}
                />
                <span className="font-medium">{agent.name || agent.type || '子智能体'}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  subagent
                </span>
                <span className="text-xs text-muted-foreground">{STATUS_TEXT[agent.status]}</span>
              </div>

              {(agent.completedSteps.length > 0 || agent.currentStep) && (
                <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
                  {agent.completedSteps.map((step, i) => (
                    <div
                      key={`${agent.agentId}-${i}-${step.createdAt}`}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{step.stepAction}</span>
                    </div>
                  ))}
                  {agent.currentStep &&
                    agent.status !== 'completed' &&
                    agent.status !== 'failed' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                        <span>{agent.currentStep}</span>
                      </div>
                    )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SubAgentActivityFeed
