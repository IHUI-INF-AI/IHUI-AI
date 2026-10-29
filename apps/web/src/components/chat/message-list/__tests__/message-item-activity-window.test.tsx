// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 工具卡窗口化接线锁(2026-10-29 立):
// 纯函数判据在 `src/lib/__tests__/activity-window.test.ts`;本件只咬"装车"——
// 一条消息里 41 个工具调用时,折叠组内只挂 40 张卡 + 一个「展开其余 1 项」按钮,
// 点击后 41 张卡全挂且按钮消失;40 个(未越限)时不出现按钮。
// 装配方式与同目录 message-item-activity-summary.test.tsx 一致:next-intl mock +
// TooltipProvider + 真 MessageItem,不 mock 被测组件本身。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      typeof values?.n === 'number' ? `[${key}:${values.n}]` : `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { FOLD_POLICY_KEY } from '@/components/chat/message-list/fold-policy'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { ACTIVITY_WINDOW_LIMIT } from '@/lib/activity-window'

const MESSAGE_ID = 'm-activity-window'
const EXPAND_TEST_ID = `activity-expand-more-${MESSAGE_ID}`
/** 每张工具卡的行根节点 testid 前缀(ToolCallCard → StreamRow 的 testId)。 */
const TOOL_ROW_SELECTOR = '[data-testid^="tool-call-row-"]'

function makeToolCalls(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `tc-${index}`,
    toolName: 'read_file',
    status: 'success' as const,
    args: {},
  }))
}

function makeMessage(toolCallCount: number): ChatMessage {
  return {
    id: MESSAGE_ID,
    role: 'assistant',
    content: '已完成本轮任务。',
    createdAt: Date.now(),
    toolCalls: makeToolCalls(toolCallCount),
  }
}

function renderMessage(toolCallCount: number) {
  return render(
    <TooltipProvider>
      <MessageItem
        message={makeMessage(toolCallCount)}
        isLast={false}
        isStreaming={false}
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

function countMountedCards(container: HTMLElement): number {
  return container.querySelectorAll(TOOL_ROW_SELECTOR).length
}

beforeEach(() => {
  // 41 个工具调用在 auto 折叠策略下默认收起,组内容根本不挂载 —— 本文件要测的是
  // "组展开后挂多少张卡",故把折叠策略置为 expanded 解除这一层干扰(走配置键常量,
  // 不在测试里复制字面量)。窗口化本身与折叠策略无关。
  window.localStorage.setItem(FOLD_POLICY_KEY, 'expanded')
})

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(FOLD_POLICY_KEY)
  useChatStore.setState({ messages: [] })
})

describe('工具卡窗口化(长列表只挂首段)', () => {
  it('41 个工具调用:默认只挂 ACTIVITY_WINDOW_LIMIT 张 + 「展开其余 1 项」按钮', () => {
    const { container } = renderMessage(ACTIVITY_WINDOW_LIMIT + 1)

    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT)
    const expandButton = screen.getByTestId(EXPAND_TEST_ID)
    // 文案经 i18n(mock 把插值 n 带出来,验证 hiddenCount 真传到了词里)
    expect(expandButton.textContent).toContain('[activityExpandMore:1]')
  })

  it('点击展开后:41 张卡全挂载,按钮消失', () => {
    const { container } = renderMessage(ACTIVITY_WINDOW_LIMIT + 1)
    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT)

    fireEvent.click(screen.getByTestId(EXPAND_TEST_ID))

    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT + 1)
    expect(screen.queryByTestId(EXPAND_TEST_ID)).toBeNull()
  })

  it('负例:恰好 ACTIVITY_WINDOW_LIMIT 个(未越限)不出现按钮', () => {
    const { container } = renderMessage(ACTIVITY_WINDOW_LIMIT)

    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT)
    expect(screen.queryByTestId(EXPAND_TEST_ID)).toBeNull()
  })

  it('展开后流式追加:保持展开,新条目照常挂载且按钮不回来', () => {
    const { container, rerender } = renderMessage(ACTIVITY_WINDOW_LIMIT + 1)
    fireEvent.click(screen.getByTestId(EXPAND_TEST_ID))
    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT + 1)

    rerender(
      <TooltipProvider>
        <MessageItem
          message={makeMessage(ACTIVITY_WINDOW_LIMIT + 5)}
          isLast
          isStreaming
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )

    expect(countMountedCards(container)).toBe(ACTIVITY_WINDOW_LIMIT + 5)
    expect(screen.queryByTestId(EXPAND_TEST_ID)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
