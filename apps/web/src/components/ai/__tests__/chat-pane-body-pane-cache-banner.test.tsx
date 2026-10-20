// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票60 步序六(2026-10-21):非根窗格主体的两处收口取证。
//  ① 片 A:ChatPaneBody 接上窗格化缓存出口后,切回看过的会话必须**同步**铺出缓存快照
//     (此时后台复核还在飞),而不是像改造前那样清成空列表再全量重取;
//  ② 片 B:metadata 带导入来源时非根窗格渲染同一条来源横幅(不带时不渲染,正向对照成对)。

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

const { getConversationMock, getMessagesMock, pendingInitialPages } = vi.hoisted(() => ({
  getConversationMock: vi.fn(),
  getMessagesMock: vi.fn(),
  pendingInitialPages: [] as Array<(value: unknown) => void>,
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
  MessageList: (props: { messages: unknown[]; isLoading?: boolean }) => (
    <div
      data-testid="message-list"
      data-messages={props.messages.length}
      data-loading={String(Boolean(props.isLoading))}
    />
  ),
}))
vi.mock('@/components/chat/message-input', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}))
vi.mock('@/components/chat/question-dialog', () => ({
  QuestionDialog: () => null,
}))

import { ChatPaneBody } from '@/components/ai/chat-pane-body'
import { ImportProvenanceSlot } from '@/components/ai/import-source-banner'
import { resetConversationCache } from '@/hooks/use-conversation-pane-cache'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore } from '@/stores/chat'
import type { ImportProvenance } from '@ihui/shared/import-analysis'

const PANE_ID = 'pane-a'

function wireRow(content: string): {
  id: string
  role: string
  content: string
  createdAt: string
} {
  return {
    id: `row-${content}`,
    role: 'user',
    content,
    createdAt: new Date('2026-10-21T00:00:00Z').toISOString(),
  }
}

/** 首屏页一律走 deferred:用例自己决定什么时候结算,才能证明数据来自缓存而不是网络 */
function initialPage(content: string): void {
  const resolve = pendingInitialPages.shift()
  if (!resolve) throw new Error('没有等待结算的首屏请求')
  resolve({
    success: true,
    data: { messages: [wireRow(content)], nextCursor: `cursor-${content}`, hasMore: true },
  })
}

function renderPane(conversationId: string) {
  return render(
    <ChatPaneProvider paneId={PANE_ID}>
      <ChatPaneBody paneId={PANE_ID} conversationId={conversationId} />
    </ChatPaneProvider>,
  )
}

const WECHAT_PROVENANCE_METADATA = {
  importedFrom: 'claude_code',
  importedVia: 'conversation-import',
  fileName: 'session.jsonl',
}

beforeEach(() => {
  cleanup()
  resetChatPaneStores()
  resetConversationCache()
  pendingInitialPages.length = 0
  useChatStore.setState({ messages: [], conversationId: null, isStreaming: false, error: null })
  getConversationMock.mockReset()
  getMessagesMock.mockReset()
  getConversationMock.mockResolvedValue({
    success: true,
    data: { conversation: { title: '会话', metadata: null } },
  })
  getMessagesMock.mockImplementation((_id: string, opts: { direction?: string }) => {
    if (opts?.direction === 'older') {
      return Promise.resolve({
        success: true,
        data: { messages: [], nextCursor: null, hasMore: false },
      })
    }
    return new Promise((resolve) => {
      pendingInitialPages.push(resolve)
    })
  })
})

describe('非根窗格接上窗格化缓存(片 A)', () => {
  it('切回看过的会话时同步铺出缓存快照,而后台复核仍在飞(改造前这里是被清空的)', async () => {
    const view = renderPane('conv-1')
    expect(pendingInitialPages).toHaveLength(1)
    initialPage('第一页的内容')
    const paneStore = getChatStoreForPane(PANE_ID)
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('第一页的内容'))

    view.rerender(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId="conv-2" />
      </ChatPaneProvider>,
    )
    expect(pendingInitialPages).toHaveLength(1)
    initialPage('第二页的内容')
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('第二页的内容'))

    pendingInitialPages.length = 0
    view.rerender(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId="conv-1" />
      </ChatPaneProvider>,
    )
    // 此刻 conv-1 的复核请求还没被结算 ⇒ 消息只能来自本窗格的缓存
    expect(pendingInitialPages).toHaveLength(1)
    expect(paneStore.getState().messages[0]?.content).toBe('第一页的内容')
    initialPage('第一页的内容(服务端最新)')
    await waitFor(() =>
      expect(paneStore.getState().messages[0]?.content).toBe('第一页的内容(服务端最新)'),
    )
  })

  it('正向对照:切到没看过的会话仍然清空并按窗格各自取数(缓存不是"什么都当看过")', async () => {
    const view = renderPane('conv-1')
    initialPage('第一页的内容')
    const paneStore = getChatStoreForPane(PANE_ID)
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('第一页的内容'))

    view.rerender(
      <ChatPaneProvider paneId={PANE_ID}>
        <ChatPaneBody paneId={PANE_ID} conversationId="conv-9" />
      </ChatPaneProvider>,
    )
    expect(paneStore.getState().messages).toHaveLength(0)
    initialPage('第九页的内容')
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('第九页的内容'))
  })

  it('另一窗格承载同一条会话时自己去拉,不沿用本窗格已经加载的那一份', async () => {
    const view = renderPane('conv-1')
    initialPage('本窗格的内容')
    const paneStore = getChatStoreForPane(PANE_ID)
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('本窗格的内容'))

    // 同一 conversationId 由另一个窗格承载:它必须自己去拉,而不是沿用上面那次翻页进度
    const other = getChatStoreForPane('pane-z')
    expect(other).not.toBe(paneStore)
    view.rerender(
      <ChatPaneProvider paneId="pane-z">
        <ChatPaneBody paneId="pane-z" conversationId="conv-1" />
      </ChatPaneProvider>,
    )
    // 另一窗格没看过这条会话 ⇒ 这一刻必须是空的;要是它把 pane-a 的快照同步铺上来,
    // 就是"键里没有窗格维"的那一型(读到别个窗格的历史,还自以为命中了缓存)
    expect(other.getState().messages).toHaveLength(0)
    expect(pendingInitialPages).toHaveLength(1)
    initialPage('另一窗格自己拉的')
    await waitFor(() => expect(other.getState().messages[0]?.content).toBe('另一窗格自己拉的'))
    expect(paneStore.getState().messages[0]?.content).toBe('本窗格的内容')
  })
})

describe('导入来源横幅接进非根窗格(片 B)', () => {
  it('metadata 带导入来源 ⇒ 非根窗格渲染来源横幅(与根窗格同一组件)', async () => {
    getConversationMock.mockResolvedValue({
      success: true,
      data: {
        conversation: { title: '导入的会话', metadata: WECHAT_PROVENANCE_METADATA },
      },
    })
    const view = renderPane('conv-1')
    initialPage('张三：明天上线')
    await waitFor(() => {
      const banner = view.container.querySelector('[data-testid="import-source-banner"]')
      expect(banner).not.toBeNull()
      expect(banner?.getAttribute('data-source')).toBe('claude_code')
    })
    // 槽位也在(横幅不是孤零零挂在别处,而是与根窗格同一个槽位实现)
    expect(view.container.querySelector('[data-testid="import-provenance-slot"]')).not.toBeNull()
  })

  it('正向对照:自建会话(metadata 无来源)⇒ 非根窗格整块不渲染,不留占位', async () => {
    const view = renderPane('conv-1')
    initialPage('普通对话')
    const paneStore = getChatStoreForPane(PANE_ID)
    await waitFor(() => expect(paneStore.getState().messages[0]?.content).toBe('普通对话'))
    expect(view.container.querySelector('[data-testid="import-source-banner"]')).toBeNull()
    expect(view.container.querySelector('[data-testid="import-provenance-slot"]')).toBeNull()
  })
})

describe('来源槽位单一实现的两档入参(根与非根)', () => {
  const PROVENANCE: ImportProvenance = {
    source: 'claude_code',
    via: 'conversation-import',
    fileName: 'session.jsonl',
    speakers: [],
    startedAt: null,
    endedAt: null,
  }

  it('根窗格档:给 onOpenAnalysis ⇒ 横幅 + 分析入口都在(对话框由调用方持有)', () => {
    const view = render(<ImportProvenanceSlot provenance={PROVENANCE} onOpenAnalysis={vi.fn()} />)
    expect(view.container.querySelector('[data-testid="import-source-banner"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="import-analysis-open"]')).not.toBeNull()
  })

  it('非根窗格档:不给 onOpenAnalysis ⇒ 只有横幅,不挂一个点了不落在本窗格的按钮', () => {
    const view = render(<ImportProvenanceSlot provenance={PROVENANCE} />)
    expect(view.container.querySelector('[data-testid="import-source-banner"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="import-analysis-open"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
