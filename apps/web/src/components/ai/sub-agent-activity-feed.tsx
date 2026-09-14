// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  DraftingCompass,
  Eye,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Users,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
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
  return agent.status !== 'completed' && agent.status !== 'failed' && agent.status !== 'cancelled'
}

// =============================================================================
// W26 Expert Team Canvas(2026-09-14 立,对标 Qoder 专家团队泳道画布):
// - 6 条专家泳道:researcher/coder/reviewer/architect/debugger 五个已知角色 + general 兜底
// - 泳道内并行展示各专家实时状态(状态点/当前步骤/工具调用计数)
// - 产物缩略:outputPreview / streamingContent 首行以 FileText 芯片呈现,点击选中展开详情
// =============================================================================

type ExpertLaneKey = 'researcher' | 'coder' | 'reviewer' | 'architect' | 'debugger' | 'general'

const EXPERT_LANES: Array<{ key: ExpertLaneKey; icon: React.ComponentType<{ className?: string }> }> = [
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

/** 产物缩略文本:优先 outputPreview,回退 streamingContent 首行,截断 60 字符 */
function artifactThumb(agent: SubAgentActivity): string | undefined {
  const raw = agent.outputPreview || agent.streamingContent?.split('\n').find((l) => l.trim())
  if (!raw) return undefined
  const line = raw.trim()
  return line.length > 60 ? `${line.slice(0, 60)}…` : line
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
      <Tooltip content={statusLabel}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 text-left"
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150',
              STATUS_DOT_COLOR[agent.status],
              active && 'animate-pulse',
            )}
          />
          <span className="font-medium text-foreground/80">
            {agent.name || agent.type || defaultName}
          </span>
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
      </Tooltip>

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
 * 显示 Agentic 模式下每个子智能体的实时活动(步骤级 + token 级流式)。
 * W26(2026-09-14):升级为 Expert Team Canvas —— 默认泳道画布视图(6 类专家并行,
 * 实时状态 + 产物缩略 + 点击展开详情),可切换回传统列表 feed 视图。
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
  // W26:canvas=泳道画布(默认)/ feed=传统列表
  const [view, setView] = React.useState<'canvas' | 'feed'>('canvas')
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null)

  const totalSteps = activities.reduce((sum, a) => sum + a.completedSteps.length, 0)

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
        <div className="flex items-center gap-1">
          {/* W26:画布 / 列表视图切换(阻止冒泡,不触发展开折叠) */}
          <span
            role="radiogroup"
            aria-label={t('viewToggle')}
            className="flex items-center gap-0.5 rounded-md border border-border/40 p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={view === 'canvas'}
              data-testid="subagent-view-canvas"
              onClick={(e) => {
                e.stopPropagation()
                setView('canvas')
              }}
              className={cn(
                'rounded-sm p-0.5 transition-colors',
                view === 'canvas'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === 'feed'}
              data-testid="subagent-view-feed"
              onClick={(e) => {
                e.stopPropagation()
                setView('feed')
              }}
              className={cn(
                'rounded-sm p-0.5 transition-colors',
                view === 'feed'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              <List className="h-3 w-3" />
            </button>
          </span>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          )}
        </div>
      </button>

      {expanded && view === 'canvas' && (
        <div data-testid="subagent-canvas" className="space-y-1.5 bg-muted/20 px-2 py-1.5">
          {/* 6 类专家泳道并行(窄屏 2 列,中屏 3 列,宽屏 6 列) */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
            {EXPERT_LANES.map((lane) => {
              const members = lanes.get(lane.key) ?? []
              const Icon = lane.icon
              const laneActive = members.some(isAgentActive)
              return (
                <div
                  key={lane.key}
                  data-testid={`subagent-lane-${lane.key}`}
                  className={cn(
                    'min-w-0 rounded-md border border-border/30 bg-card/60 p-1.5',
                    laneActive && 'border-primary/40',
                  )}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <Icon className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                    <span className="truncate text-[10px] font-medium text-foreground/80">
                      {t(`lane.${lane.key}`)}
                    </span>
                    {members.length > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-1 text-[9px] tabular-nums text-muted-foreground/70">
                        {members.length}
                      </span>
                    )}
                  </div>
                  {members.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground/40">{t('laneEmpty')}</p>
                  ) : (
                    <div className="space-y-1">
                      {members.map((agent, i) => {
                        const thumb = artifactThumb(agent)
                        const agentActive = isAgentActive(agent)
                        return (
                          <button
                            key={agent.agentId}
                            type="button"
                            data-testid={`subagent-lane-agent-${lane.key}-${i}`}
                            onClick={() =>
                              setSelectedAgentId((cur) => (cur === agent.agentId ? null : agent.agentId))
                            }
                            className={cn(
                              'w-full rounded-sm border px-1 py-0.5 text-left transition-colors',
                              selectedAgentId === agent.agentId
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:bg-accent/50',
                            )}
                          >
                            <span className="flex items-center gap-1">
                              <span
                                className={cn(
                                  'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150',
                                  STATUS_DOT_COLOR[agent.status],
                                  agentActive && 'animate-pulse',
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/80">
                                {agent.name || t('defaultName')}
                              </span>
                              {agent.toolCallsCount !== undefined && agent.toolCallsCount > 0 && (
                                <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
                                  {agent.toolCallsCount}
                                </span>
                              )}
                            </span>
                            {agent.currentStep && agentActive && (
                              <span className="mt-0.5 block truncate text-[9px] text-muted-foreground/60">
                                {agent.currentStep}
                              </span>
                            )}
                            {thumb && (
                              <span className="mt-0.5 flex items-center gap-0.5 rounded-sm bg-muted/40 px-1 py-0.5 text-[9px] text-muted-foreground/70">
                                <FileText className="h-2 w-2 shrink-0" />
                                <span className="min-w-0 flex-1 truncate">{thumb}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* 选中的 agent 详情:复用既有 SubAgentCard(步骤流 + Markdown 流式) */}
          {selected && (
            <div data-testid="subagent-canvas-detail" className="rounded-md border border-border/30 bg-card/60 p-1.5">
              <SubAgentCard
                agent={selected}
                badgeLabel={t('badge')}
                defaultName={t('defaultName')}
                statusLabel={ts(selected.status)}
              />
            </div>
          )}
        </div>
      )}

      {expanded && view === 'feed' && (
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
