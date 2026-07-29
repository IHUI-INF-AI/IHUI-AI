'use client'

import { create } from 'zustand'

/**
 * TimelineStore — Timeline 时间线 tab 状态(2026-07-28 立,Trae Work 对齐)
 */

export type TimelineEventType = 'plan' | 'subagent' | 'question' | 'tool' | 'thinking' | 'reference'
export type TimelineEventStatus = 'pending' | 'running' | 'done' | 'failed'

/** Timeline 事件类型筛选值(2026-07-29 立,Phase 22);'all' 表示不过滤 */
export type TimelineFilterType = 'all' | TimelineEventType

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
  /** 当前类型筛选(2026-07-29 立,Phase 22);'all' = 不过滤 */
  filterType: TimelineFilterType

  setActiveTab: (tab: TimelineTabName) => void
  setEvents: (events: TimelineEvent[]) => void
  addEvent: (event: TimelineEvent) => void
  updateEvent: (id: string, updates: Partial<TimelineEvent>) => void
  /** upsertEvent(2026-07-29 立,Phase 21):事件不存在时 addEvent,存在时 updateEvent。
   *  用于 subagent_progress 事件:第一次 progress 可能先于 spawn 到达(网络乱序),
   *  此时自动创建一个 status='running' 的事件,后续 progress 更新它。 */
  upsertEvent: (event: TimelineEvent) => void
  removeEvent: (id: string) => void
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, expanded: boolean) => void
  isExpanded: (id: string) => boolean
  /** 设置类型筛选(2026-07-29 立,Phase 22) */
  setFilterType: (type: TimelineFilterType) => void
  /** 按 filterType 过滤后的事件(2026-07-29 立,Phase 22);'all' 返回原引用 */
  filteredEvents: () => TimelineEvent[]
  reset: () => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  activeTab: 'inline',
  events: [],
  expandedEventIds: [],
  filterType: 'all',

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((s) => (s.events.some((e) => e.id === event.id) ? s : { events: [...s.events, event] })),

  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  upsertEvent: (event) =>
    set((s) => {
      const exists = s.events.some((e) => e.id === event.id)
      if (exists) {
        return { events: s.events.map((e) => (e.id === event.id ? { ...e, ...event } : e)) }
      }
      return { events: [...s.events, event] }
    }),

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
      if (!expanded && has)
        return { expandedEventIds: s.expandedEventIds.filter((eid) => eid !== id) }
      return s
    }),

  isExpanded: (id) => get().expandedEventIds.includes(id),

  setFilterType: (type) => set({ filterType: type }),

  filteredEvents: () => {
    const { events, filterType } = get()
    if (filterType === 'all') return events
    return events.filter((e) => e.type === filterType)
  },

  reset: () => set({ activeTab: 'inline', events: [], expandedEventIds: [], filterType: 'all' }),
}))
