// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):工具面板展开态窗格化。
// 缺陷本体:open 落在单个全局键 `ihui-ai-tools-panel` ⇒ 一个窗格展开点亮所有窗格。
// 成对留证:
//  ① 正向 = 两窗格的 open 互不串(各自实例、各自持久化键含 paneId);
//  ② 反证 = 摘掉窗格维(Provider 外)必须回到"所有人共用同一份"的今天形态 —— 那正是互串本体。

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'

import {
  AI_TOOLS_PANEL_PANE_KEY_PREFIX,
  AI_TOOLS_PANEL_STORAGE_KEY,
  aiToolsPanelPaneCount,
  getAiToolsPanelStoreForPane,
  resetAiToolsPanelPaneStores,
  useAiToolsPanelStore,
  usePaneAiToolsPanelStore,
} from '@/stores/ai-tools-panel'
import { ChatPaneProvider } from '@/stores/chat-pane-context'

function wrapperFor(paneId: string) {
  // 具名组件:eslint react/display-name 不认匿名箭头(与其余 pane-scope 测试同形)
  function PaneWrapper({ children }: { children: ReactNode }) {
    return <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>
  }
  return PaneWrapper
}

afterEach(() => {
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false })
  window.localStorage.clear()
})

describe('usePaneAiToolsPanelStore 窗格寻址', () => {
  it('① 正向:两窗格 open 互不串', () => {
    const a = renderHook(() => usePaneAiToolsPanelStore(), { wrapper: wrapperFor('pane-x') })
    const b = renderHook(() => usePaneAiToolsPanelStore(), { wrapper: wrapperFor('pane-y') })
    expect(a.result.current).not.toBe(b.result.current)

    a.result.current.getState().toggle()

    expect(a.result.current.getState().open).toBe(true)
    expect(b.result.current.getState().open).toBe(false)
    expect(useAiToolsPanelStore.getState().open).toBe(false)
  })

  it('① 正向:窗格实例的持久化键含 paneId(全局键不背这份锅)', () => {
    const pane = getAiToolsPanelStoreForPane('pane-key')
    pane.getState().openPanel()

    const raw = window.localStorage.getItem(`${AI_TOOLS_PANEL_PANE_KEY_PREFIX}pane-key`)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).state.open).toBe(true)
    // 全局键要么没写过,要么记的不是这次展开(不得把窗格态烘进全局键)
    const globalRaw = window.localStorage.getItem(AI_TOOLS_PANEL_STORAGE_KEY)
    if (globalRaw !== null) expect(JSON.parse(globalRaw).state.open).toBe(false)
  })

  it('② 反证:摘掉窗格维(Provider 外)⇒ 所有人拿同一份实例,一处展开全体点亮(旧行为)', () => {
    const one = renderHook(() => usePaneAiToolsPanelStore())
    const other = renderHook(() => usePaneAiToolsPanelStore())
    expect(one.result.current).toBe(other.result.current)
    expect(one.result.current).toBe(useAiToolsPanelStore)

    one.result.current.getState().toggle()

    // 同一份 open 态 ⇒ 另一处立刻"被展开"—— 这正是全局键那一型
    expect(other.result.current.getState().open).toBe(true)
  })

  it('② 反证:同一 paneId 复用同一实例;换 id 才是另一份', () => {
    const first = renderHook(() => usePaneAiToolsPanelStore(), { wrapper: wrapperFor('pane-z') })
    first.result.current.getState().openPanel()
    const again = renderHook(() => usePaneAiToolsPanelStore(), { wrapper: wrapperFor('pane-z') })
    expect(again.result.current).toBe(first.result.current)
    expect(again.result.current.getState().open).toBe(true)

    const otherPane = renderHook(() => usePaneAiToolsPanelStore(), {
      wrapper: wrapperFor('pane-w'),
    })
    expect(otherPane.result.current).not.toBe(first.result.current)
    expect(otherPane.result.current.getState().open).toBe(false)
    expect(aiToolsPanelPaneCount()).toBe(2)
  })

  it('空/空白 paneId 当场抛(静默回落单例 = 互串回潮)', () => {
    expect(() => getAiToolsPanelStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getAiToolsPanelStoreForPane('   ')).toThrow(/paneId 不能为空/)
    expect(() =>
      renderHook(() => usePaneAiToolsPanelStore(), { wrapper: wrapperFor('  ') }),
    ).toThrow(/paneId 不能为空/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
