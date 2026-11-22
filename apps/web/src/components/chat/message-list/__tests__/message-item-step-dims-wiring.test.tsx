// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 消息级「中间步骤」开关的语义例外接线锁(2026-10-29 立)。
 *
 * 在修什么:`MessageItem.tsx` 的 `stepDims` 此前只喂三维(字数/工具数/耗时),
 * 于是 `FoldPolicyInput.toolNames` 的语义例外集(`NEVER_FOLD_TOOLS` + 类目级 neverFold)
 * 只在**类目卡层**生效 —— 消息级那一个开关吃不到,含 `AskUserQuestion` / `Agent` / `ImageGen`
 * 这类"等人回话 / 子代理树 / 独立 UI"的轮次,三维读数一大照样被折起来。
 *
 * 本件只咬"装车":同样三维读数(全部远超阈值),仅差一枚例外工具,
 * `StreamGroup` trigger 的 `aria-expanded` 必须一真一假。
 * 判据本身不在这里复制(§0.6):本件只读生产组件的可见结果。
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      values ? `[${key}]${JSON.stringify(values)}` : `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage, type ToolCall } from '@/stores/chat'

function makeMessage(toolCalls: ToolCall[], overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm-fold',
    role: 'assistant',
    // 正文远超 AUTO_COLLAPSE_CHARS(200),保证"纯三维判据"必然判折叠
    content: 'A'.repeat(2000),
    createdAt: Date.now(),
    toolCalls,
    ...overrides,
  }
}

function renderMessage(message: ChatMessage) {
  render(
    <TooltipProvider>
      <MessageItem message={message} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
  return readStepsTrigger()
}

/** 读过程组 trigger 的展开态(每次 cleanup 后只有一份 DOM)。 */
function readStepsTrigger(): HTMLElement {
  const trigger = screen.getByTestId('message-steps-group-m-fold')
  const button = trigger.querySelector('[data-stream-group-trigger="true"]')
  expect(button).not.toBeNull()
  return button as HTMLElement
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  useChatStore.setState({ messages: [] })
})

// 三维全超阈值的"重任务"读数:纯数值判据必然折叠(与 fold-policy 阈值无关,量级远超)
const HEAVY = 40

function manyTools(names: string[]): ToolCall[] {
  const calls: ToolCall[] = []
  for (let i = 0; i < HEAVY; i += 1) {
    calls.push({
      id: `t-${i}`,
      toolName: names[i % names.length] as string,
      status: 'success',
      args: {},
    })
  }
  return calls
}

/** 追加一枚"例外族"工具(运行中,便于同时验证 isExploring 之外的语义维)。 */
function pushTool(calls: ToolCall[], id: string, toolName: string): void {
  calls.push({ id, toolName, status: 'running', args: {} })
}

describe('消息级折叠 · 语义例外集已接进 stepDims(成对)', () => {
  it('阳性对照:同规格但不含例外工具 ⇒ 折叠(aria-expanded=false,证明三维判据没被削弱)', () => {
    const button = renderMessage(makeMessage(manyTools(['read_file', 'bash'])))
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('同规格 + 一枚 AskUserQuestion(等人回话)⇒ 展开(语义压过三维阈值)', () => {
    const calls = manyTools(['read_file', 'bash'])
    pushTool(calls, 't-ask', 'AskUserQuestion')
    const button = renderMessage(makeMessage(calls))
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('同规格 + 一枚 Agent(子代理树)⇒ 展开', () => {
    const calls = manyTools(['read_file', 'bash'])
    pushTool(calls, 't-agent', 'Agent')
    const button = renderMessage(makeMessage(calls))
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('类目级例外同样生效:ask_user(走 user_interaction 整类 neverFold)⇒ 展开', () => {
    const calls = manyTools(['read_file', 'bash'])
    pushTool(calls, 't-clarify', 'ask_user')
    const button = renderMessage(makeMessage(calls))
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('反向防假阳性:不含例外工具的重任务不因本接线而展开', () => {
    const calls = manyTools(['web_search', 'edit_file'])
    const button = renderMessage(makeMessage(calls))
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
