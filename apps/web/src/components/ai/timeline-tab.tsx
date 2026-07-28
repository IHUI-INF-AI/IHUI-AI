'use client'

/**
 * TimelineTab — Trae Work 风格 tab 切换容器(2026-07-28 立,Phase 20)
 *
 * 截图特征(Trae Work 消息流):
 * - 顶部 tab 切换条: [对话流] [时间线] 两个 tab
 * - 当前 tab 高亮(浅色背景)
 * - 切换有 fade 过渡
 * - 时间线视图可滚动 + 高度限制
 *
 * 行为策略:
 * - 保留 inline 模式(对话流),不破坏现有 SubAgentActivityFeed 渲染
 * - timeline 模式统一展平展示所有 plan/subagent/question/tool/thinking/reference 事件
 * - tab 状态可选受控(activeTab + onEventClick)或非受控(用 zustand store)
 * - 点击 timeline 事件可回调 onEventClick,用于双向跳转到 message
 */

import * as React from 'react'
import { ListTree, MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'
import { TimelineEventItem } from './timeline-event'
import {
  useTimelineStore,
  type TimelineEvent as TimelineEventData,
  type TimelineTab as TimelineTabValue,
} from '@/stores/timeline-store'

interface TimelineTabProps {
  events: TimelineEventData[]
  /** 当前激活的 messageId(高亮+滚动) */
  activeMessageId?: string | null
  /** 点击事件跳转 */
  onEventClick?: (event: TimelineEventData) => void
  /** 默认 tab(非受控) */
  defaultTab?: TimelineTabValue
  /** 受控 tab */
  activeTab?: TimelineTabValue
  /** 受控 tab 变化回调 */
  onTabChange?: (tab: TimelineTabValue) => void
  /** inline 模式内容(对话流) */
  inlineContent?: React.ReactNode
  /** 时间线视图最大高度(可滚动) */
  maxHeight?: number
  /** 自定义 tab label(可选 i18n) */
  inlineLabel?: string
  timelineLabel?: string
  className?: string
  'data-testid'?: string
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  testId,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  testId: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground/80 hover:bg-background/60 hover:text-foreground/90',
      )}
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function TimelineView({
  events,
  activeMessageId,
  onEventClick,
  maxHeight,
}: {
  events: TimelineEventData[]
  activeMessageId?: string | null
  onEventClick?: (event: TimelineEventData) => void
  maxHeight?: number
}) {
  const expandedEventIds = useTimelineStore((s) => s.expandedEventIds)
  const toggleExpanded = useTimelineStore((s) => s.toggleExpanded)
  const setExpanded = useTimelineStore((s) => s.setExpanded)

  React.useEffect(() => {
    if (!activeMessageId) return
    const match = events.find((e) => e.messageId === activeMessageId)
    if (match) setExpanded(match.id, true)
  }, [activeMessageId, events, setExpanded])

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/60"
        data-testid="timeline-empty"
      >
        <ListTree className="mb-1.5 h-5 w-5" aria-hidden />
        <span className="text-[11px]">暂无时间线事件</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'space-y-0 overflow-y-auto px-2 py-1.5',
        maxHeight && 'overflow-y-auto',
      )}
      style={maxHeight ? { maxHeight } : undefined}
      data-testid="timeline-view"
      role="list"
    >
      {events.map((event, i) => {
        const isExpanded = expandedEventIds.includes(event.id)
        return (
          <TimelineEventItem
            key={event.id}
            event={event}
            isFirst={i === 0}
            isLast={i === events.length - 1}
            expanded={isExpanded}
            onExpandedChange={(v) => {
              if (v) toggleExpanded(event.id)
              else toggleExpanded(event.id)
            }}
            onClick={onEventClick}
            data-testid={`timeline-event-${event.id}`}
          />
        )
      })}
    </div>
  )
}

export const TimelineTab = React.memo(function TimelineTab({
  events,
  activeMessageId,
  onEventClick,
  defaultTab = 'inline',
  activeTab: activeTabProp,
  onTabChange,
  inlineContent,
  maxHeight = 400,
  inlineLabel = '对话流',
  timelineLabel = '时间线',
  className,
  'data-testid': testId = 'timeline-tab',
}: TimelineTabProps) {
  const setStoreTab = useTimelineStore((s) => s.setActiveTab)
  const [localTab, setLocalTab] = React.useState<TimelineTabValue>(defaultTab)
  const isControlled = activeTabProp !== undefined
  const activeTab: TimelineTabValue = isControlled ? activeTabProp : localTab

  const handleTabChange = (tab: TimelineTabValue) => {
    if (!isControlled) {
      setLocalTab(tab)
      setStoreTab(tab)
    }
    onTabChange?.(tab)
  }

  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      data-testid={testId}
      data-active-tab={activeTab}
    >
      {/* 顶部 tab 切换条 */}
      <div
        role="tablist"
        aria-label="对话视图切换"
        className="inline-flex w-fit items-center gap-1 rounded-md bg-muted/60 p-0.5"
        data-testid="timeline-tablist"
      >
        <TabButton
          active={activeTab === 'inline'}
          onClick={() => handleTabChange('inline')}
          icon={<MessageSquare className="h-3 w-3" />}
          label={inlineLabel}
          testId="tab-inline"
        />
        <TabButton
          active={activeTab === 'timeline'}
          onClick={() => handleTabChange('timeline')}
          icon={<ListTree className="h-3 w-3" />}
          label={timelineLabel}
          testId="tab-timeline"
        />
      </div>

      {/* 视图区域 */}
      <div className="relative" data-testid="timeline-panel">
        <div
          className={cn(
            'transition-opacity duration-200',
            activeTab === 'inline' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
          )}
          aria-hidden={activeTab !== 'inline'}
          data-testid="panel-inline"
        >
          {inlineContent ?? (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/60">
              暂无对话流内容
            </div>
          )}
        </div>
        <div
          className={cn(
            'transition-opacity duration-200',
            activeTab === 'timeline' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
          )}
          aria-hidden={activeTab !== 'timeline'}
          data-testid="panel-timeline"
        >
          <TimelineView
            events={events}
            activeMessageId={activeMessageId}
            onEventClick={onEventClick}
            maxHeight={maxHeight}
          />
        </div>
      </div>
    </div>
  )
})

export default TimelineTab
