// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):「发起分析」的草稿归属窗格化。
// 缺陷本体:弹窗写 useChatStore 单例,而 message-input 读 usePaneChatStore() ⇒
// 非根窗格点「发起分析」把草稿写进**根窗格**的输入框。
// 成对留证:
//  ① 正向 = ChatPaneProvider 内发起 ⇒ 草稿落本窗格 store,根单例一个字节没被写;
//  ② 反证 = Provider 外(既有单窗格调用面)发起 ⇒ 草稿仍落根单例 —— 缺省形态逐字不变。

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ImportAnalysisDialog } from '@/components/ai/import-analysis-dialog'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore } from '@/stores/chat'

const ROOT_SENTINEL = '根窗格自己的草稿'

beforeEach(() => {
  cleanup()
  resetChatPaneStores()
  useChatStore.setState({ draftInput: ROOT_SENTINEL, draftAutoSend: false })
})

/** 选中第一个推荐场景并点「发起分析」(DialogContent 走 portal ⇒ 一律用 screen 查 body) */
async function pickScenarioAndSubmit(): Promise<void> {
  await waitFor(() => {
    expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0)
  })
  fireEvent.click(screen.getAllByTestId('import-analysis-recommended')[0]!)
  const submit = screen.getByTestId('import-analysis-submit') as HTMLButtonElement
  await waitFor(() => expect(submit.disabled).toBe(false))
  fireEvent.click(submit)
}

describe('ImportAnalysisDialog 草稿归属(片3)', () => {
  it('正向:Provider 内发起分析 ⇒ 草稿落本窗格 store,根单例零变化', async () => {
    render(
      <ChatPaneProvider paneId="pane-draft-a">
        <ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />
      </ChatPaneProvider>,
    )
    await pickScenarioAndSubmit()

    const pane = getChatStoreForPane('pane-draft-a')
    expect(typeof pane.getState().draftInput).toBe('string')
    expect((pane.getState().draftInput ?? '').length).toBeGreaterThan(0)
    expect(pane.getState().draftAutoSend).toBe(true)
    // 根单例没被这条窗格动作写过(旧缺陷正是写这里)
    expect(useChatStore.getState().draftInput).toBe(ROOT_SENTINEL)
    expect(useChatStore.getState().draftAutoSend).toBe(false)
  })

  it('反证:Provider 外(单窗格调用面)发起 ⇒ 草稿仍落根单例(今天同形)', async () => {
    render(<ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />)
    await pickScenarioAndSubmit()

    expect(useChatStore.getState().draftInput).not.toBe(ROOT_SENTINEL)
    expect((useChatStore.getState().draftInput ?? '').length).toBeGreaterThan(0)
    expect(useChatStore.getState().draftAutoSend).toBe(true)
    // 窗格实例不受这条单窗格动作影响(该 pane 从未被写过 ⇒ 仍是初始 null)
    expect(getChatStoreForPane('pane-draft-b').getState().draftInput).toBeNull()
  })

  it('两窗格各自发起:互不顶掉(先后两个窗格各写各的实例)', async () => {
    render(
      <ChatPaneProvider paneId="pane-draft-c">
        <ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />
      </ChatPaneProvider>,
    )
    await pickScenarioAndSubmit()
    cleanup()
    render(
      <ChatPaneProvider paneId="pane-draft-d">
        <ImportAnalysisDialog open onOpenChange={() => {}} source="codex" />
      </ChatPaneProvider>,
    )
    await pickScenarioAndSubmit()

    expect(getChatStoreForPane('pane-draft-c').getState().draftAutoSend).toBe(true)
    expect(getChatStoreForPane('pane-draft-d').getState().draftAutoSend).toBe(true)
    expect(useChatStore.getState().draftInput).toBe(ROOT_SENTINEL)
    expect(useChatStore.getState().draftAutoSend).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
