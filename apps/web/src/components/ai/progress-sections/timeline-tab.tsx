'use client'

import * as React from 'react'
import { MessageSquare, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore, type TimelineEvent, type TimelineTabName } from '@/stores/timeline-store'
import { TimelineEventRow } from './timeline-event'
import { useTranslations } from 'next-intl'

/**
 * TimelineTab — 时间线 tab 容器(2026-07-28 立,Trae Work 对齐)
 *
 * 设计:
 * - 提供"对话流"和"时间线"两个 tab 切换
 * - 时间线视图:统一展平 Plan/Subagent/Question/Tool/Thinking/Reference 6 类事件
 * - tab 状态通过 timeline-store 管理(全局共享)
 * - 顶部 sticky tab 切换器(在弹层内)
 *
 * 用法:
 * - 主对话流(对话流 tab):挂载在 message-list 顶部,显示 inline 流
 * - 时间线 tab:挂载在独立弹层/侧栏,显示展平事件
 *
 * 默认两 tab 都用同一个 events 源(从 timeline-store.events 取)
 */

interface TimelineTabProps {
  /** Tab 切换器是否显示(true=独立弹层, false=内联挂载只显示事件) */
  showTabs?: boolean
  className?: string
  /** 空状态文案 */
  emptyText?: string
  'data-testid'?: string
}

const TABS: Array<{ id: TimelineTabName; labelKey: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'inline', labelKey: 'tabInline', Icon: MessageSquare },
  { id: 'timeline', labelKey: 'tabTimeline', Icon: ListTree },
]

export const TimelineTab = React.memo(function TimelineTab({
  showTabs = true,
  className,
  emptyText = '暂无事件',
  'data-testid': testId,
}: TimelineTabProps) {
  const t = useTranslations('ai.timeline')
  const activeTab = useTimelineStore((s) => s.activeTab)
  const setActiveTab = useTimelineStore((s) => s.setActiveTab)
  const events = useTimelineStore((s) => s.events)

  if (!showTabs) {
    // 纯事件列表模式
    if (events.length === 0) {
      return (
        <div
          className={cn('flex items-center justify-center py-4 text-[10px] text-muted-foreground/60', className)}
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
      {/* Tab 切换器(sticky) */}
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
              {t(tab.labelKey)}
            </button>
          )
        })}
        {events.length > 0 && (
          <span className="ml-auto shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {events.length}
          </span>
        )}
      </div>
      {/* 内容区 */}
      <div
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {activeTab === 'inline' ? (
          // inline tab:展示对话流(空状态,因为 inline 在 message-list 主区显示)
          <div className="px-2 py-2 text-[10px] text-muted-foreground/60">
            {t('inlineHint')}
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

/** Helper:将 Plan/Subagent/Question/Tool 列表展平为 TimelineEvent[] */
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

  // 按时间戳排序
  events.sort((a, b) => {
    const ta = Date.parse(a.timestamp) || 0
    const tb = Date.parse(b.timestamp) || 0
    return ta - tb
  })

  return events
}

export default TimelineTab
