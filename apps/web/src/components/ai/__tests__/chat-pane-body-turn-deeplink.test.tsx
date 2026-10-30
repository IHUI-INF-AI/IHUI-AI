// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距⑤遗留边界2(2026-10-30 立):窗格化 ?turn= 深链的组件面单测。
 * 覆盖 ChatPaneBody 的 around 分支:目标归属本窗格 ⇒ 绕常规通道走 around 取窗、
 * 锚点跳转投递**本窗格**的 ProgressJumpStore 实例(不碰根单例);
 * 边界1 同窗格换 turn ⇒ 版本号订阅驱动 effect 重跑、按新 turn 重锚;
 * 目标不属本窗格 ⇒ 常规路径逐字节不变(零回归红线)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, waitFor, act } from '@testing-library/react'

const { getConversationMock, getMessagesMock, getConversationHistoryMock } = vi.hoisted(() => ({
  getConversationMock: vi.fn(),
  getMessagesMock: vi.fn(),
  getConversationHistoryMock: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('@ihui/api-client', async (importOriginal) => ({
  ...(await importOriginal()),
  getConversation: getConversationMock,
  getMessages: getMessagesMock,
  getConversationHistory: getConversationHistoryMock,
}))
vi.mock('@/components/common', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/hooks/use-apply-diff', () => ({
  useApplyDiff: () => ({
    applyDiff: vi.fn(),
    rejectDiff: vi.fn(),
    applyAllDiffs: vi.fn(),
    rejectAllDiffs: vi.fn(),
    applyDiffSelection: vi.fn(),
  }),
}))
vi.mock('@/components/chat/message-list/MessageList', () => ({
  MessageList: (props: { messages: unknown[] }) => (
    <div data-testid="message-list" data-count={props.messages.length} />
  ),
}))
vi.mock('@/components/chat/message-input', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}))
vi.mock('@/components/chat/question-dialog', () => ({
  QuestionDialog: () => null,
}))

import { ChatPaneBody } from '@/components/ai/chat-pane-body'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import {
  getProgressJumpStoreForPane,
  resetProgressJumpPaneStores,
  useProgressJumpStore,
} from '@/stores/progress-jump-store'
import { clearTurnDeepLink, setTurnDeepLink } from '@/lib/turn-deeplink'

const iso = new Date('2026-10-30T00:00:00Z').toISOString()

/** around 通道 mock:按请求的 turn 现造窗口(锚点行 id = `m-<turn>`),并记录调用参数 */
function mockAroundWindow() {
  getConversationHistoryMock.mockImplementation(
    (_id: string, opts: { aroundTurnId: string; aroundWindow: number }) =>
      Promise.resolve({
        success: true,
        data: {
          turns: [
            {
              turnOrdinal: Number(opts.aroundTurnId),
              messages: [
                { id: `m-${opts.aroundTurnId}`, role: 'user', content: '锚点轮', createdAt: iso },
              ],
            },
          ],
        },
      }),
  )
}

describe('ChatPaneBody 窗格化 ?turn= 深链', () => {
  beforeEach(() => {
    resetChatPaneStores()
    resetProgressJumpPaneStores()
    clearTurnDeepLink()
    useProgressJumpStore.setState({ pendingJumpToMessage: null })
    getConversationMock.mockReset()
    getMessagesMock.mockReset()
    getConversationHistoryMock.mockReset()
    getConversationMock.mockResolvedValue({
      success: true,
      data: { conversation: { title: '会话', metadata: null } },
    })
    getMessagesMock.mockResolvedValue({
      success: true,
      data: { messages: [], nextCursor: null, hasMore: false },
    })
    mockAroundWindow()
  })

  afterEach(() => {
    clearTurnDeepLink()
  })

  it('目标归属本窗格 ⇒ around 取窗水合本窗格 store,锚点跳转投递本窗格实例、不碰根单例', async () => {
    setTurnDeepLink('conv-deeplink-a', 7, 'pane-a')
    render(
      <ChatPaneProvider paneId="pane-a">
        <ChatPaneBody paneId="pane-a" conversationId="conv-deeplink-a" />
      </ChatPaneProvider>,
    )

    const paneStore = getChatStoreForPane('pane-a')
    await waitFor(() => expect(paneStore.getState().messages).toHaveLength(1))
    expect(getConversationHistoryMock).toHaveBeenCalledWith('conv-deeplink-a', {
      aroundTurnId: '7',
      aroundWindow: 5,
    })
    // 绕常规通道:最新页 getMessages 不进 around 支
    expect(getMessagesMock).not.toHaveBeenCalled()
    expect(paneStore.getState().messagesTurnWindowed).toBe(true)
    expect(paneStore.getState().messages[0]?.id).toBe('m-7')
    // 投递面:跳转落在 pane-a 自己的 ProgressJumpStore,根单例分毫不动
    expect(getProgressJumpStoreForPane('pane-a').getState().pendingJumpToMessage).toEqual(
      expect.objectContaining({ messageId: 'm-7' }),
    )
    expect(useProgressJumpStore.getState().pendingJumpToMessage).toBeNull()
  })

  it('边界1 同窗格换 turn ⇒ 版本号订阅驱动重锚(无需卸载重挂)', async () => {
    setTurnDeepLink('conv-deeplink-b', 5, 'pane-a')
    render(
      <ChatPaneProvider paneId="pane-a">
        <ChatPaneBody paneId="pane-a" conversationId="conv-deeplink-b" />
      </ChatPaneProvider>,
    )
    const paneStore = getChatStoreForPane('pane-a')
    await waitFor(() => expect(paneStore.getState().messages[0]?.id).toBe('m-5'))

    // 已在该会话时 URL 的 ?turn= 变化:广播 ⇒ effect 重跑 ⇒ 按新 turn 重取窗 + 重锚
    act(() => {
      setTurnDeepLink('conv-deeplink-b', 9, 'pane-a')
    })
    await waitFor(() => expect(paneStore.getState().messages[0]?.id).toBe('m-9'))
    expect(getConversationHistoryMock).toHaveBeenCalledTimes(2)
    expect(getConversationHistoryMock).toHaveBeenLastCalledWith('conv-deeplink-b', {
      aroundTurnId: '9',
      aroundWindow: 5,
    })
    expect(getProgressJumpStoreForPane('pane-a').getState().pendingJumpToMessage?.messageId).toBe(
      'm-9',
    )
  })

  it('目标不属本窗格(根窗格目标)⇒ 本窗格走常规路径,零 around 调用', async () => {
    setTurnDeepLink('conv-deeplink-c', 7, null)
    getMessagesMock.mockResolvedValue({
      success: true,
      data: {
        messages: [{ id: 'n-1', role: 'user', content: '常规页', createdAt: iso }],
        nextCursor: null,
        hasMore: false,
      },
    })
    render(
      <ChatPaneProvider paneId="pane-a">
        <ChatPaneBody paneId="pane-a" conversationId="conv-deeplink-c" />
      </ChatPaneProvider>,
    )

    const paneStore = getChatStoreForPane('pane-a')
    await waitFor(() => expect(paneStore.getState().messages).toHaveLength(1))
    expect(getMessagesMock).toHaveBeenCalledWith('conv-deeplink-c', {
      direction: 'initial',
      pageSize: 50,
    })
    expect(getConversationHistoryMock).not.toHaveBeenCalled()
    expect(paneStore.getState().messagesTurnWindowed).toBe(false)
    expect(getProgressJumpStoreForPane('pane-a').getState().pendingJumpToMessage).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
