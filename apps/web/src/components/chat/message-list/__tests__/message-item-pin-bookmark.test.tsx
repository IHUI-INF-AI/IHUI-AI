// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票64(消息级 pin/书签)web 消费面用例(2026-10-18 立)。咬的是三件"只有界面能证"的事:
//  ① 一次点击只动它点的那一把 —— 请求体里不得出现另一把维度的键(服务端把"没给"当"不动");
//  ② 界面态取服务端回写的时刻,不取乐观翻转 —— 响应没给 pinnedAt 就必须是未钉选,
//     失败信封更不得改本地态(把"库没写进去"渲染成"已经钉上了"是刷新才自证其伪的那一型);
//  ③ 历史水合按名列清单,不在清单上的字段会被静默丢掉 ⇒ 刷新后标记"看起来没存住"。
// 与 message-item-interrupted-line.test.tsx 同纪律:喂真 store + 真 MessageItem,不 mock 组件本体。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const takeWordCalls: Array<string> = []
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string => {
      takeWordCalls.push(key)
      return `[${key}]`
    },
  useLocale: () => 'zh-CN',
}))

const setMessageFlagsMock = vi.hoisted(() => vi.fn())
vi.mock('@ihui/api-client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, setMessageFlags: setMessageFlagsMock }
})

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { hydrateHistoryMessage } from '@/hooks/use-chat/history-message'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
const STAMP = new Date(NOW).toISOString()

function seedMessage(m: ChatMessage) {
  useChatStore.setState({ messages: [m] })
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  takeWordCalls.length = 0
  setMessageFlagsMock.mockReset()
  useChatStore.setState({ messages: [] })
})

describe('MessageItem 钉选/收藏按钮(票64 渲染位)', () => {
  it('未标记的 AI 消息 → 两枚按钮都在,按压态为 false,取词是"钉选/收藏"两个键', () => {
    seedMessage({ id: 'a1', role: 'assistant', content: '回答', createdAt: NOW })
    const pin = screen.getByTestId('message-pin-a1')
    const bookmark = screen.getByTestId('message-bookmark-a1')
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    expect(bookmark.getAttribute('aria-pressed')).toBe('false')
    expect(pin.getAttribute('aria-label')).toBe('[message.pin]')
    expect(bookmark.getAttribute('aria-label')).toBe('[message.bookmark]')
  })

  it('已钉选(服务端盖章时刻)→ 图标切到"取消钉选",按压态 true(态取盖章值不是本地布尔)', () => {
    seedMessage({
      id: 'a2',
      role: 'assistant',
      content: '回答',
      createdAt: NOW,
      pinnedAt: STAMP,
    })
    const pin = screen.getByTestId('message-pin-a2')
    expect(pin.getAttribute('aria-pressed')).toBe('true')
    expect(pin.getAttribute('aria-label')).toBe('[message.unpin]')
  })

  it('点钉选 → 请求体只带 pinned,不夹带 bookmarked(一次点击只动它点的那一把)', async () => {
    setMessageFlagsMock.mockResolvedValue({
      success: true,
      data: { message: { id: 'a3', pinnedAt: STAMP, bookmarkedAt: null } },
    })
    seedMessage({ id: 'a3', role: 'assistant', content: '回答', createdAt: NOW })
    screen.getByTestId('message-pin-a3').click()
    await vi.waitFor(() => {
      expect(setMessageFlagsMock).toHaveBeenCalledWith({ messageId: 'a3', pinned: true })
    })
    const sent = setMessageFlagsMock.mock.calls[0]?.[0] ?? {}
    expect('bookmarked' in sent).toBe(false)
  })

  it('点已钉选 → 发 pinned:false(撤销是显式写 null,不是"少写一个字段")', async () => {
    setMessageFlagsMock.mockResolvedValue({
      success: true,
      data: { message: { id: 'a4', pinnedAt: null, bookmarkedAt: null } },
    })
    seedMessage({
      id: 'a4',
      role: 'assistant',
      content: '回答',
      createdAt: NOW,
      pinnedAt: STAMP,
    })
    screen.getByTestId('message-pin-a4').click()
    await vi.waitFor(() => {
      expect(setMessageFlagsMock).toHaveBeenCalledWith({ messageId: 'a4', pinned: false })
    })
    await vi.waitFor(() => {
      expect(useChatStore.getState().messages[0]?.pinnedAt).toBeNull()
    })
  })

  it('成功回写 → store 取服务端那一行的两个时刻(收藏没被这次点击改动)', async () => {
    setMessageFlagsMock.mockResolvedValue({
      success: true,
      data: { message: { id: 'a5', pinnedAt: STAMP, bookmarkedAt: 'B' } },
    })
    seedMessage({
      id: 'a5',
      role: 'assistant',
      content: '回答',
      createdAt: NOW,
      bookmarkedAt: 'OLD',
    })
    screen.getByTestId('message-pin-a5').click()
    await vi.waitFor(() => {
      const m = useChatStore.getState().messages[0]
      expect(m?.pinnedAt).toBe(STAMP)
      expect(m?.bookmarkedAt).toBe('B')
    })
  })

  it('阳性对照:成功但服务端没给 pinnedAt → 判未钉选(null,不是留着旧值遮成"还在")', async () => {
    setMessageFlagsMock.mockResolvedValue({ success: true, data: { message: {} } })
    seedMessage({
      id: 'a6',
      role: 'assistant',
      content: '回答',
      createdAt: NOW,
      pinnedAt: STAMP,
    })
    screen.getByTestId('message-pin-a6').click()
    await vi.waitFor(() => {
      expect(useChatStore.getState().messages[0]?.pinnedAt).toBeNull()
    })
  })

  it('失败信封 → 本地态一字不改(不做乐观翻转),并取失败话术键', async () => {
    setMessageFlagsMock.mockResolvedValue({ success: false, error: '无权修改该消息', status: 403 })
    seedMessage({ id: 'a7', role: 'assistant', content: '回答', createdAt: NOW })
    screen.getByTestId('message-bookmark-a7').click()
    await vi.waitFor(() => {
      expect(takeWordCalls).toContain('message.flagFailed')
    })
    expect(useChatStore.getState().messages[0]?.bookmarkedAt ?? null).toBeNull()
  })

  it('system 消息 → 两枚按钮不出现(标记是给会话参与者用的,不是给系统帧用的)', () => {
    seedMessage({ id: 'a8', role: 'system', content: '系统提示', createdAt: NOW })
    expect(screen.queryByTestId('message-pin-a8')).toBeNull()
    expect(screen.queryByTestId('message-bookmark-a8')).toBeNull()
  })
})

describe('历史水合 · 标记时刻读回(票64)', () => {
  it('行带两把时刻 → 挂到消息字段', () => {
    const m = hydrateHistoryMessage({
      id: 'h1',
      role: 'assistant',
      content: '回答',
      createdAt: new Date(NOW).toISOString(),
      pinnedAt: STAMP,
      bookmarkedAt: STAMP,
    })
    expect(m.pinnedAt).toBe(STAMP)
    expect(m.bookmarkedAt).toBe(STAMP)
  })

  it('行不带 → 落成 null(不是 undefined:hydrate 按名列清单,漏列就是静默丢维)', () => {
    const m = hydrateHistoryMessage({
      id: 'h2',
      role: 'assistant',
      content: '回答',
      createdAt: new Date(NOW).toISOString(),
    })
    expect(m.pinnedAt).toBeNull()
    expect(m.bookmarkedAt).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
