// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60(2026-10-18,步序二):usePaneChatStore 消费基座用例。
// 咬四件事:
//  ① 无 Provider(既有单窗格场景)恒回落单例 useChatStore —— 消费面切换零行为变化;
//  ② Provider 内恒取该 paneId 的独立实例,与单例互不影响;
//  ③ 不同 paneId 各自独立实例(消费面经 context 得到正确寻址);
//  ④ 空/空白 paneId 的 Provider 挂载即抛(挂载点炸,不拖到消费时)。

import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { ChatPaneProvider, matchesPaneEvent, usePaneChatStore } from '@/stores/chat-pane-context'
import { resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore } from '@/stores/chat'

afterEach(() => {
  resetChatPaneStores()
  window.localStorage.clear()
})

describe('usePaneChatStore 消费基座', () => {
  it('无 Provider 恒回落单例 useChatStore(非窗格场景零行为变化)', () => {
    const { result } = renderHook(() => usePaneChatStore())
    expect(result.current).toBe(useChatStore)
  })

  it('Provider 内恒取该 paneId 的独立实例,读写不碰单例', () => {
    const { result } = renderHook(() => usePaneChatStore(), {
      wrapper: ({ children }) => <ChatPaneProvider paneId="pane-1">{children}</ChatPaneProvider>,
    })
    const store = result.current
    expect(store).not.toBe(useChatStore)
    // 与 getChatStoreForPane('pane-1') 同一实例(懒建 + 复用)
    store.getState().setConversationId('conv-1')
    expect(useChatStore.getState().conversationId).toBeNull()
  })

  it('不同 paneId 的 Provider 各自独立实例', () => {
    const a = renderHook(() => usePaneChatStore(), {
      wrapper: ({ children }) => <ChatPaneProvider paneId="pane-a">{children}</ChatPaneProvider>,
    })
    const b = renderHook(() => usePaneChatStore(), {
      wrapper: ({ children }) => <ChatPaneProvider paneId="pane-b">{children}</ChatPaneProvider>,
    })
    expect(a.result.current).not.toBe(b.result.current)
    a.result.current.getState().setStreaming(true)
    expect(b.result.current.getState().isStreaming).toBe(false)
  })

  it('空/空白 paneId 的 Provider 挂载即抛', () => {
    expect(() =>
      renderHook(() => usePaneChatStore(), {
        wrapper: ({ children }) => <ChatPaneProvider paneId="">{children}</ChatPaneProvider>,
      }),
    ).toThrow(/paneId 不能为空/)
    expect(() =>
      renderHook(() => usePaneChatStore(), {
        wrapper: ({ children }) => <ChatPaneProvider paneId="   ">{children}</ChatPaneProvider>,
      }),
    ).toThrow(/paneId 不能为空/)
  })
})

describe('matchesPaneEvent 窗格事件门控', () => {
  it('事件 paneId 与当前窗格相同 ⇒ 处理', () => {
    expect(matchesPaneEvent('pane-a', 'pane-a')).toBe(true)
  })

  it('事件 paneId 指向别的窗格 ⇒ 不处理', () => {
    expect(matchesPaneEvent('pane-a', 'pane-b')).toBe(false)
  })

  it('根窗格(paneId=null)只处理无 paneId 的历史事件', () => {
    expect(matchesPaneEvent(undefined, null)).toBe(true)
    expect(matchesPaneEvent(null, null)).toBe(true)
    expect(matchesPaneEvent('pane-a', null)).toBe(false)
  })

  it('窗格内的监听方不处理无 paneId 的全局事件(避免根事件被每个窗格重复消费)', () => {
    expect(matchesPaneEvent(undefined, 'pane-a')).toBe(false)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
