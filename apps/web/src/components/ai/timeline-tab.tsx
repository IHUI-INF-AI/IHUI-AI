'use client'

/**
 * TimelineTab — Trae Work 风格 Timeline tab 切换容器(Phase 19.2,2026-07-28 立)
 *
 * 保留 inline 显示 + 新增 timeline 视图,通过 tab 切换。
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { TimelineEventItem } from './timeline-event'
import type { TimelineEvent, TimelineTabName as _TimelineTabName } from '@/stores/timeline-store'

export type { TimelineEvent, TimelineTabName } from '@/stores/timeline-store'

interface TimelineTabProps {
  events: TimelineEvent[]
  /** 默认 tab */
  defaultTab?: TimelineTabName
  /** inline 模式内容(对话流) */
  inlineContent?: React.ReactNode
  /** 点击事件 */
  onEventClick?: (event: TimelineEvent) => void
  /** 当前 tab(受控) */
  activeTab?: TimelineTabName
  /** 高度限制(可滚动) */
  maxHeight?: number
  onTabChange?: (tab: TimelineTabName) => void
  className?: string
}

export const TimelineTab = React.memo(function TimelineTab({
  events,
  defaultTab = 'inline',
  inlineContent,
  onEventClick,
  activeTab: activeTabProp,
  maxHeight = 600,
  onTabChange,
  className,
}: TimelineTabProps) {
  const [internalTab, setInternalTab] = React.useState<TimelineTabName>(defaultTab)
  const activeTab = activeTabProp ?? internalTab

  const setTab = (tab: TimelineTabName) => {
    if (activeTabProp === undefined) setInternalTab(tab)
    onTabChange?.(tab)
  }

  return (
    <div className={cn('flex h-full flex-col', className)} data-testid="timeline-tab">
      <div
        role="tablist"
        aria-label="Timeline tab"
        className="flex shrink-0 items-center gap-1 border-b border-border/40 px-2 py-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inline'}
          onClick={() => setTab('inline')}
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
            activeTab === 'inline'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-accent/40',
          )}
          data-testid="tab-inline"
        >
          对话流
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setTab('timeline')}
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
            activeTab === 'timeline'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-accent/40',
          )}
          data-testid="tab-timeline"
        >
          时间线
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ maxHeight }}
        role="tabpanel"
      >
        {activeTab === 'inline' ? (
          <div className="p-2">{inlineContent}</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center text-[11px] text-muted-foreground/60">
            暂无时间线事件
          </div>
        ) : (
          <div className="px-2 py-1">
            {events.map((e) => (
              <TimelineEventItem key={e.id} event={e} onClick={onEventClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default TimelineTab
