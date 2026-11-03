// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票60 步序四(2026-10-20):非根窗格主体的归属取证。
// 咬一件事:ChatPaneBody 的历史加载与消息读写落在该窗格的独立 store,
// 单例 useChatStore 不被写入(两窗格互不串话的前提)。

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { getConversationMock, getMessagesMock } = vi.hoisted(() => ({
  getConversationMock: vi.fn(),
  getMessagesMock: vi.fn(),
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
import { useChatStore } from '@/stores/chat'

describe('ChatPaneBody 按窗格实例承载', () => {
  beforeEach(() => {
    resetChatPaneStores()
    useChatStore.setState({ messages: [], conversationId: null, isStreaming: false, error: null })
    getConversationMock.mockReset()
    getMessagesMock.mockReset()
    getConversationMock.mockResolvedValue({
      success: true,
      data: { conversation: { title: '会话', metadata: null } },
    })
    getMessagesMock.mockResolvedValue({
      success: true,
      data: {
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: '你好',
            createdAt: new Date('2026-10-20T00:00:00Z').toISOString(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    })
  })

  it('历史消息写入窗格 store,不污染单例', async () => {
    render(
      <ChatPaneProvider paneId="pane-a">
        <ChatPaneBody paneId="pane-a" conversationId="conv-a" />
      </ChatPaneProvider>,
    )

    const paneStore = getChatStoreForPane('pane-a')
    await waitFor(() => expect(paneStore.getState().messages).toHaveLength(1))
    expect(paneStore.getState().conversationId).toBe('conv-a')
    expect(paneStore.getState().messages[0]?.content).toBe('你好')
    // 单例不被这条窗格的加载写入
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().conversationId).toBeNull()
  })

  it('两个窗格各自加载,互不覆盖', async () => {
    getMessagesMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          messages: [
            {
              id: 'a1',
              role: 'user',
              content: 'A',
              createdAt: new Date('2026-10-20T00:00:00Z').toISOString(),
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          messages: [
            {
              id: 'b1',
              role: 'user',
              content: 'B',
              createdAt: new Date('2026-10-20T00:00:00Z').toISOString(),
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      })

    render(
      <>
        <ChatPaneProvider paneId="pane-a">
          <ChatPaneBody paneId="pane-a" conversationId="conv-a" />
        </ChatPaneProvider>
        <ChatPaneProvider paneId="pane-b">
          <ChatPaneBody paneId="pane-b" conversationId="conv-b" />
        </ChatPaneProvider>
      </>,
    )

    const paneA = getChatStoreForPane('pane-a')
    const paneB = getChatStoreForPane('pane-b')
    await waitFor(() => {
      expect(paneA.getState().messages[0]?.content).toBe('A')
      expect(paneB.getState().messages[0]?.content).toBe('B')
    })
    expect(paneA.getState().conversationId).toBe('conv-a')
    expect(paneB.getState().conversationId).toBe('conv-b')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
