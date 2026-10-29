// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 大屏指挥台 · 活动语义摘要接线锁(2026-10-29 立):
// 纯函数(snapshot)在 lib 层已有用例;本件只咬"装车"—— 完成的带工具消息,
// 过程组头必须出现类目摘要;流式中不得抢跑;零工具消息不得凭空造摘要。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm-summary',
    role: 'assistant',
    content: '已完成本轮任务。',
    createdAt: Date.now(),
    ...overrides,
  }
}

function renderMessage(message: ChatMessage, isStreaming = false) {
  // streamingThis = isStreaming && isLast（MessageItem 内的既定判据），
  // 流式用例必须同时给 isLast —— 否则测的是"历史消息 + 流式开关"的错配组合。
  render(
    <TooltipProvider>
      <MessageItem
        message={message}
        isLast={isStreaming}
        isStreaming={isStreaming}
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('活动语义摘要(大屏指挥台)', () => {
  it('完成态:三类工具 → 组头出现文件/检索/分析三段摘要', () => {
    renderMessage(
      makeMessage({
        toolCalls: [
          { id: 't1', toolName: 'read_file', status: 'success', args: {} },
          { id: 't2', toolName: 'web_search', status: 'success', args: {} },
          { id: 't3', toolName: 'analyze_code', status: 'success', args: {} },
        ],
      }),
    )
    const trigger = screen.getByTestId('message-steps-group-m-summary')
    expect(trigger.textContent).toContain('[summaryFiles]')
    expect(trigger.textContent).toContain('[summarySearches]')
    expect(trigger.textContent).toContain('[summaryThinking]')
  })

  it('流式中不抢跑:组头走"此刻在做什么",不出现类目摘要', () => {
    renderMessage(
      makeMessage({
        toolCalls: [{ id: 't1', toolName: 'read_file', status: 'running', args: {} }],
      }),
      true,
    )
    const trigger = screen.getByTestId('message-steps-group-m-summary')
    expect(trigger.textContent).not.toContain('[summaryFiles]')
  })

  it('零工具消息不造摘要(负例防假阳性)', () => {
    renderMessage(makeMessage({ content: '纯文本回答。' }))
    expect(screen.queryByTestId('message-steps-group-m-summary')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
