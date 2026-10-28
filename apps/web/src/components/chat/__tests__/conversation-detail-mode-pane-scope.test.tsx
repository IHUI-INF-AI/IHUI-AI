// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 票60 普查批(2026-10-21):conversation-detail-mode 按窗格分家。
 *
 * 改前它是全局单值(persist 键 `ihui-conversation-detail-mode`),而 MessageList
 * (非根窗格子树必经)直读它 ⇒ pane-1 切"详情档位"会把根窗格的消息渲染档位一起改掉,
 * 双窗格互顶。实现里存的 mode / suggestionsEnabled 都是显示偏好、不随会话恢复,
 * 故按台账判据走"能按窗格寻址"一侧(usePaneXxxStore 形态,与 ai-tools-panel 同模板)。
 *
 * 成对留证:
 *   ① 正向 = 两窗格各 setMode 互不顶,且根单例与原 persist 键一个字节没被写;
 *   ② 反证 = Provider 外回落根单例且恒同一引用(既有单窗格形态零变化);
 *   ③ 空/空白 paneId 当场抛(静默回落单例 = 互串回潮)。
 */
import * as React from 'react'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  CONVERSATION_DETAIL_MODE_PANE_KEY_PREFIX,
  CONVERSATION_DETAIL_MODE_STORAGE_KEY,
  conversationDetailModePaneCount,
  getConversationDetailModeStoreForPane,
  resetConversationDetailModePaneStores,
  useConversationDetailModeStore,
  usePaneConversationDetailModeStore,
} from '@/stores/conversation-detail-mode'
import { DetailModeSwitcher } from '@/components/chat/message-list/detail-mode-switcher'

function wrapperFor(paneId: string) {
  // 具名组件:eslint react/display-name 不认匿名箭头(与其余 pane-scope 测试同形)
  function PaneWrapper({ children }: { children: React.ReactNode }) {
    return <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>
  }
  return PaneWrapper
}

beforeEach(() => {
  resetConversationDetailModePaneStores()
  useConversationDetailModeStore.setState({ mode: 'steps', suggestionsEnabled: true })
  // 必须放在 setState 之后:persist 会在 setState 时写原键,清晚了①的"一个字节没被写"断言会假红
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  resetConversationDetailModePaneStores()
  useConversationDetailModeStore.setState({ mode: 'steps', suggestionsEnabled: true })
  window.localStorage.clear()
})

describe('conversation-detail-mode 按窗格分家(票60 普查批)', () => {
  it('① 正向:两窗格各 setMode 互不顶,根单例与原 persist 键一个字节没被写', () => {
    const a = renderHook(() => usePaneConversationDetailModeStore(), {
      wrapper: wrapperFor('pane-cdm-a'),
    })
    const b = renderHook(() => usePaneConversationDetailModeStore(), {
      wrapper: wrapperFor('pane-cdm-b'),
    })
    expect(a.result.current).not.toBe(b.result.current)

    act(() => {
      a.result.current.getState().setMode('commands')
    })

    expect(a.result.current.getState().mode).toBe('commands')
    expect(b.result.current.getState().mode).toBe('steps')
    // 根单例没被牵连
    expect(useConversationDetailModeStore.getState().mode).toBe('steps')
    // 原 persist 键一个字节没被写(窗格态只落窗格键)
    expect(window.localStorage.getItem(CONVERSATION_DETAIL_MODE_STORAGE_KEY)).toBeNull()
    const paneRaw = window.localStorage.getItem(
      `${CONVERSATION_DETAIL_MODE_PANE_KEY_PREFIX}pane-cdm-a`,
    )
    expect(paneRaw).toBeTruthy()
    expect((JSON.parse(paneRaw as string) as { state: { mode: string } }).state.mode).toBe(
      'commands',
    )
    expect(conversationDetailModePaneCount()).toBe(2)
  })

  it('① 正向(消费面):两窗格各挂 DetailModeSwitcher,点 A 窗格不改 B 窗格选中态', () => {
    const viewA = render(
      <ChatPaneProvider paneId="pane-sw-a">
        <DetailModeSwitcher />
      </ChatPaneProvider>,
    )
    const viewB = render(
      <ChatPaneProvider paneId="pane-sw-b">
        <DetailModeSwitcher />
      </ChatPaneProvider>,
    )
    fireEvent.click(
      viewA.container.querySelector('[data-testid="detail-mode-commands"]') as HTMLElement,
    )
    expect(
      viewA.container
        .querySelector('[data-testid="detail-mode-commands"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      viewB.container
        .querySelector('[data-testid="detail-mode-steps"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
    expect(useConversationDetailModeStore.getState().mode).toBe('steps')
    expect(window.localStorage.getItem(CONVERSATION_DETAIL_MODE_STORAGE_KEY)).toBeNull()
  })

  it('② 反证:Provider 外回落根单例,且恒同一引用(既有单窗格形态零变化)', () => {
    const one = renderHook(() => usePaneConversationDetailModeStore())
    const other = renderHook(() => usePaneConversationDetailModeStore())
    expect(one.result.current).toBe(other.result.current)
    expect(one.result.current).toBe(useConversationDetailModeStore)

    act(() => {
      one.result.current.getState().setMode('narrative')
    })

    // 同一份档位 ⇒ 另一处立刻跟着变 —— 这正是根单例的既有形态
    expect(other.result.current.getState().mode).toBe('narrative')
    expect(useConversationDetailModeStore.getState().mode).toBe('narrative')
    // Provider 外仍写原键(历史偏好通道不变)
    const raw = window.localStorage.getItem(CONVERSATION_DETAIL_MODE_STORAGE_KEY)
    expect((JSON.parse(raw as string) as { state: { mode: string } }).state.mode).toBe('narrative')
  })

  it('③ 空/空白 paneId 当场抛(静默回落单例 = 窗格间互串)', () => {
    expect(() => getConversationDetailModeStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getConversationDetailModeStoreForPane('   ')).toThrow(/paneId 不能为空/)
    expect(() =>
      renderHook(() => usePaneConversationDetailModeStore(), { wrapper: wrapperFor('  ') }),
    ).toThrow(/paneId 不能为空/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
