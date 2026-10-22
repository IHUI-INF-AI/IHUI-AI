// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 票60 后续切片(2026-10-23):`ihui:toggle-reasoning` 的窗格门控。
 *
 * 改造前:派发侧(MessageList 键盘导航)detail 不带 paneId,监听侧(MessageItem)只按
 * messageId 匹配 ⇒ 两个窗格同时打开同一会话时,在 A 格聚焦消息按 Enter 会同时展开
 * B 格同一 messageId 的思考区(用户可见的跨窗格串话)。
 *
 * ① 正向:事件带本窗格 paneId ⇒ 本窗格思考区展开,别窗格不动;
 * ② 门控:事件属于别的窗格 ⇒ 本窗格不响应;
 * ③ 根单例零回归:无 Provider + detail 不带 paneId ⇒ 照旧展开;
 * ④ 反证:根窗格收到带非根 paneId 的事件 ⇒ 不响应;
 * ⑤ 派发侧装车证明:窗格 A 的键盘 Enter 派出的 detail.paneId 就是 A(而非 undefined)。
 */

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageList } from '@/components/chat/message-list/MessageList'
import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 10, 23, 0, 40, 0)
const SHARED_ID = 'm-shared-reasoning'
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

function reasoningMsg(): ChatMessage {
  return {
    id: SHARED_ID,
    role: 'assistant',
    content: '这是一条回复正文',
    reasoning: '这是一段思考内容',
    createdAt: NOW,
  }
}

function expandedIn(container: HTMLElement): string | null {
  return (
    container
      .querySelector('[data-testid="thinking-section"]')
      ?.getAttribute('data-thinking-expanded') ?? null
  )
}

function renderItemInPane(paneId: string) {
  getChatStoreForPane(paneId).setState({ messages: [reasoningMsg()] })
  return render(
    <TooltipProvider>
      <ChatPaneProvider paneId={paneId}>
        <MessageItem
          message={reasoningMsg()}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
        />
      </ChatPaneProvider>
    </TooltipProvider>,
  )
}

function renderItemAtRoot() {
  useChatStore.setState({ messages: [reasoningMsg()] })
  return render(
    <TooltipProvider>
      <MessageItem
        message={reasoningMsg()}
        isLast={false}
        isStreaming={false}
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

function dispatchToggle(detail: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new CustomEvent('ihui:toggle-reasoning', { detail }))
  })
}

beforeEach(() => {
  resetChatPaneStores()
  // MessageList 的滚动 hook 在挂载/追加时会调 scrollIntoView;jsdom 无此实现
  HTMLElement.prototype.scrollIntoView = vi.fn() as unknown as HTMLElement['scrollIntoView']
})

afterEach(() => {
  cleanup()
  resetChatPaneStores()
  useChatStore.setState({ messages: [] })
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
})

describe('MessageItem 的 toggle-reasoning 窗格门控(票60 后续切片)', () => {
  it('① 正向:事件带本窗格 paneId ⇒ 本窗格展开,别窗格不动', () => {
    const a = renderItemInPane('pane-tr-a')
    const b = renderItemInPane('pane-tr-b')
    expect(expandedIn(a.container)).toBe('false')
    expect(expandedIn(b.container)).toBe('false')

    dispatchToggle({ messageId: SHARED_ID, paneId: 'pane-tr-a' })

    expect(expandedIn(a.container)).toBe('true')
    expect(expandedIn(b.container)).toBe('false')
  })

  it('② 门控:事件属于别的窗格 ⇒ 本窗格不响应', () => {
    const a = renderItemInPane('pane-tr-c')
    dispatchToggle({ messageId: SHARED_ID, paneId: 'pane-tr-elsewhere' })
    expect(expandedIn(a.container)).toBe('false')
  })

  it('③ 根单例零回归:无 Provider + detail 不带 paneId ⇒ 照旧展开', () => {
    const root = renderItemAtRoot()
    expect(expandedIn(root.container)).toBe('false')
    dispatchToggle({ messageId: SHARED_ID })
    expect(expandedIn(root.container)).toBe('true')
  })

  it('④ 反证:根窗格收到带非根 paneId 的事件 ⇒ 不响应', () => {
    const root = renderItemAtRoot()
    dispatchToggle({ messageId: SHARED_ID, paneId: 'pane-tr-other' })
    expect(expandedIn(root.container)).toBe('false')
  })

  it('⑤ 派发侧:窗格 A 的键盘 Enter 派出的 detail.paneId 就是 A', () => {
    const captured: Array<{ messageId?: string; paneId?: string | null }> = []
    const onToggle = (e: Event) => {
      captured.push((e as CustomEvent<{ messageId?: string; paneId?: string | null }>).detail)
    }
    window.addEventListener('ihui:toggle-reasoning', onToggle)
    try {
      render(
        <TooltipProvider>
          <ChatPaneProvider paneId="pane-tr-dispatch">
            <MessageList
              messages={[reasoningMsg()]}
              isStreaming={false}
              emptyTitle="空"
              emptyHint="空提示"
              assistantLabel="助手"
            />
          </ChatPaneProvider>
        </TooltipProvider>,
      )
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      })
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      })
      expect(captured).toHaveLength(1)
      expect(captured[0]).toMatchObject({ messageId: SHARED_ID, paneId: 'pane-tr-dispatch' })
    } finally {
      window.removeEventListener('ihui:toggle-reasoning', onToggle)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
