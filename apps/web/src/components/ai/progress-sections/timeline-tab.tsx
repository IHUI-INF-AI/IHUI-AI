'use client'

import * as React from 'react'
import { MessageSquare, ListTree, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  useTimelineStore,
  type TimelineEvent,
  type TimelineEventStatus,
  type TimelineEventType,
  type TimelineTabName,
} from '@/stores/timeline-store'
import { TimelineEventRow } from './timeline-event'

/** PlanStep.status → TimelineEventStatus 映射(2026-07-28 立,消除 unsafe cast) */
function planStatusToTimelineStatus(s: string): TimelineEventStatus {
  if (s === 'in_progress') return 'running'
  if (s === 'completed') return 'done'
  return 'pending'
}

/** Subagent.status → TimelineEventStatus 映射(2026-07-28 立) */
function subagentStatusToTimelineStatus(s: string): TimelineEventStatus {
  if (s === 'spawned' || s === 'running') return 'running'
  if (s === 'done') return 'done'
  if (s === 'failed' || s === 'dead') return 'failed'
  return 'pending'
}

// ─── 类型过滤 + 搜索相关类型与常量(Trae Work 对齐,2026-07-28 立) ──

/** 类型过滤 id('all' 是虚拟值,表示不过滤) */
type TypeFilter = 'all' | TimelineEventType

/** 类型过滤 chip 配置(i18n key + 英文 fallback,i18n 5 语言补完不在本任务) */
const TYPE_FILTERS: ReadonlyArray<{
  id: TypeFilter
  key: string
  fallback: string
}> = [
  { id: 'all', key: 'timelineFilterAll', fallback: 'All' },
  { id: 'plan', key: 'timelineFilterPlan', fallback: 'Plan' },
  { id: 'subagent', key: 'timelineFilterSubagent', fallback: 'Subagent' },
  { id: 'tool', key: 'timelineFilterTool', fallback: 'Tool' },
  { id: 'question', key: 'timelineFilterQuestion', fallback: 'Question' },
]

// ─── i18n 动态 key 包装(2026-07-28 立) ─────────────────────────────

const warnedTimelineKeys = new Set<string>()

type LooseTranslator = (key: string) => string

/**
 * 动态 key 访问包装:next-intl 的 useTranslations 返回字面量联合类型,
 * 动态 key 必须用 `as unknown as` 绕过类型(2026-07-28 立)。
 * FIXME(any): 用于支持新加的 ai.pane.timeline.* key,
 *             i18n 5 语言补完任务应改为显式 key 类型(消除 unsafe 断言)
 */
function safeT(
  t: ReturnType<typeof useTranslations<'ai.pane'>>,
  key: string,
  fallback: string,
): string {
  const looseT = t as unknown as LooseTranslator
  const v = looseT(key)
  if (v === key || !v) {
    if (!warnedTimelineKeys.has(key)) {
      warnedTimelineKeys.add(key)
      // eslint-disable-next-line no-console
      console.warn(
        `[timeline-tab] i18n key 'ai.pane.${key}' missing, using fallback: "${fallback}"`,
      )
    }
    return fallback
  }
  return v
}

// ─── 过滤逻辑(纯函数,便于单测) ──────────────────────────────────

/** 按 type 过滤事件(顶层事件;children 不参与过滤) */
function filterByType(events: TimelineEvent[], filter: TypeFilter): TimelineEvent[] {
  if (filter === 'all') return events
  return events.filter((e) => e.type === filter)
}

/**
 * 按 search 模糊匹配 title/description(大小写不敏感)
 * 空 query 短路返回原引用(避免 useMemo 引用变化)
 */
function filterBySearch(events: TimelineEvent[], query: string): TimelineEvent[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return events
  return events.filter((e) => {
    if (e.title.toLowerCase().includes(q)) return true
    if (e.description && e.description.toLowerCase().includes(q)) return true
    return false
  })
}

/** 统计各 type 的事件数 */
function countByType(events: TimelineEvent[]): Record<TimelineEventType, number> {
  const counts: Record<TimelineEventType, number> = {
    plan: 0,
    subagent: 0,
    question: 0,
    tool: 0,
    thinking: 0,
    reference: 0,
  }
  for (const e of events) counts[e.type]++
  return counts
}

/** 统计各 status 的事件数(用于右侧 chip) */
function countByStatus(events: TimelineEvent[]): {
  done: number
  failed: number
  running: number
  pending: number
} {
  const c = { done: 0, failed: 0, running: 0, pending: 0 }
  for (const e of events) c[e.status]++
  return c
}

// ─── Tab 配置 ─────────────────────────────────────────────────────

interface TimelineTabProps {
  showTabs?: boolean
  className?: string
  emptyText?: string
  'data-testid'?: string
}

const TABS: Array<{
  id: TimelineTabName
  label: string
  Icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'inline', label: '对话流', Icon: MessageSquare },
  { id: 'timeline', label: '时间线', Icon: ListTree },
]

export const TimelineTab = React.memo(function TimelineTab({
  showTabs = true,
  className,
  emptyText = '暂无事件',
  'data-testid': testId,
}: TimelineTabProps) {
  const t = useTranslations('ai.pane')
  const activeTab = useTimelineStore((s) => s.activeTab)
  const setActiveTab = useTimelineStore((s) => s.setActiveTab)
  const events = useTimelineStore((s) => s.events)

  // 类型过滤 + 搜索 state(showTabs=false 时 UI 不展示,但 state 仍初始化,保持单一渲染路径)
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = React.useState<string>('')

  // 派生数据(过滤是派生计算,不放进 store,避免污染全局)
  const typeCounts = React.useMemo(() => countByType(events), [events])
  const statusCounts = React.useMemo(() => countByStatus(events), [events])
  const filteredEvents = React.useMemo(
    () => filterBySearch(filterByType(events, typeFilter), searchQuery),
    [events, typeFilter, searchQuery],
  )

  const hasFilterActive = typeFilter !== 'all' || searchQuery.length > 0
  const clearFilters = React.useCallback(() => {
    setTypeFilter('all')
    setSearchQuery('')
  }, [])

  // showTabs=false:简洁路径(agent-task-progress-pane 调用,保持向后兼容)
  if (!showTabs) {
    if (events.length === 0) {
      return (
        <div
          className={cn(
            'flex items-center justify-center py-4 text-[10px] text-muted-foreground/60',
            className,
          )}
          data-testid={testId ?? 'timeline-events'}
        >
          {emptyText}
        </div>
      )
    }
    return (
      <div className={cn('space-y-0.5', className)} data-testid={testId ?? 'timeline-events'}>
        {events.map((evt) => (
          <TimelineEventRow key={evt.id} event={evt} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex h-full flex-col', className)} data-testid={testId ?? 'timeline-tab'}>
      <div
        className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-muted/30 px-2 py-1"
        role="tablist"
        aria-label={safeT(t, 'timelineTabsAriaLabel', '时间线 tab 切换')}
      >
        {TABS.map((tab) => {
          const Icon = tab.Icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`tab-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground',
              )}
              data-testid={`timeline-tab-${tab.id}`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {tab.label}
            </button>
          )
        })}
        {events.length > 0 && (
          <span
            className="ml-auto shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80"
            data-testid="timeline-total-count"
          >
            {events.length}
          </span>
        )}
      </div>

      {/* Filter row(只在有事件时显示) */}
      {events.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/40 bg-background/30 px-2 py-1"
          data-testid="timeline-filter-row"
        >
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.id
            const count = f.id === 'all' ? events.length : (typeCounts[f.id] ?? 0)
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 rounded-sm border px-1.5 py-0.5 text-[10px] tabular-nums transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-transparent text-muted-foreground/70 hover:border-border/60 hover:bg-accent/30 hover:text-foreground',
                )}
                data-testid={`timeline-filter-${f.id}`}
              >
                <span>{safeT(t, f.key, f.fallback)}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-sm px-0.5 text-[9px]',
                    active
                      ? 'bg-primary/20 text-foreground/80'
                      : 'bg-muted text-muted-foreground/70',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
          {/* 状态计数 chip(右侧,count>0 才显示) */}
          <div
            className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums"
            data-testid="timeline-status-counts"
          >
            {statusCounts.done > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-emerald-500"
                data-testid="timeline-count-done"
                title={safeT(t, 'timelineCountDone', 'Completed')}
              >
                <span aria-hidden>✓</span>
                <span>{statusCounts.done}</span>
              </span>
            )}
            {statusCounts.failed > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-destructive"
                data-testid="timeline-count-failed"
                title={safeT(t, 'timelineCountFailed', 'Failed')}
              >
                <span aria-hidden>⚠</span>
                <span>{statusCounts.failed}</span>
              </span>
            )}
            {statusCounts.running > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-primary"
                data-testid="timeline-count-running"
                title={safeT(t, 'timelineCountRunning', 'Running')}
              >
                <span aria-hidden>⏳</span>
                <span>{statusCounts.running}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search row(只在有事件时显示) */}
      {events.length > 0 && (
        <div
          className="relative shrink-0 border-b border-border/40 px-2 py-1"
          data-testid="timeline-search-row"
        >
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={safeT(t, 'timelineSearchPlaceholder', 'Search timeline...')}
            aria-label={safeT(t, 'timelineSearchAriaLabel', 'Search timeline events')}
            className="w-full rounded-sm border border-border/60 bg-background/40 py-0.5 pl-6 pr-6 text-[10px] placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            data-testid="timeline-search-input"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={safeT(t, 'timelineSearchClear', 'Clear search')}
              className="absolute right-3.5 top-1/2 inline-flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-foreground"
              data-testid="timeline-search-clear"
            >
              <X className="h-2.5 w-2.5" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {activeTab === 'inline' ? (
          <div
            className="px-2 py-2 text-[10px] text-muted-foreground/60"
            data-testid="timeline-inline-hint"
          >
            {safeT(t, 'timelineInlineHint', '对话流内联展示(在主消息列表中显示)')}
          </div>
        ) : events.length === 0 ? (
          <div
            className="flex items-center justify-center py-4 text-[10px] text-muted-foreground/60"
            data-testid="timeline-empty"
          >
            {emptyText}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div
            className="flex flex-col items-center gap-1 px-2 py-4 text-center"
            data-testid="timeline-no-match"
          >
            <span className="text-[10px] text-muted-foreground/60">
              {safeT(t, 'timelineNoMatch', 'No events match the current filter')}
            </span>
            {hasFilterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] text-primary transition-colors hover:underline"
                data-testid="timeline-clear-filters"
              >
                {safeT(t, 'timelineClearFilters', 'Clear filters')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5" data-testid="timeline-events">
            {filteredEvents.map((evt) => (
              <TimelineEventRow key={evt.id} event={evt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export function flattenToTimelineEvents(input: {
  plans?: Array<{
    id: string
    step: string
    status: string
    timestamp: string
    explanation?: string
  }>
  subagents?: Array<{
    id: string
    nickname: string
    handle: string
    status: string
    spawnedAt: string
    currentTask?: string
  }>
  tools?: Array<{
    id: string
    toolName: string
    status: string
    startedAt: string
    durationMs?: number
  }>
  questions?: Array<{
    id: string
    question: string
    answered?: boolean
    timestamp: string
  }>
}): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (input.plans) {
    for (const p of input.plans) {
      events.push({
        id: p.id,
        type: 'plan',
        timestamp: p.timestamp,
        title: p.step,
        description: p.explanation,
        status: planStatusToTimelineStatus(p.status),
      })
    }
  }

  if (input.subagents) {
    for (const s of input.subagents) {
      events.push({
        id: s.id,
        type: 'subagent',
        timestamp: s.spawnedAt,
        title: `${s.handle} · ${s.currentTask ?? s.nickname}`,
        status: subagentStatusToTimelineStatus(s.status),
      })
    }
  }

  if (input.tools) {
    for (const t of input.tools) {
      events.push({
        id: t.id,
        type: 'tool',
        timestamp: t.startedAt,
        title: t.toolName,
        description: t.durationMs ? `${t.durationMs}ms` : undefined,
        status: t.status === 'success' ? 'done' : t.status === 'error' ? 'failed' : 'running',
      })
    }
  }

  if (input.questions) {
    for (const q of input.questions) {
      events.push({
        id: q.id,
        type: 'question',
        timestamp: q.timestamp,
        title: q.question,
        status: q.answered ? 'done' : 'pending',
      })
    }
  }

  events.sort((a, b) => {
    const ta = Date.parse(a.timestamp) || 0
    const tb = Date.parse(b.timestamp) || 0
    return ta - tb
  })

  return events
}

export default TimelineTab
