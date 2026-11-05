// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #10 回归锁(2026-11-05):流式「正文为空 + 已有工具调用」时工具卡必须进 DOM。
 *
 * 真因:MessageItem 的 showTyping 原判据只要「助手正文为空 ∧ isStreaming」就整条
 * 渲染 TypingIndicator,而活动组 StreamGroup 挂在同一个三元表达式的 **else 分支**
 * 里 —— 于是逐分片 tool-call-args-delta 写入 store 后,工具卡在整段流式期间
 * 都不在 DOM,直到正文 chunk 到达才一次性以 success 终态出现。
 * 修复:stepSectionsCount 上移并作为退出 typing 占位的判据(showTyping 须同时
 * 满足「零活动区段」),把活动组挂载与正文是否为空解耦。
 *
 * 成对留证(缺一把反证即假绿):
 *  ① 正向 = 正文空 + toolCalls ⇒ 执行过程组与组头按钮必须挂载;
 *  ② 反证 = 正文空 + 零活动区段 ⇒ 不得凭空挂载执行过程组(typing 占位保持原行为)。
 * 断言只看 DOM 形态,不复算判据(§0.6)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import MessageList from '../MessageList'
import { TooltipProvider } from '@/components/feedback'
import type { ChatMessage, ToolCall } from '@/stores/chat'

vi.mock('next-intl', async () => {
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = resolve(ns)?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

const RUNNING_TOOL_CALL: ToolCall = {
  id: 'c1',
  toolName: 'web_search',
  status: 'running',
  args: {},
  partialArgs: { query: 'a' },
  argsStreaming: true,
}

function assistantMessage(patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'a1',
    role: 'assistant',
    content: '',
    createdAt: 1_760_000_001_000,
    model: 'test-model',
    ...patch,
  }
}

function renderList(messages: ChatMessage[], isStreaming = true) {
  return render(
    <TooltipProvider>
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        emptyTitle="空"
        emptyHint="空"
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('流式占位与活动组挂载解耦(#10)', () => {
  it('正文为空但已有 toolCalls ⇒ 执行过程组与组头按钮挂载', () => {
    const { container } = renderList([
      assistantMessage({ toolCalls: [RUNNING_TOOL_CALL] }),
    ])

    expect(
      container.querySelector('[data-testid="message-steps-group-a1"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-stream-group-trigger]'),
    ).not.toBeNull()
  })

  it('正文为空且零活动区段 ⇒ 不挂载执行过程组(typing 占位保持)', () => {
    const { container } = renderList([assistantMessage()])

    expect(
      container.querySelector('[data-testid="message-steps-group-a1"]'),
    ).toBeNull()
  })
})
