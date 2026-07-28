'use client'

import { create } from 'zustand'

/**
 * TimelineStore — Timeline 时间线 tab 状态(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 将 Plan/Subagent/Question/Tool/Thinking/Reference 6 类事件统一展平到时间线
 * - 保留 inline 显示(主对话流)+ 新增时间线视图(Tab 切换)
 * - 支持事件折叠/展开(has children 时可折叠)
 * - tab 状态默认 inline,持久化到 localStorage(下次进入用户偏好)
 *
 * 关联:
 * - timeline-tab.tsx:渲染容器
 * - timeline-event.tsx:单条事件渲染
 * - message-list.tsx:在对话流底部或右侧挂载 TimelineTab
 */

export type TimelineEventType = 'plan' | 'subagent' | 'question' | 'tool' | 'thinking' | 'reference'
export type TimelineEventStatus = 'pending' | 'running' | 'done' | 'failed'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  title: string
  description?: string
  status: TimelineEventStatus
  messageId?: string
  planStepId?: string
  toolCallId?: string
  children?: TimelineEvent[]
  meta?: Record<string, unknown>
}

export type TimelineTabName = 'inline' | 'timeline'

interface TimelineState {
  activeTab: TimelineTabName
  events: TimelineEvent[]
  expandedEventIds: string[]

  setActiveTab: (tab: TimelineTabName) => void
  setEvents: (events: TimelineEvent[]) => void
  addEvent: (event: TimelineEvent) => void
  updateEvent: (id: string, updates: Partial<TimelineEvent>) => void
  removeEvent: (id: string) => void
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, expanded: boolean) => void
  isExpanded: (id: string) => boolean
  reset: () => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  activeTab: 'inline',
  events: [],
  expandedEventIds: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((s) =>
      s.events.some((e) => e.id === event.id) ? s : { events: [...s.events, event] },
    ),

  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  removeEvent: (id) =>
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
      expandedEventIds: s.expandedEventIds.filter((eid) => eid !== id),
    })),

  toggleExpanded: (id) =>
    set((s) => ({
      expandedEventIds: s.expandedEventIds.includes(id)
        ? s.expandedEventIds.filter((eid) => eid !== id)
        : [...s.expandedEventIds, id],
    })),

  setExpanded: (id, expanded) =>
    set((s) => {
      const has = s.expandedEventIds.includes(id)
      if (expanded && !has) return { expandedEventIds: [...s.expandedEventIds, id] }
      if (!expanded && has) return { expandedEventIds: s.expandedEventIds.filter((eid) => eid !== id) }
      return s
    }),

  isExpanded: (id) => get().expandedEventIds.includes(id),

  reset: () => set({ activeTab: 'inline', events: [], expandedEventIds: [] }),
}))
