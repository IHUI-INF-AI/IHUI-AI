'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SubAgentActivity, AgentStatus } from './types'
import { MarkdownStream } from './markdown-stream'
import {
  SubAgentTaskTree,
  type SubAgentBatch,
  type SubAgentTask,
  type SubTaskStatus,
  type SubAgentType,
} from './sub-agent-task-tree'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
  /** Phase 18.2: inline 模式(对话流内联,无外层卡片+折叠按钮) */
  inline?: boolean
  /** Phase 18.4: step 预算(used / total),用于 CheckedItemsBlock 显示 */
  stepBudget?: { used: number; total: number }
  /** Phase 19.6: 启用树形展示(批次→子代理→子操作 3 层);未传 batches 时回退扁平 */
  treeMode?: boolean
  /** Phase 19.6: 树形展示所需的批次数据;存在时优先使用树形 */
  batches?: SubAgentBatch[]
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

/** Phase 19.6: SubAgentActivity.status → SubTaskStatus 映射 */
function mapAgentStatus(status: AgentStatus): SubTaskStatus {
  if (status === 'running' || status === 'thinking' || status === 'acting' || status === 'reflecting') {
    return 'running'
  }
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'failed'
  return 'pending'
}

/** Phase 19.6: agent.type 字符串 → SubAgentType 联合类型映射 */
function mapAgentType(type: string): SubAgentType {
  if (type === 'coding' || type === 'search' || type === 'browser' || type === 'dispatch' || type === 'planning') {
    return type
  }
  return 'coding'
}

/** Phase 19.6: SubAgentActivity → SubAgentTask 派生(单个 activity 包装为 1 个 task) */
function activityToTask(agent: SubAgentActivity, batchId?: string): SubAgentTask {
  return {
    id: agent.agentId,
    name: agent.name || agent.type || 'Sub Agent',
    type: mapAgentType(agent.type),
    statusText: agent.currentStep || '',
    status: mapAgentStatus(agent.status),
    operations: agent.completedSteps.map((step, i) => ({
      id: `${agent.agentId}-op-${i}`,
      label: step.stepAction,
      status: step.status === 'completed' ? 'done' : step.status === 'failed' ? 'failed' : step.status === 'running' ? 'running' : 'pending',
      timestamp: step.createdAt,
    })),
    batchId,
  }
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
                  {agent.progressIteration !== undefined && agent.progressIteration > 1 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                      ·{agent.progressIteration}轮
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 工具调用计数 + 输出预览(2026-07-28 立,subagent_progress 事件驱动) */}
          {agent.toolCallsCount !== undefined && agent.toolCallsCount > 0 && (
            <div className="text-[10px] tabular-nums text-muted-foreground/50">
              {agent.toolCallsCount} 次工具调用
            </div>
          )}
          {agent.outputPreview && active && (
            <div className="rounded-sm bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground/70 line-clamp-2">
              {agent.outputPreview}
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
 *
 * Phase 19.6: 新增 treeMode 模式 — 当传入 batches 或启用 treeMode 时,
 *   渲染 3 层树形(批次→子代理→子操作);否则回退扁平 SubAgentCard。
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
  inline = false,
  stepBudget,
  treeMode = false,
  batches,
}: SubAgentActivityFeedProps) {
  const t = useTranslations('ai.subAgentFeed')
  const ts = useTranslations('ai.status')
  const hasRunning = activities.some(isAgentActive)
  const [expanded, setExpanded] = React.useState(initiallyExpanded ?? (hasRunning && !completed))

  const totalSteps = activities.reduce((sum, a) => sum + a.completedSteps.length, 0)

  // Phase 18.4: step budget 显示
  const budgetText = stepBudget
    ? `Current usage: ${stepBudget.used} / ${stepBudget.total} step budget`
    : undefined

  // Phase 19.6: 派生 batches(若未传 batches 但启用了 treeMode,自动包装为单 batch)
  const useTree = treeMode || (batches !== undefined && batches.length > 0)
  const resolvedBatches = React.useMemo<SubAgentBatch[]>(() => {
    if (batches !== undefined && batches.length > 0) return batches
    if (treeMode && activities.length > 0) {
      return [
        {
          id: `${_swarmId}-default-batch`,
          title: `子代理活动 (${activities.length})`,
          tone: completed ? 'success' : hasRunning ? 'info' : 'default',
          meta: completed ? '已完成' : hasRunning ? '进行中' : '等待中',
          tasks: activities.map((a) => activityToTask(a)),
        },
      ]
    }
    return []
  }, [batches, treeMode, activities, completed, hasRunning, _swarmId])

  // Phase 19.6: 树形模式渲染
  if (useTree && resolvedBatches.length > 0) {
    if (inline) {
      return (
        <div className="space-y-1.5" data-testid="sub-agent-tree-inline">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Zap className="h-3 w-3 text-amber-500" aria-hidden />
            <span>
              {completed
                ? t('coordinated', { count: resolvedBatches.length })
                : t('working', { count: resolvedBatches.length })}
            </span>
          </div>
          <SubAgentTaskTree batches={resolvedBatches} />
        </div>
      )
    }
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
              {completed
                ? t('coordinated', { count: resolvedBatches.length })
                : t('working', { count: resolvedBatches.length })}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t px-3 py-2">
            <SubAgentTaskTree batches={resolvedBatches} />
          </div>
        )}
      </div>
    )
  }

  // Phase 18.2: inline 模式 — 无外层卡片,直接渲染 agent 列表
  if (inline) {
    return (
      <div className="space-y-1.5" data-testid="sub-agent-inline">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <Zap className="h-3 w-3 text-amber-500" aria-hidden />
          <span>
            {completed
              ? t('coordinated', { count: activities.length })
              : t('working', { count: activities.length })}
            {totalSteps > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                {t('totalSteps', { count: totalSteps })}
              </span>
            )}
          </span>
        </div>
        {activities.map((agent) => (
          <SubAgentCard
            key={agent.agentId}
            agent={agent}
            badgeLabel={t('badge')}
            defaultName={t('defaultName')}
            statusLabel={ts(agent.status)}
          />
        ))}
        {budgetText && completed && (
          <div className="text-[10px] text-muted-foreground/60">{budgetText}</div>
        )}
      </div>
    )
  }

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
