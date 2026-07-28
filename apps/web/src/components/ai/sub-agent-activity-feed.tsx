'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SubAgentActivity, AgentStatus } from './types'
import { MarkdownStream } from './markdown-stream'
import type { Subagent, SubagentColor, SubagentStatus } from '@/hooks/use-agent-progress'
import { BatchHeader, type BatchStatus } from './progress-sections/batch-header'
import { SubAgentTaskTree } from './progress-sections/sub-agent-task-tree'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
  /**
   * 启用 Codex 风格的 3 层树形嵌套渲染:
   *   批次 (BatchHeader) → 子代理 (SubAgentTaskTree) → 工具调用 (Checklist)
   * 默认 false(保持原简单卡片列表行为,向后兼容)
   */
  treeMode?: boolean
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

const SUBAGENT_COLOR_POOL: SubagentColor[] = [
  'cyan',
  'blue',
  'green',
  'yellow',
  'magenta',
  'red',
]

/** AgentStatus → SubagentStatus 映射(Codex 子代理状态枚举对齐) */
const AGENT_STATUS_TO_SUBAGENT: Record<AgentStatus, SubagentStatus> = {
  idle: 'spawned',
  pending: 'spawned',
  thinking: 'running',
  acting: 'running',
  reflecting: 'running',
  waiting: 'spawned',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  cancelled: 'dead',
}

/** 从 activities 推导批次状态(优先级:failed > running > completed > partial) */
function deriveBatchStatus(
  activities: readonly SubAgentActivity[],
  completedFlag: boolean,
): BatchStatus {
  if (activities.length === 0) return completedFlag ? 'completed' : 'running'
  const failedCount = activities.filter((a) => a.status === 'failed').length
  const completedCount = activities.filter((a) => a.status === 'completed').length
  const activeCount = activities.filter(
    (a) =>
      a.status !== 'completed' &&
      a.status !== 'failed' &&
      a.status !== 'cancelled',
  ).length
  if (failedCount > 0 && failedCount === activities.length) return 'failed'
  if (activeCount > 0) return 'running'
  if (completedCount === activities.length) return 'completed'
  if (completedCount > 0 && failedCount > 0) return 'partial'
  // 含 cancelled 等:已无 active 且非全成功也非全失败 → partial
  if (completedCount > 0) return 'partial'
  return completedFlag ? 'completed' : 'running'
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
 * 把 SubAgentActivity 映射成 Subagent(Codex 风格)
 * - color 循环使用 SUBAGENT_COLOR_POOL
 * - status 用 AGENT_STATUS_TO_SUBAGENT 映射
 * - tools 从 completedSteps 派生(每条 step 视为一个 tool call,status=success)
 */
function activityToSubagent(
  activity: SubAgentActivity,
  colorIndex: number,
): Subagent {
  const nickname = activity.name || activity.type || 'agent'
  const color =
    SUBAGENT_COLOR_POOL[colorIndex % SUBAGENT_COLOR_POOL.length] ?? 'cyan'
  const status: SubagentStatus = AGENT_STATUS_TO_SUBAGENT[activity.status]
  const tools = activity.completedSteps.map((step, idx) => ({
    id: `${activity.agentId}-tool-${idx}`,
    toolName: step.stepAction,
    args: {} as Record<string, unknown>,
    status: 'success' as const,
    startedAt: step.createdAt,
    endedAt: step.createdAt,
  }))
  return {
    id: activity.agentId,
    threadId: activity.agentId,
    nickname,
    handle: `@${nickname}`,
    color,
    status,
    role: activity.type,
    // spawnedAt 缺失时用空串占位(Subagent.spawnedAt 是必填字段);
    // 上游 SubAgentActivity 无 spawn 时间字段,留空不影响树形展示
    spawnedAt: '',
    currentTask: activity.currentStep || undefined,
    tools,
  }
}

/**
 * 树形模式下的 BatchHeader 包装
 * - 计算批次状态 + completed/failed 计数
 * - 折叠态下隐藏子树,展开态展示所有 SubAgentTaskTree
 */
const TreeModeBatch = React.memo(function TreeModeBatch({
  activities,
  completed,
  defaultCollapsed,
}: {
  activities: readonly SubAgentActivity[]
  completed: boolean
  defaultCollapsed: boolean
}) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = internalCollapsed
  const toggle = React.useCallback(() => setInternalCollapsed((v) => !v), [])

  const status = React.useMemo(
    () => deriveBatchStatus(activities, completed),
    [activities, completed],
  )
  const agentCount = activities.length
  const completedCount = React.useMemo(
    () => activities.filter((a) => a.status === 'completed').length,
    [activities],
  )
  const failedCount = React.useMemo(
    () => activities.filter((a) => a.status === 'failed').length,
    [activities],
  )

  const subagents = React.useMemo(
    () => activities.map((a, i) => activityToSubagent(a, i)),
    [activities],
  )

  return (
    <div
      className="rounded-lg border bg-card"
      data-testid="sub-agent-feed-tree"
    >
      <BatchHeader
        batchIndex={1}
        title="子代理派单批次"
        agentCount={agentCount}
        completedCount={completedCount}
        failedCount={failedCount}
        status={status}
        collapsed={collapsed}
        onCollapsedChange={toggle}
        data-testid="sub-agent-feed-tree-header"
      />
      {!collapsed && (
        <div className="space-y-1.5 border-t px-2 py-2">
          {subagents.map((subagent) => (
            <SubAgentTaskTree
              key={subagent.id}
              subagent={subagent}
              data-testid={`sub-agent-feed-tree-node-${subagent.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * SubAgentActivityFeed - 子 Agent 活动流
 * 显示 Agentic 模式下每个子智能体的实时活动(步骤级 + token 级流式)
 *
 * 两种渲染分支:
 * 1. treeMode=true(2026-07-28 立):3 层树形嵌套 — 批次(BatchHeader)→ 子代理(SubAgentTaskTree)→ 工具调用(Checklist)
 * 2. treeMode=false(默认,向后兼容):简单 SubAgentCard 列表
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
  treeMode = false,
}: SubAgentActivityFeedProps) {
  const t = useTranslations('ai.subAgentFeed')
  const ts = useTranslations('ai.status')

  // treeMode 分支:直接走树形渲染
  if (treeMode) {
    return (
      <TreeModeBatch
        activities={activities}
        completed={completed}
        defaultCollapsed={initiallyExpanded === false}
      />
    )
  }

  // 原行为(向后兼容):外层折叠面板 + 简单 SubAgentCard 列表
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
