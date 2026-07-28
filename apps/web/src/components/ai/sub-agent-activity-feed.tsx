'use client'

/**
 * SubAgentActivityFeed - Trae Work 风格子 Agent 活动流(message-level)
 * 2026-07-28 Phase 18.2 重构为 Trae Work 风格:
 * - 单个 subagent 用 Trae 风格块(浅色背景 + 左侧强调条 + 标题栏 + 内容)
 * - 聚合卡显示总览 + 折叠/展开
 * - 完成后展示 Checked Items + Notes + Resource Usage
 * - 不再放在 AI 面板底部,而是 inline 在对话流中(随主 agent 消息渲染)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Zap, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SubAgentActivity, AgentStatus } from './types'
import { MarkdownStream } from './markdown-stream'
import { TraeBlock, CheckedItemsBlock, ProgressPointList, type TraeBlockTone } from './progress-sections/trae-block'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
  /** Trae Work 风格"对话流 inline 模式"(2026-07-28 立):无边框容器,直接 inline 在消息流中 */
  inline?: boolean
  /** 上下文 step budget(2026-07-28 立,Phase 18.4) */
  stepBudget?: { used: number; total: number }
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

/** Phase 18.2: 状态 → TraeBlock 颜色映射 */
function agentTone(agent: SubAgentActivity): TraeBlockTone {
  if (agent.status === 'failed') return 'error'
  if (agent.status === 'completed') return 'success'
  if (isAgentActive(agent)) return 'info'
  return 'muted'
}

interface SubAgentCardProps {
  agent: SubAgentActivity
  badgeLabel: string
  defaultName: string
  statusLabel: string
}

/**
 * 单个 subagent 卡片:Trae Work 风格块状元素
 * - 浅色背景 + 左侧 1px 强调条
 * - 标题栏:状态点 + 名称 + 角色徽章 + 状态文字 + chevron
 * - 内容区:步骤列表 + 工具调用计数 + 输出预览 + 流式 token 输出
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

  // 进度点列(完成步骤)
  const progressPoints = React.useMemo(
    () => [
      ...agent.completedSteps.map((s) => ({
        id: `done-${s.createdAt}-${s.stepAction}`,
        status: s.status === 'failed' ? ('error' as const) : ('success' as const),
        label: s.stepAction,
      })),
      ...(agent.currentStep && active
        ? [
            {
              id: `current-${agent.progressIteration ?? 0}-${agent.currentStep}`,
              status: 'running' as const,
              label: agent.currentStep,
              meta:
                agent.progressIteration !== undefined && agent.progressIteration > 1
                  ? `第 ${agent.progressIteration} 轮`
                  : undefined,
            },
          ]
        : []),
    ],
    [agent.completedSteps, agent.currentStep, agent.progressIteration, active],
  )

  return (
    <TraeBlock
      tone={agentTone(agent)}
      collapsible
      collapsed={!open}
      onCollapsedChange={setOpen}
      icon={<AgentStatusIcon status={agent.status} />}
      title={
        <span className="flex items-center gap-1.5">
          <span className="truncate">{agent.name || agent.type || defaultName}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[9px] text-muted-foreground">
            {badgeLabel}
          </span>
        </span>
      }
      meta={statusLabel}
      data-testid={`subagent-card-${agent.agentId}`}
    >
      <div className="space-y-1">
        {/* 进度点列(Trae Work 风格) */}
        {progressPoints.length > 0 && (
          <ProgressPointList points={progressPoints} />
        )}

        {/* 工具调用计数 + 输出预览 */}
        {agent.toolCallsCount !== undefined && agent.toolCallsCount > 0 && (
          <div className="text-[10px] tabular-nums text-muted-foreground/70">
            {agent.toolCallsCount} 次工具调用
          </div>
        )}
        {agent.outputPreview && active && (
          <div className="rounded-sm bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground/80 line-clamp-2">
            {agent.outputPreview}
          </div>
        )}

        {/* 流式 token 输出 */}
        {hasStreaming && streaming && (
          <div className="rounded-md bg-background/60 p-2">
            <MarkdownStream content={streaming} isStreaming={!agent.streamingDone} />
          </div>
        )}
      </div>
    </TraeBlock>
  )
}

function AgentStatusIcon({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        STATUS_DOT_COLOR[status],
        status === 'running' && 'animate-pulse',
      )}
      aria-hidden
    />
  )
}

/**
 * SubAgentActivityFeed - Trae Work 风格聚合卡
 * 截图特征:
 * - 顶部:Loader2/CheckCircle2/Zap 图标 + "Coordinated N agents" + 步骤统计 + chevron
 * - 展开后:每个 subagent 一张 Trae 风格块状卡片
 * - 全部完成后追加 CheckedItemsBlock(Result: PASS + 数量统计 + Notes)
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
  inline = false,
  stepBudget,
}: SubAgentActivityFeedProps) {
  const t = useTranslations('ai.subAgentFeed')
  const ts = useTranslations('ai.status')
  const hasRunning = activities.some(isAgentActive)
  const [expanded, setExpanded] = React.useState(initiallyExpanded ?? (hasRunning && !completed))

  const totalSteps = activities.reduce((sum, a) => sum + a.completedSteps.length, 0)
  const completedAgents = activities.filter((a) => a.status === 'completed').length
  const failedAgents = activities.filter((a) => a.status === 'failed').length

  // Phase 18.4: step budget 显示
  const budgetText = stepBudget
    ? `Current usage: ${stepBudget.used} / ${stepBudget.total} step budget`
    : undefined

  return (
    <div
      className={cn(
        inline ? 'space-y-1.5' : 'rounded-lg border bg-card',
        !inline && completed && 'border-emerald-500/30 bg-emerald-500/[0.03]',
      )}
    >
      {!inline && (
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
      )}

      {/* inline 模式:始终展开(无折叠,因为外层消息已有折叠) */}
      {inline && (
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <Users className="h-3 w-3" aria-hidden />
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
      )}

      {(expanded || inline) && (
        <div className={cn('space-y-1.5', !inline && 'border-t px-3 py-2')}>
          {activities.map((agent) => (
            <SubAgentCard
              key={agent.agentId}
              agent={agent}
              badgeLabel={t('badge')}
              defaultName={t('defaultName')}
              statusLabel={ts(agent.status)}
            />
          ))}

          {/* 全部完成时追加 CheckedItemsBlock(Trae Work 风格) */}
          {completed && activities.length > 0 && (
            <CheckedItemsBlock
              result={failedAgents > 0 ? 'FAIL' : 'PASS'}
              items={[
                ...(completedAgents > 0
                  ? [
                      {
                        index: 1,
                        title: `Coordinated ${completedAgents}/${activities.length} agents`,
                        evidence: `${completedAgents} completed, ${failedAgents} failed`,
                        passed: failedAgents === 0,
                      },
                    ]
                  : []),
                {
                  index: 2,
                  title: 'Aggregate step count',
                  evidence: `${totalSteps} total steps across all agents`,
                  passed: true,
                },
              ]}
              notes={
                failedAgents > 0
                  ? `${failedAgents} agent(s) failed, ${completedAgents} completed. See individual card for details.`
                  : 'All agents completed successfully. Step budget is within limits.'
              }
              resourceUsage={budgetText}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default SubAgentActivityFeed
