'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  useTimelineStore,
  type TimelineEvent,
  type TimelineTabName,
} from '@/stores/timeline-store'
import { TimelineEventItem } from './timeline-event'

/**
 * TimelineTab — "对话流 / 时间线" 双视图切换容器(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 提供 inline 和 timeline 两种视图
 * - inline 视图:主对话流
 * - timeline 视图:展平所有事件
 * - tab 状态通过 store 持久化(下次进入用户偏好)
 */

interface TimelineTabProps {
  events: TimelineEvent[]
  defaultTab?: TimelineTabName
  inlineContent?: React.ReactNode
  onEventClick?: (event: TimelineEvent) => void
  activeTab?: TimelineTabName
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
  const storeActiveTab = useTimelineStore((s) => s.activeTab)
  const setStoreActiveTab = useTimelineStore((s) => s.setActiveTab)

  const [internalTab, setInternalTab] = React.useState<TimelineTabName>(defaultTab)
  // 优先使用 prop,否则 store,否则 internal
  const activeTab = activeTabProp ?? storeActiveTab ?? internalTab

  const setTab = React.useCallback(
    (tab: TimelineTabName) => {
      if (activeTabProp === undefined) {
        setStoreActiveTab(tab)
        setInternalTab(tab)
      }
      onTabChange?.(tab)
    },
    [activeTabProp, setStoreActiveTab, onTabChange],
  )

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
        style={{ maxHeight } as React.CSSProperties}
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
