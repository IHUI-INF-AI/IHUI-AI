// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bug, Code2, DraftingCompass, Eye, LayoutGrid, List, Search, Users } from 'lucide-react'
import { humanizeToolText } from '@ihui/shared/chat'

import { cn } from '@/lib/utils'
import {
  StreamCode,
  StreamDetail,
  StreamGroup,
  StreamLabel,
  StreamRow,
  StreamTag,
  useLiveElapsed,
  useStreamStatusLabel,
  type StreamStatus,
} from '@/components/chat/stream/stream-ui'
import type { SubAgentActivity, AgentStatus } from './types'
import { MarkdownStream } from './markdown-stream'

interface SubAgentActivityFeedProps {
  swarmId: string
  activities: SubAgentActivity[]
  completed?: boolean
  initiallyExpanded?: boolean
}

/**
 * 子代理状态词汇 → 消息流统一状态语义(唯一自配的映射:AgentStatus 是十个业务态,
 * 基元只认五种)。状态词与图标一律由基元出 —— `useStreamStatusLabel()(agentStreamStatus(a))`
 * + `StreamStatusIcon`(在 StreamRow / StreamGroup 内部),本文件不再维护第二张文案表。
 */
const AGENT_STREAM_STATUS: Record<AgentStatus, StreamStatus> = {
  idle: 'pending',
  pending: 'pending',
  waiting: 'pending',
  thinking: 'running',
  acting: 'running',
  reflecting: 'running',
  running: 'running',
  completed: 'success',
  failed: 'error',
  cancelled: 'skipped',
}

function agentStreamStatus(agent: SubAgentActivity): StreamStatus {
  return AGENT_STREAM_STATUS[agent.status]
}

function isAgentActive(agent: SubAgentActivity): boolean {
  return agent.status !== 'completed' && agent.status !== 'failed' && agent.status !== 'cancelled'
}

/**
 * 已记录步骤的时间跨度(毫秒)作为耗时口径:子代理事件不下发 durationMs,
 * 首末步骤时间戳之差是当前能拿到的最诚实的估计;不足 1s 或不可解析则不显示。
 */
function stepSpanMs(agent: SubAgentActivity): number | null {
  const steps = agent.completedSteps
  if (steps.length === 0) return null
  const first = steps[0]
  const last = steps[steps.length - 1]
  if (!first || !last) return null
  const start = Date.parse(first.createdAt)
  const end = Date.parse(last.createdAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 1000) return null
  return end - start
}

// =============================================================================
// W26 Expert Team Canvas(2026-09-14 立,对标 Qoder 专家团队泳道画布):
// - 6 条专家泳道:researcher/coder/reviewer/architect/debugger 五个已知角色 + general 兜底
// - 泳道内并行展示各专家实时状态(统一走 StreamRow,与工具卡同一字号/圆角/状态色)
// - 选中某条泳道成员后,下方展开该专家的步骤流 + token 级流式详情
// =============================================================================

type ExpertLaneKey = 'researcher' | 'coder' | 'reviewer' | 'architect' | 'debugger' | 'general'

const EXPERT_LANES: Array<{
  key: ExpertLaneKey
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'researcher', icon: Search },
  { key: 'coder', icon: Code2 },
  { key: 'reviewer', icon: Eye },
  { key: 'architect', icon: DraftingCompass },
  { key: 'debugger', icon: Bug },
  { key: 'general', icon: Users },
]

/** 未知/worker 类型归入 general 兜底泳道;按 name/type 关键词匹配五类专家 */
function resolveLane(agent: SubAgentActivity): ExpertLaneKey {
  const hay = `${agent.type} ${agent.name}`.toLowerCase()
  for (const lane of EXPERT_LANES) {
    if (lane.key !== 'general' && hay.includes(lane.key)) return lane.key
  }
  return 'general'
}

interface SubAgentCardProps {
  agent: SubAgentActivity
  /** 覆盖行 testid 前缀(泳道选中态与列表视图需要区分) */
  testIdPrefix?: string
}

/**
 * 单个子代理:一行 StreamRow + 展开后的步骤流/流式输出。
 * 运行中或有流式输出时自动展开;用户手动折叠后不会被强行重开。
 */
function SubAgentCard({ agent, testIdPrefix = 'subagent-card' }: SubAgentCardProps) {
  const t = useTranslations('ai.subAgentFeed')
  const tStatus = useTranslations('taskStatus')
  const active = isAgentActive(agent)
  const streaming = agent.streamingContent
  const hasStreaming = !!streaming && streaming.length > 0
  const [open, setOpen] = React.useState(active || hasStreaming)

  // open 用 ref 读取:避免把 open 加入 deps 后,用户手动折叠会触发 effect 立即重开
  const openRef = React.useRef(open)
  openRef.current = open

  // 流式开始或 agent 转为运行中时自动展开
  React.useEffect(() => {
    if ((active || hasStreaming) && !openRef.current) setOpen(true)
  }, [active, hasStreaming])

  const status = agentStreamStatus(agent)
  const statusLabel = useStreamStatusLabel()
  const elapsedMs = useLiveElapsed(active, stepSpanMs(agent))
  const steps = agent.completedSteps.length
  const name = agent.name || t('defaultName')
  const tags =
    agent.progressIteration !== undefined && agent.progressIteration > 1
      ? [tStatus('roundNumber', { n: agent.progressIteration })]
      : undefined
  const metaParts = [
    steps > 0 ? tStatus('stepCount', { n: steps }) : null,
    agent.toolCallsCount !== undefined && agent.toolCallsCount > 0
      ? tStatus('toolCallCount', { n: agent.toolCallsCount })
      : null,
  ].filter((part): part is string => part !== null)
  const rowAriaLabel = [name, agent.type, statusLabel(status), ...metaParts]
    .filter((part) => part !== '')
    .join(' · ')

  return (
    <div className="min-w-0">
      <StreamRow
        status={status}
        title={name}
        subject={agent.type || undefined}
        subjectKind="name"
        meta={metaParts.join(' · ')}
        tags={tags}
        elapsedMs={elapsedMs}
        onClick={() => setOpen((v) => !v)}
        expanded={open}
        ariaLabel={rowAriaLabel}
        testId={`${testIdPrefix}-${agent.agentId}`}
      />
      {open && (steps > 0 || !!agent.currentStep || hasStreaming || !!agent.outputPreview) && (
        <StreamDetail
          className="animate-in fade-in-0 slide-in-from-top-1 duration-150"
          testId={`${testIdPrefix}-detail-${agent.agentId}`}
        >
          {(steps > 0 || (agent.currentStep && active)) && (
            <div className="space-y-0.5">
              {agent.completedSteps.map((step, i) => (
                <StreamRow
                  key={`${agent.agentId}-${i}-${step.createdAt}`}
                  status={step.status === 'failed' ? 'error' : 'success'}
                  title={humanizeToolText(step.stepAction, tStatus)}
                  subjectKind="none"
                  testId={`${testIdPrefix}-step-${agent.agentId}-${i}`}
                />
              ))}
              {agent.currentStep && active && (
                <StreamRow
                  status="running"
                  title={humanizeToolText(agent.currentStep, tStatus)}
                  tags={tags}
                  testId={`${testIdPrefix}-current-${agent.agentId}`}
                />
              )}
            </div>
          )}
          {agent.outputPreview && active && (
            <>
              <StreamLabel>{tStatus('resultLabel')}</StreamLabel>
              <StreamCode text={agent.outputPreview} />
            </>
          )}
          {hasStreaming && streaming && (
            <div className="rounded-sm bg-background/60 p-1.5">
              <MarkdownStream content={streaming} isStreaming={!agent.streamingDone} />
            </div>
          )}
        </StreamDetail>
      )}
    </div>
  )
}

/**
 * SubAgentActivityFeed - 子代理活动流
 * 显示 Agentic 模式下每个子智能体的实时活动(步骤级 + token 级流式)。
 * 2026-09-22 统一:所有行改走 stream-ui 基元(字号/圆角/状态色与工具卡一致),
 * 界面不再出现 subagent / running / pending 等英文状态码。
 */
export function SubAgentActivityFeed({
  swarmId: _swarmId,
  activities,
  completed = false,
  initiallyExpanded,
}: SubAgentActivityFeedProps) {
  const t = useTranslations('ai.subAgentFeed')
  const tStatus = useTranslations('taskStatus')
  const hasRunning = activities.some(isAgentActive)
  const [expanded, setExpanded] = React.useState(initiallyExpanded ?? (hasRunning && !completed))
  // W26:canvas=泳道画布(默认)/ feed=传统列表
  const [view, setView] = React.useState<'canvas' | 'feed'>('canvas')
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null)

  const totalSteps = activities.reduce((sum, a) => sum + a.completedSteps.length, 0)
  const groupDoneMs = React.useMemo(() => {
    if (activities.length === 0) return null
    const spans = activities.map(stepSpanMs).filter((v): v is number => v !== null)
    if (spans.length === 0) return null
    return Math.max(...spans)
  }, [activities])

  // 泳道分组(画布视图)
  const lanes = React.useMemo(() => {
    const map = new Map<ExpertLaneKey, SubAgentActivity[]>()
    for (const lane of EXPERT_LANES) map.set(lane.key, [])
    for (const a of activities) {
      map.get(resolveLane(a))?.push(a)
    }
    return map
  }, [activities])

  const selected = activities.find((a) => a.agentId === selectedAgentId) ?? null
  const headline = completed
    ? t('coordinated', { count: activities.length })
    : t('working', { count: activities.length })

  // 视图切换控件:作为 StreamGroup 的 headerExtra(在组头触发器**外面**,避免按钮套按钮)
  const viewToggle = (
    <span
      role="radiogroup"
      aria-label={t('viewToggle')}
      className="flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={view === 'canvas'}
        aria-label={t('viewCanvas')}
        data-testid="subagent-view-canvas"
        onClick={() => setView('canvas')}
        className={cn(
          'rounded-sm p-0.5 transition-colors',
          view === 'canvas'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground/60 hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === 'feed'}
        aria-label={t('viewFeed')}
        data-testid="subagent-view-feed"
        onClick={() => setView('feed')}
        className={cn(
          'rounded-sm p-0.5 transition-colors',
          view === 'feed'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground/60 hover:text-foreground',
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </span>
  )

  return (
    <div className="min-w-0" data-testid="sub-agent-activity-feed">
      <StreamGroup
        active={hasRunning && !completed}
        stepCount={totalSteps}
        headline={headline}
        elapsedMs={groupDoneMs}
        open={expanded}
        onOpenChange={setExpanded}
        ariaLabel={headline}
        headerExtra={viewToggle}
        testId="subagent-feed"
      >
        {view === 'canvas' && (
          <div data-testid="subagent-canvas" className="pl-1">
            {/* 6 类专家泳道并行(窄屏 2 列,中屏 3 列,宽屏 6 列) */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
              {EXPERT_LANES.map((lane) => {
                const members = lanes.get(lane.key) ?? []
                const Icon = lane.icon
                return (
                  <div
                    key={lane.key}
                    data-testid={`subagent-lane-${lane.key}`}
                    className="min-w-0 rounded-md border border-border/30 bg-card/60 p-1.5"
                  >
                    <div className="mb-1 flex h-6 items-center gap-1.5 text-xs leading-none">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-foreground/80">
                        {t(`lane.${lane.key}`)}
                      </span>
                      {members.length > 0 && (
                        <StreamTag tone="neutral" testId={`subagent-lane-count-${lane.key}`}>
                          {members.length}
                        </StreamTag>
                      )}
                    </div>
                    {members.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/45">{t('laneEmpty')}</p>
                    ) : (
                      <div className="space-y-0.5">
                        {members.map((agent, i) => (
                          <StreamRow
                            key={agent.agentId}
                            status={agentStreamStatus(agent)}
                            title={agent.name || t('defaultName')}
                            subject={
                              // 进行中的子代理把"此刻在做什么"顶到对象位(单行截断),
                              // 空闲/已结束的显示职责类型
                              isAgentActive(agent) && agent.currentStep
                                ? humanizeToolText(agent.currentStep, tStatus)
                                : agent.type
                            }
                            subjectKind="name"
                            metricKind="none"
                            meta={
                              agent.toolCallsCount !== undefined && agent.toolCallsCount > 0
                                ? tStatus('toolCallCount', { n: agent.toolCallsCount })
                                : undefined
                            }
                            elapsedMs={
                              // 泳道紧凑视图不做实时 tick(展开详情里才有),
                              // 已结束的子代理按步骤时间跨度显示耗时
                              isAgentActive(agent) ? undefined : (stepSpanMs(agent) ?? undefined)
                            }
                            onClick={() =>
                              setSelectedAgentId((cur) =>
                                cur === agent.agentId ? null : agent.agentId,
                              )
                            }
                            expanded={selectedAgentId === agent.agentId}
                            testId={`subagent-lane-agent-${lane.key}-${i}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* 选中的 agent 详情:步骤流 + Markdown 流式 */}
            {selected && (
              <div data-testid="subagent-canvas-detail" className="mt-1.5">
                <SubAgentCard agent={selected} testIdPrefix="subagent-canvas-card" />
              </div>
            )}
          </div>
        )}

        {view === 'feed' && (
          <div className="space-y-0.5 pl-1">
            {activities.map((agent) => (
              <SubAgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        )}
      </StreamGroup>
    </div>
  )
}

export default SubAgentActivityFeed
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
