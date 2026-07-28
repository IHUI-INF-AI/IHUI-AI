'use client'

import * as React from 'react'
import { MessageSquare, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore, type TimelineEvent, type TimelineTabName } from '@/stores/timeline-store'
import { TimelineEventRow } from './timeline-event'

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
  const activeTab = useTimelineStore((s) => s.activeTab)
  const setActiveTab = useTimelineStore((s) => s.setActiveTab)
  const events = useTimelineStore((s) => s.events)

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
        aria-label="时间线 tab 切换"
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
          <span className="ml-auto shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {events.length}
          </span>
        )}
      </div>
      <div
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {activeTab === 'inline' ? (
          <div className="px-2 py-2 text-[10px] text-muted-foreground/60">
            对话流内联展示(在主消息列表中显示)
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-[10px] text-muted-foreground/60">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-0.5" data-testid="timeline-events">
            {events.map((evt) => (
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
        status: p.status as TimelineEvent['status'],
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
        status: s.status as TimelineEvent['status'],
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
