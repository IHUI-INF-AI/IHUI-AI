// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 语义折叠摘要接线锁(2026-10-29 立,对标 Qoder 借鉴清单第 4 项):
// 纯函数判据在 `src/lib/__tests__/fold-policy.test.ts`;本件只咬「装车」——
//  ① 完成态的带工具消息,过程组里必须出现一行折叠计数短语;
//  ② 流式中不出(此刻组头已经在说"正在做什么",再叠一句会打架);
//  ③ 只有单条 / 全是永不折叠工具时,摘要为空且不出现折叠开关(负例防假阳性);
//  ④ 点折叠开关后,被折成摘要的那批卡**真的从 DOM 消失**、group 行(等用户点一下)留下。
// 装配方式与同目录 message-item-activity-summary.test.tsx 一致:mock next-intl + TooltipProvider
// + 真 MessageItem。词包走 i18n 键名(mock 回显键名),不在这里复制任何中文文案。
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
import { useChatStore, type ChatMessage, type ToolCall } from '@/stores/chat'

const MESSAGE_ID = 'm-fold-summary'
const SUMMARY_TEST_ID = `message-fold-summary-${MESSAGE_ID}`
const TOGGLE_TEST_ID = `activity-fold-toggle-${MESSAGE_ID}`
const TOOL_ROW_SELECTOR = '[data-testid^="tool-call-row-"]'

let seq = 0
function tool(toolName: string, status: ToolCall['status'] = 'success'): ToolCall {
  seq += 1
  return { id: `tc-fold-${seq}`, toolName, status, args: {} }
}

function makeMessage(toolCalls: ToolCall[], overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: MESSAGE_ID,
    role: 'assistant',
    content: '已完成本轮任务。',
    createdAt: Date.now(),
    toolCalls,
    ...overrides,
  }
}

function renderMessage(message: ChatMessage, isStreaming = false) {
  return render(
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

function countMountedCards(container: HTMLElement): number {
  return container.querySelectorAll(TOOL_ROW_SELECTOR).length
}

beforeEach(() => {
  // 用 expanded 解除 D21 折叠策略这一层干扰:本件测的是「组内怎么呈现」,
  // 不是「组该不该默认收起」。走配置键常量,不复制字面量。
  window.localStorage.setItem(FOLD_POLICY_KEY, 'expanded')
})

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(FOLD_POLICY_KEY)
  useChatStore.setState({ messages: [] })
})

describe('语义折叠摘要(对标 Qoder 第 4 项)', () => {
  it('完成态:连续读文件 + 连续命令 ⇒ 组内出现两句计数短语', () => {
    renderMessage(
      makeMessage([
        tool('read_file'),
        tool('read_file'),
        tool('run_command'),
        tool('run_command'),
        tool('run_command'),
      ]),
    )
    const summary = screen.getByTestId(SUMMARY_TEST_ID)
    expect(summary.textContent).toContain('[foldReadFiles:2]')
    expect(summary.textContent).toContain('[foldCommands:3]')
  })

  it('流式中不抢跑:组头已在说"正在做什么",不再叠折叠摘要', () => {
    renderMessage(
      makeMessage([tool('read_file', 'running'), tool('read_file', 'running')]),
      true,
    )
    expect(screen.queryByTestId(SUMMARY_TEST_ID)).toBeNull()
  })

  it('负例:全是单条活动(无连续同类)⇒ 无摘要、无折叠开关', () => {
    renderMessage(makeMessage([tool('read_file'), tool('run_command'), tool('web_search')]))
    expect(screen.queryByTestId(SUMMARY_TEST_ID)).toBeNull()
    expect(screen.queryByTestId(TOGGLE_TEST_ID)).toBeNull()
  })

  it('负例:连续同类但含永不折叠工具 ⇒ 整组保留,摘要为空(不压成计数)', () => {
    renderMessage(makeMessage([tool('AskUserQuestion'), tool('AskUserQuestion')]))
    expect(screen.queryByTestId(SUMMARY_TEST_ID)).toBeNull()
    expect(screen.queryByTestId(TOGGLE_TEST_ID)).toBeNull()
  })

  it('点折叠开关:被折成摘要的那批卡从 DOM 消失,永不折叠的整组留下', () => {
    const { container } = renderMessage(
      makeMessage([
        tool('read_file'),
        tool('read_file'),
        tool('AskUserQuestion'),
        tool('AskUserQuestion'),
      ]),
    )
    // 展开前的卡数:4 张全挂(窗口上限 40 未越限)
    expect(countMountedCards(container)).toBe(4)

    fireEvent.click(screen.getByTestId(TOGGLE_TEST_ID))

    // 折叠后只剩那两张 AskUserQuestion(折了会丢入口的那一组)
    expect(countMountedCards(container)).toBe(2)
    const toggle = screen.getByTestId(TOGGLE_TEST_ID)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    // 再点回来:卡全部回来(可逆)
    fireEvent.click(toggle)
    expect(countMountedCards(container)).toBe(4)
  })

  it('折叠开关的文案走 i18n 两态(不硬编码中文)', () => {
    renderMessage(makeMessage([tool('read_file'), tool('read_file')]))
    const toggle = screen.getByTestId(TOGGLE_TEST_ID)
    expect(toggle.textContent).toContain('[activityFoldCollapse]')
    fireEvent.click(toggle)
    expect(toggle.textContent).toContain('[activityFoldShowAll]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
