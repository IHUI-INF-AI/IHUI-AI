// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { create } from 'zustand'
import * as React from 'react'
import { useOptionalPaneId } from '@/stores/chat-pane-context'
import { paneIdForChatStore, type ChatStore } from '@/stores/chat-panes'

/**
 * TimelineStore — Timeline 时间线 tab 状态(2026-07-28 立,AI 工作台 对齐)
 *
 * 票60 普查批(2026-10-21):按窗格分家 —— 此前全局一份,MessageList 派生(setEvents 整体
 * 替换)与发送链 addEvent 来自哪个窗格都写进同一张表 ⇒ pane-1 一切会话就把根窗格时间线
 * 顶掉,双向互串。窗格实例无 persist(timeline 本就不落 localStorage,重进按消息重派生);
 * 根窗格/Provider 外仍用单例 ⇒ AI 面板等全局面零回归。非 React 面(发送链)只有 chatStore
 * ⇒ getTimelineStoreForChatStore 反查,根单例 chatStore ⇒ null ⇒ 回落根单例。
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

export type TimelineTabName = 'inline' | 'timeline' | 'all'

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

function buildTimelineStore() {
  return create<TimelineState>((set, get) => ({
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
}

type TimelineStore = ReturnType<typeof buildTimelineStore>

/** 根单例(AI 面板/全局面继续用它);Provider 外恒回落到它 ⇒ 既有消费面零回归 */
export const useTimelineStore = buildTimelineStore()

/** paneId → 独立实例;默认单例不进表(与 chat-panes / ai-tools-panel 的注册表同形) */
const paneTimelineStores = new Map<string, TimelineStore>()

/**
 * 取某窗格的 timeline 实例(懒建 + 复用)。
 * paneId 空/空白直接抛:静默回落单例 = 两窗格共用一张时间线,正是本批要消灭的互串形态。
 */
export function getTimelineStoreForPane(paneId: string): TimelineStore {
  const key = paneId.trim()
  if (!key) throw new Error('getTimelineStoreForPane: paneId 不能为空(回落单例 = 窗格间互串)')
  const existing = paneTimelineStores.get(key)
  if (existing) return existing
  const created = buildTimelineStore()
  paneTimelineStores.set(key, created)
  return created
}

/**
 * 发送链等非 React 面的寻址:按 chatStore 反查 paneId 取窗格实例;
 * 根单例 chatStore(或未登记实例)⇒ null ⇒ 回落根单例(与 useOptionalPaneId 同判据)。
 */
export function getTimelineStoreForChatStore(chatStore: ChatStore): TimelineStore {
  const paneId = paneIdForChatStore(chatStore)
  return paneId === null ? useTimelineStore : getTimelineStoreForPane(paneId)
}

/** 关闭窗格时回收实例(timeline 不持久化,重开会话由派生面重建) */
export function disposeTimelineStoreForPane(paneId: string): void {
  paneTimelineStores.delete(paneId.trim())
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetTimelinePaneStores(): void {
  paneTimelineStores.clear()
}

/** 当前窗格实例数(测试断言用,不进生产判定) */
export function timelinePaneCount(): number {
  return paneTimelineStores.size
}

/**
 * 窗格寻址的 timeline 解析 hook(与 usePaneAiToolsPanelStore 同一身份来源 useOptionalPaneId):
 * Provider 内 = 该窗格的独立实例;无 Provider = 根单例本尊(恒同一引用 ⇒ 单窗格形态逐字不变)。
 */
export function usePaneTimelineStore(): TimelineStore {
  const paneId = useOptionalPaneId()
  return React.useMemo(
    () => (paneId === null ? useTimelineStore : getTimelineStoreForPane(paneId)),
    [paneId],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
