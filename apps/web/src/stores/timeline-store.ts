import { create } from 'zustand'

/**
 * Timeline Store — Plan/Subagent/Question/Tool 事件统一展平 + tab 切换(2026-07-28 立,Phase 20)
 *
 * 职责:
 * 1. 集中维护 Timeline 事件列表(append / update / remove 原子操作)
 * 2. tab 切换(inline ↔ timeline)+ 自动展开的 event id 集合
 * 3. 不持久化(每次会话重置)—— 时间线是会话级视图,跨会话无意义
 *
 * 关联策略:
 * - event.messageId / planStepId / toolCallId 用于双向跳转(关联 progress-jump-store)
 * - 由 useChat / useAgentProgress 写入,TimelineTab / TimelineEvent 读取
 *
 * 设计要点:
 * - Set<string> 用 .has/.add/.delete 操作,react 需要 immutable → 转 array 写入 state
 * - reset() 用于切换 conversation 时清空,避免脏数据
 */

export type TimelineEventType =
  | 'plan'
  | 'subagent'
  | 'question'
  | 'tool'
  | 'thinking'
  | 'reference'

export type TimelineEventStatus = 'pending' | 'running' | 'done' | 'failed'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  /** 时间戳 (ISO string or millis) */
  timestamp: string
  /** 简短摘要 (e.g. "Plan Step: 分析代码结构") */
  title: string
  /** 详细描述 (可展开) */
  description?: string
  /** 状态: pending | running | done | failed */
  status: TimelineEventStatus
  /** 关联 messageId (用于双向跳转) */
  messageId?: string
  /** 关联 planStepId */
  planStepId?: string
  /** 关联 toolCallId */
  toolCallId?: string
  /** 子事件 (嵌套 subagent 操作) */
  children?: TimelineEvent[]
  /** 额外 meta */
  meta?: Record<string, unknown>
}

export type TimelineTab = 'inline' | 'timeline'

interface TimelineState {
  /** 当前 tab */
  activeTab: TimelineTab
  setActiveTab: (tab: TimelineTab) => void
  /** 事件列表 */
  events: TimelineEvent[]
  setEvents: (events: TimelineEvent[]) => void
  addEvent: (event: TimelineEvent) => void
  updateEvent: (id: string, updates: Partial<Omit<TimelineEvent, 'id'>>) => void
  removeEvent: (id: string) => void
  /** 自动展开的事件 ID 集合(用于 jump) */
  expandedEventIds: string[]
  isExpanded: (id: string) => boolean
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, expanded: boolean) => void
  /** 重置 */
  reset: () => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  activeTab: 'inline',
  events: [],
  expandedEventIds: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  setEvents: (events) => set({ events }),

  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  removeEvent: (id) =>
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
      expandedEventIds: s.expandedEventIds.filter((eid) => eid !== id),
    })),

  isExpanded: (id) => get().expandedEventIds.includes(id),

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
      return {}
    }),

  reset: () => set({ activeTab: 'inline', events: [], expandedEventIds: [] }),
}))
