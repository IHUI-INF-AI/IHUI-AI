// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):非根窗格闭合「用场景分析」链路 —— 上一批只给了横幅(不给一个点了
// 不落在本窗格的按钮),弹窗草稿写根单例的缺陷由 import-analysis-dialog-pane-draft.test.tsx
// 那条用例根治;本文件咬"入口 + 弹窗真的挂在窗格里"这一格。
// 成对:导入会话 ⇒ 入口在、点开弹窗挂上;自建会话 ⇒ 整块不渲染(不留空壳弹窗)。

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

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
  MessageList: () => <div data-testid="message-list" />,
}))
vi.mock('@/components/chat/message-input', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}))
vi.mock('@/components/chat/question-dialog', () => ({
  QuestionDialog: () => null,
}))

import { ChatPaneBody } from '@/components/ai/chat-pane-body'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { resetChatPaneStores } from '@/stores/chat-panes'
import { resetConversationCache } from '@/hooks/use-conversation-pane-cache'
import { useChatStore } from '@/stores/chat'

const PANE_ID = 'pane-analysis-mount'
const IMPORTED_METADATA = {
  importedFrom: 'claude_code',
  importedVia: 'conversation-import',
  fileName: 'session.jsonl',
}

function wireRow(content: string): {
  id: string
  role: string
  content: string
  createdAt: string
} {
  return { id: `row-${content}`, role: 'user', content, createdAt: '2026-10-21T00:00:00.000Z' }
}

beforeEach(() => {
  cleanup()
  resetChatPaneStores()
  resetConversationCache()
  useChatStore.setState({
    messages: [],
    conversationId: null,
    draftInput: null,
    draftAutoSend: false,
  })
  getConversationMock.mockReset()
  getMessagesMock.mockReset()
  getMessagesMock.mockResolvedValue({
    success: true,
    data: { messages: [wireRow('明天上线')], nextCursor: null, hasMore: false },
  })
})

function renderPane(): void {
  render(
    <ChatPaneProvider paneId={PANE_ID}>
      <ChatPaneBody paneId={PANE_ID} conversationId="conv-mount" />
    </ChatPaneProvider>,
  )
}

describe('非根窗格的「用场景分析」挂载(片3)', () => {
  it('导入会话 ⇒ 分析入口在,点开即挂上弹窗(与根窗格同一组件)', async () => {
    getConversationMock.mockResolvedValue({
      success: true,
      data: { conversation: { title: '导入会话', metadata: IMPORTED_METADATA } },
    })
    renderPane()

    const open = await waitFor(() => {
      const el = document.querySelector('[data-testid="import-analysis-open"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    fireEvent.click(open)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="import-analysis-dialog-title"]')).not.toBeNull()
    })
  })

  it('正向对照:自建会话(metadata 无来源)⇒ 入口与弹窗整块不渲染', async () => {
    getConversationMock.mockResolvedValue({
      success: true,
      data: { conversation: { title: '自建会话', metadata: null } },
    })
    renderPane()

    await waitFor(() => expect(getMessagesMock).toHaveBeenCalled())
    expect(document.querySelector('[data-testid="import-provenance-slot"]')).toBeNull()
    expect(document.querySelector('[data-testid="import-analysis-open"]')).toBeNull()
    expect(document.querySelector('[data-testid="import-analysis-dialog-title"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
