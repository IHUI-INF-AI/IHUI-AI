// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60 普查批(2026-10-21):TimelineStore 按窗格分家。
// 缺陷本体:此前全局一份 ⇒ MessageList 派生(每窗格都跑)setEvents 整体替换,
// pane-1 切会话就把根窗格时间线顶掉;发送链 addEvent 也全部落进同一张表。
// 成对留证:
//  ① 正向 = 两窗格各自 setEvents/addEvent 互不顶,根单例(AI 面板面)事件不被窗格派生顶掉;
//  ② 反证 = 摘掉窗格维(Provider 外)恒回落根单例且同一引用 —— 单窗格形态逐字不变;
//  ③ 空 paneId 当场抛错 —— 静默回落单例 = 两窗格共用一张时间线,正是本批要消灭的互串。

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'

import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  getTimelineStoreForPane,
  resetTimelinePaneStores,
  timelinePaneCount,
  usePaneTimelineStore,
  useTimelineStore,
  type TimelineEvent,
} from '@/stores/timeline-store'

function wrapperFor(paneId: string) {
  function PaneWrapper({ children }: { children: ReactNode }) {
    return <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>
  }
  return PaneWrapper
}

function ev(id: string): TimelineEvent {
  return {
    id,
    type: 'tool',
    timestamp: '2026-10-21T00:00:00.000Z',
    title: id,
    status: 'done',
  }
}

const ids = (events: TimelineEvent[]) => events.map((e) => e.id)

beforeEach(() => {
  resetTimelinePaneStores()
  useTimelineStore.setState({
    activeTab: 'inline',
    events: [],
    expandedEventIds: [],
    filterType: 'all',
  })
})

afterEach(() => {
  resetTimelinePaneStores()
  useTimelineStore.setState({
    activeTab: 'inline',
    events: [],
    expandedEventIds: [],
    filterType: 'all',
  })
})

describe('usePaneTimelineStore 窗格寻址(票60 普查批)', () => {
  it('① 正向:两窗格各自 setEvents/addEvent 互不顶,pane-1 整体替换后根单例 events 不变', () => {
    const a = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-1') })
    const b = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-2') })
    expect(a.result.current).not.toBe(b.result.current)

    // 根单例先有自己的时间线(AI 面板面 / 发送链写进来的)
    useTimelineStore.getState().setEvents([ev('root-1')])
    const rootBefore = useTimelineStore.getState().events

    // pane-1 的 MessageList 派生:setEvents 是整体替换 —— 只该顶掉本窗格那张表
    a.result.current.getState().setEvents([ev('p1-msg-1'), ev('p1-msg-2')])
    expect(useTimelineStore.getState().events).toBe(rootBefore)
    expect(ids(useTimelineStore.getState().events)).toEqual(['root-1'])
    expect(ids(b.result.current.getState().events)).toEqual([]) // pane-2 未被串

    // 发送链形态的 addEvent:各随窗格累积
    a.result.current.getState().addEvent(ev('p1-tc'))
    b.result.current.getState().setEvents([ev('p2-msg-1')])
    b.result.current.getState().addEvent(ev('p2-tc'))

    expect(ids(a.result.current.getState().events)).toEqual(['p1-msg-1', 'p1-msg-2', 'p1-tc'])
    expect(ids(b.result.current.getState().events)).toEqual(['p2-msg-1', 'p2-tc'])
    expect(ids(useTimelineStore.getState().events)).toEqual(['root-1'])
  })

  it('① 正向:pane-2 切会话(setEvents 清空重派生)不顶掉 pane-1 与根单例', () => {
    const a = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-a') })
    const b = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-b') })
    a.result.current.getState().setEvents([ev('a-1')])
    useTimelineStore.getState().setEvents([ev('root-1')])

    b.result.current.getState().setEvents([]) // 切会话:派生面先清空自己
    b.result.current.getState().setEvents([ev('b-new-1')])

    expect(ids(a.result.current.getState().events)).toEqual(['a-1'])
    expect(ids(useTimelineStore.getState().events)).toEqual(['root-1'])
    expect(ids(b.result.current.getState().events)).toEqual(['b-new-1'])
  })

  it('② 反证:Provider 外回落根单例且恒同一引用(单窗格形态逐字不变)', () => {
    const one = renderHook(() => usePaneTimelineStore())
    const other = renderHook(() => usePaneTimelineStore())
    expect(one.result.current).toBe(useTimelineStore)
    expect(other.result.current).toBe(one.result.current)

    // 缺省形态连通性:根单例写入,Provider 外的读方立刻看得到(互串旧行为在单窗格下无害且保留)
    one.result.current.getState().setEvents([ev('root-only')])
    expect(other.result.current.getState().events).toEqual([ev('root-only')])
  })

  it('② 反证:同一 paneId 复用同一实例,换 id 才是另一份', () => {
    const first = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-same') })
    const again = renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('pane-same') })
    expect(again.result.current).toBe(first.result.current)
    expect(first.result.current).not.toBe(useTimelineStore)

    first.result.current.getState().setEvents([ev('shared-1')])
    expect(ids(again.result.current.getState().events)).toEqual(['shared-1'])

    const otherPane = renderHook(() => usePaneTimelineStore(), {
      wrapper: wrapperFor('pane-other'),
    })
    expect(otherPane.result.current).not.toBe(first.result.current)
    expect(ids(otherPane.result.current.getState().events)).toEqual([])
    expect(timelinePaneCount()).toBe(2)
  })

  it('③ 空 paneId 当场抛(静默回落单例 = 两窗格共用一张时间线)', () => {
    expect(() => getTimelineStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getTimelineStoreForPane('   ')).toThrow(/paneId 不能为空/)
    expect(() => renderHook(() => usePaneTimelineStore(), { wrapper: wrapperFor('  ') })).toThrow(
      /paneId 不能为空/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
