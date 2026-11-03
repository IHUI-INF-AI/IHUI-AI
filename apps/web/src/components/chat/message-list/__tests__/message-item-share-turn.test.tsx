// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 差距⑤(2026-10-30 立):「分享此回合」深链入口用例。咬三件事:
//  ① 入口只给有序号可取的助手消息 —— turnOrdinal 为 null/undefined 或 user 行不渲染(不猜);
//  ② 点击复制的是 <origin>/chat?conversationId=X&turn=N 深链(与快照短链两条通道,互不混用);
//  ③ 会话未落库(无 conversationId)⇒ 静默不写剪贴板。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/components/common', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0)

let writeText: ReturnType<typeof vi.fn>

function seed(m: ChatMessage, turnOrdinal?: number | null) {
  useChatStore.setState({ conversationId: 'conv-1', messages: [m] })
  render(
    <TooltipProvider>
      <MessageItem
        message={m}
        isLast={false}
        isStreaming={false}
        assistantLabel="AI"
        turnOrdinal={turnOrdinal}
      />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [], conversationId: null })
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe('MessageItem · 「分享此回合」入口(差距⑤)', () => {
  it('助手消息 + 有序号 ⇒ 渲染 message-share-turn-* 入口', () => {
    seed({ id: 'a1', role: 'assistant', content: '回答', createdAt: NOW }, 3)
    expect(screen.getByTestId('message-share-turn-a1').getAttribute('aria-label')).toBe(
      '[message.shareTurn]',
    )
  })

  it('序号 null(截断/窗口不可推导)或不传 ⇒ 不渲染入口(不猜)', () => {
    seed({ id: 'a2', role: 'assistant', content: '回答', createdAt: NOW }, null)
    expect(screen.queryByTestId('message-share-turn-a2')).toBeNull()
    cleanup()

    seed({ id: 'a3', role: 'assistant', content: '回答', createdAt: NOW })
    expect(screen.queryByTestId('message-share-turn-a3')).toBeNull()
  })

  it('user 消息即使带序号也不渲染入口', () => {
    seed({ id: 'u1', role: 'user', content: '提问', createdAt: NOW }, 2)
    expect(screen.queryByTestId('message-share-turn-u1')).toBeNull()
  })

  it('点击 → 剪贴板写入回合深链,toast 成功', async () => {
    seed({ id: 'a4', role: 'assistant', content: '回答', createdAt: NOW }, 7)
    fireEvent.click(screen.getByTestId('message-share-turn-a4'))
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/chat?conversationId=conv-1&turn=7`,
      )
    })
    expect(toastSuccess).toHaveBeenCalledWith('[message.shareTurnCopied]')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('会话未落库(无 conversationId)⇒ 点击静默,不写剪贴板', () => {
    const m: ChatMessage = { id: 'a5', role: 'assistant', content: '回答', createdAt: NOW }
    useChatStore.setState({ conversationId: null, messages: [m] })
    render(
      <TooltipProvider>
        <MessageItem
          message={m}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
          turnOrdinal={1}
        />
      </TooltipProvider>,
    )
    fireEvent.click(screen.getByTestId('message-share-turn-a5'))
    expect(writeText).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
