// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):ChatPaneBody 的续接段(此前非根窗格完全没有续接分支)。
// 正向 = 历史快照覆盖掉"未落库的半截助手消息"后,本窗格 store 被续接补回并回填权威内容,
// 根单例快照零变化;反证在 resume-stream-pane-store.test.ts(摘掉注入必须落根单例)。

// @vitest-environment jsdom

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

// 续接的 status 查询恒报"已落库 + 权威全文" ⇒ 不消耗 LLM,直接回填(可区分"补回"与"重生成")
const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchApi: fetchApiMock,
}))

import { ChatPaneBody, shouldPrefillRecentMessages } from '@/components/ai/chat-pane-body'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore } from '@/stores/chat'
import { resetConversationCache } from '@/hooks/use-conversation-pane-cache'

const PANE_ID = 'pane-resume'
const CONV = 'conv-resume'
const HALF = '已生成的前半段'
const AUTHORITATIVE = '服务端权威全文'

function wireRow(
  id: string,
  role: string,
  content: string,
): {
  id: string
  role: string
  content: string
  createdAt: string
} {
  return { id, role, content, createdAt: new Date('2026-10-21T00:00:00Z').toISOString() }
}

beforeEach(() => {
  resetChatPaneStores()
  resetConversationCache()
  useChatStore.setState({
    conversationId: 'root-other',
    messages: [{ id: 'root-1', role: 'user', content: '根窗格的消息', createdAt: 1 }],
    isStreaming: false,
    error: null,
  })
  getConversationMock.mockReset()
  getMessagesMock.mockReset()
  fetchApiMock.mockReset()
  getConversationMock.mockResolvedValue({
    success: true,
    data: { conversation: { title: '会话', metadata: null } },
  })
  // 服务端快照只有用户消息 —— 未落库的半截助手消息不在其中(续接场景的成因)
  getMessagesMock.mockResolvedValue({
    success: true,
    data: { messages: [wireRow('u1', 'user', '问题')], nextCursor: null, hasMore: false },
  })
  fetchApiMock.mockResolvedValue({
    success: true,
    data: { exists: true, completed: true, content: AUTHORITATIVE, updatedAt: 1 },
  })
})

describe('ChatPaneBody 续接段(片3)', () => {
  it('正向:半截助手消息被补回并回填权威内容,写在窗格 store;根单例零变化', async () => {
    const pane = getChatStoreForPane(PANE_ID)
    // 同会话重挂载(switching=false)⇒ 本地半截消息被保留,续接候选在覆盖前被捕获
    pane.setState({
      conversationId: CONV,
      messages: [
        { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
        {
          id: 'a-half',
          role: 'assistant',
          content: HALF,
          createdAt: 2,
          streamCompleted: false,
        },
      ],
    })
    const rootBefore = useChatStore.getState().messages

    render(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId={CONV} />
      </ChatPaneProvider>,
    )

    await waitFor(() => {
      const back = pane.getState().messages.find((m) => m.id === 'a-half')
      expect(back?.content).toBe(AUTHORITATIVE)
      expect(back?.streamCompleted).toBe(true)
    })
    // status 查询发的是"本窗格承载的会话/消息"(取数面没串到根)
    const [statusUrl] = fetchApiMock.mock.calls[0] as unknown as [string]
    expect(statusUrl).toContain(`conversationId=${CONV}`)
    expect(statusUrl).toContain('messageId=a-half')
    // 根单例一个字没被写
    expect(useChatStore.getState().messages).toBe(rootBefore)
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['root-1'])
  })

  it('反证(缺省回落面在单元档钉):窗格 store 里没有半截消息 ⇒ 不发任何续接请求(不无中生有)', async () => {
    const pane = getChatStoreForPane(PANE_ID)
    pane.setState({
      conversationId: CONV,
      messages: [{ id: 'u1', role: 'user', content: '问题', createdAt: 1 }],
    })

    render(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId={CONV} />
      </ChatPaneProvider>,
    )

    await waitFor(() => expect(getMessagesMock).toHaveBeenCalled())
    await waitFor(() => expect(pane.getState().messages).toHaveLength(1))
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['root-1'])
  })

  it('预填(G-935 缺口B):messages 为空但 recentMessages 匹配 ⇒ 半截消息仍被捕获并续接', async () => {
    const pane = getChatStoreForPane(PANE_ID)
    // reload 后的真实形态:messages 未被 persist 恢复(避免 hydration mismatch),
    // 半截助手消息只躺在 recentMessages 里。
    pane.setState({
      conversationId: CONV,
      messages: [],
      recentMessages: {
        conversationId: CONV,
        messages: [
          { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
          { id: 'a-half', role: 'assistant', content: HALF, createdAt: 2, streamCompleted: false },
        ],
      },
    })

    render(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId={CONV} />
      </ChatPaneProvider>,
    )

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
    const [statusUrl] = fetchApiMock.mock.calls[0] as unknown as [string]
    expect(statusUrl).toContain(`conversationId=${CONV}`)
    expect(statusUrl).toContain('messageId=a-half')
    await waitFor(() => {
      const back = pane.getState().messages.find((m) => m.id === 'a-half')
      expect(back?.content).toBe(AUTHORITATIVE)
      expect(back?.streamCompleted).toBe(true)
    })
  })
})

describe('shouldPrefillRecentMessages 判据', () => {
  const matching = { conversationId: CONV, messages: [{ id: 'a-half' }] }

  it('messages 为空 + 同会话 ⇒ 预填', () => {
    expect(
      shouldPrefillRecentMessages({ messages: [], recentMessages: matching }, CONV, false),
    ).toBe(true)
  })

  it('缓存命中不覆盖(即使 messages 为空)', () => {
    expect(
      shouldPrefillRecentMessages({ messages: [], recentMessages: matching }, CONV, true),
    ).toBe(false)
  })

  it('messages 非空 / 会话不匹配 / recentMessages 缺失 ⇒ 不预填', () => {
    expect(
      shouldPrefillRecentMessages(
        { messages: [{ id: 'x' }], recentMessages: matching },
        CONV,
        false,
      ),
    ).toBe(false)
    expect(
      shouldPrefillRecentMessages({ messages: [], recentMessages: matching }, 'conv-other', false),
    ).toBe(false)
    expect(shouldPrefillRecentMessages({ messages: [], recentMessages: null }, CONV, false)).toBe(
      false,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
