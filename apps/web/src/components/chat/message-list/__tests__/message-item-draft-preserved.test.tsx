// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D60 发送可靠性 · 渲染位消费用例(2026-09-23 立):
// persistence/store 层四态与草稿保全早已落地(persistence-send-reliability.test.ts 钉住),
// 但组件层无人消费 failedDraft —— 失败轮上看不到"草稿已保留,可重发"。
// 本文件咬的就是这条接线:MessageItem 的 error 卡片必须在 store.failedDraft 非空时
// 明示草稿保留提示,且文案与 toast 同源(resolvePersistTexts 反查,不手抄字符串)。
// 喂真 zustand store(与 message-item-waiting-wiring 同纪律):mock 掉数据源会把
// "渲染位消费 store"降级成"入参用例",接线漏传就咬不住。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '../MessageItem'
import { resolvePersistTexts } from '@/hooks/use-chat/persistence'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0)
const ERR_ID = 'a-failed-turn'
const DRAFT = '帮我整理上周会议纪要'

function failedAssistant(): ChatMessage {
  return { id: ERR_ID, role: 'assistant', content: '请求失败', createdAt: NOW, error: true }
}

function normalAssistant(id: string): ChatMessage {
  return { id, role: 'assistant', content: '正常回答', createdAt: NOW }
}

function renderMessage(m: ChatMessage) {
  // 动作区按钮(radix Tooltip)要求 Provider,与真实 app layout 同构;不 mock 组件本体
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  useChatStore.getState().clearFailedDraft()
  useChatStore.setState({ messages: [] })
})

describe('D60 失败轮草稿保留提示(MessageItem 渲染位)', () => {
  it('失败轮 + store 有保全草稿 → 明示"草稿已保留",文案与 toast 同源', () => {
    useChatStore.getState().setFailedDraft(DRAFT, 'failed_retryable')
    renderMessage(failedAssistant())
    const hint = screen.getByTestId(`message-draft-preserved-${ERR_ID}`)
    // 同源反查:期望值取自 resolvePersistTexts(failed_retryable).title,不手抄字符串
    expect(hint.textContent).toBe(resolvePersistTexts('failed_retryable').title)
    // 明示"草稿已保留"语义(该态文案本身含 preserved 承诺,渲染位不得吞掉)
    expect(hint.textContent).not.toBe('')
  })

  it('无保全草稿(未发生失败保稿)→ 失败卡不得出现草稿提示(负例防假阳性)', () => {
    renderMessage(failedAssistant())
    expect(screen.queryByTestId(`message-draft-preserved-${ERR_ID}`)).toBeNull()
    // 失败卡本体仍在(渲染位只是"补一行",不得挪走既有卡片)
    expect(screen.getByTestId(`message-error-card-${ERR_ID}`)).toBeDefined()
  })

  it('草稿提示按 failedDraftStatus 逐态给词:archived 终态不得说"可重试"', () => {
    useChatStore.getState().setFailedDraft(DRAFT, 'archived')
    renderMessage(failedAssistant())
    const hint = screen.getByTestId(`message-draft-preserved-${ERR_ID}`)
    expect(hint.textContent).toBe(resolvePersistTexts('archived').title)
    // 逐态驱动证明:archived 与 failed_retryable 的 title 不同(硬编码必红其中一条)
    expect(hint.textContent).not.toBe(resolvePersistTexts('failed_retryable').title)
  })

  it('成功轮(无 error)即使有残留草稿也不显示提示(只挂失败轮)', () => {
    useChatStore.getState().setFailedDraft(DRAFT, 'failed_retryable')
    renderMessage(normalAssistant('a-ok'))
    expect(screen.queryByTestId('message-draft-preserved-a-ok')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
