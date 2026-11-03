// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-1104168 中断痕迹 · 展示面用例(2026-10-10 立):
// 数据侧已保证零字符取消不落泡(conversation.py 仅 arrived_text 非空的取消路径落
// metadata.interrupted),这里咬两头:
// ① 水合层:metadata.interrupted/interrupt_reason → message.interrupted/interruptReason
//    的换算与守卫(非 true 不采信,reason 非字符串缺席);
// ② 渲染位:消息挂 interrupted → 「已中断」标注行必须出现,reason=user_cancelled 走
//    专属话术(两键必不同,硬编码必红);普通消息与空内容+中断(只显示标注)各有对应用例。
// 与 message-item-fallback-line.test.tsx 同纪律:喂真 store + 真 MessageItem,不 mock 组件本体。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// next-intl mock 保留取词记录:话术切换用例要断"取的是哪个键"
const takeWordCalls: Array<{ key: string; values?: Record<string, string> }> = []
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string>): string => {
      takeWordCalls.push({ key, values })
      return `[${key}]`
    },
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { hydrateHistoryMessage } from '@/hooks/use-chat/history-message'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0)

function renderMessage(m: ChatMessage) {
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  takeWordCalls.length = 0
  useChatStore.setState({ messages: [] })
})

describe('历史水合 · metadata.interrupted 读回(G-1104168)', () => {
  it('interrupted:true + interrupt_reason → 两字段都挂上', () => {
    const m = hydrateHistoryMessage({
      id: 'h1',
      role: 'assistant',
      content: '被中断前的半截回答',
      createdAt: new Date(NOW).toISOString(),
      metadata: { interrupted: true, interrupt_reason: 'user_cancelled' },
    })
    expect(m.interrupted).toBe(true)
    expect(m.interruptReason).toBe('user_cancelled')
  })

  it('interrupted:true 无 reason → interrupted 挂上,reason 缺席', () => {
    const m = hydrateHistoryMessage({
      id: 'h2',
      role: 'assistant',
      content: '半截回答',
      createdAt: new Date(NOW).toISOString(),
      metadata: { interrupted: true },
    })
    expect(m.interrupted).toBe(true)
    expect(m.interruptReason).toBeUndefined()
  })

  it('interrupted 非 true / metadata 缺席 → 两字段一律缺席(负例防假阳性)', () => {
    for (const metadata of [undefined, null, {}, { interrupted: false }, { interrupted: 'yes' }]) {
      const m = hydrateHistoryMessage({
        id: 'h3',
        role: 'assistant',
        content: '正常回答',
        createdAt: new Date(NOW).toISOString(),
        metadata: metadata as Record<string, unknown> | null,
      })
      expect(m.interrupted).toBeUndefined()
      expect(m.interruptReason).toBeUndefined()
    }
  })

  it('interrupt_reason 非字符串 → reason 缺席,interrupted 不受牵连', () => {
    const m = hydrateHistoryMessage({
      id: 'h4',
      role: 'assistant',
      content: '半截回答',
      createdAt: new Date(NOW).toISOString(),
      metadata: { interrupted: true, interrupt_reason: 123 },
    })
    expect(m.interrupted).toBe(true)
    expect(m.interruptReason).toBeUndefined()
  })
})

describe('MessageItem 中断标注行(G-1104168 渲染位)', () => {
  it('interrupted + reason=user_cancelled → 标注行出现,走专属话术键', () => {
    renderMessage({
      id: 'i1',
      role: 'assistant',
      content: '被中断前的半截回答',
      createdAt: NOW,
      interrupted: true,
      interruptReason: 'user_cancelled',
    })
    expect(screen.getByTestId(`message-interrupted-i1`).textContent).toBe(
      '[interruptedNoticeUserCancelled]',
    )
  })

  it('interrupted 无 reason → 走通用话术键(两键必不同,硬编码必红)', () => {
    renderMessage({
      id: 'i2',
      role: 'assistant',
      content: '被中断前的半截回答',
      createdAt: NOW,
      interrupted: true,
    })
    expect(screen.getByTestId(`message-interrupted-i2`).textContent).toBe('[interruptedNotice]')
  })

  it('普通消息 → 标注行缺席(负例防假阳性)', () => {
    renderMessage({ id: 'i3', role: 'assistant', content: '普通回答', createdAt: NOW })
    expect(screen.queryByTestId('message-interrupted-i3')).toBeNull()
  })

  it('interrupted 且内容为空 → 只显示标注行,不渲染空泡正文(零字符对照不回归)', () => {
    renderMessage({
      id: 'i4',
      role: 'assistant',
      content: '',
      createdAt: NOW,
      interrupted: true,
    })
    const line = screen.getByTestId('message-interrupted-i4')
    expect(line.textContent).toBe('[interruptedNotice]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
