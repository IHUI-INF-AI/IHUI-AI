// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D94 尾票「失败诊断交接单接到对话流失败位」的**装车证明**(2026-09-25 立)。
//
// 为什么必须渲染而不是读源码:`handoff-package-card.tsx` 自 2026-09-24 入库起就是
// `git grep HandoffPackageCard` 外部 importer **0** —— 组件、共享层判据、五语词包全在库,
// 唯一缺的是"有人把它挂到失败消息上"。读源码断言只能证明"写了 import",
// 证不了"错误消息真的把数据喂进去了"。本文件三条都从渲染结果上量:
//   ① 失败消息渲染出交接单,且它是错误卡**内部**的后代(不是页面别处的孤立卡片);
//   ② 卡片正文含该条消息的错误原文 ⇒ 证明 ctx 取的是 `m` 的字段,不是写死的样例数据;
//   ③ 反向对照:同一条消息去掉 `error` 后卡片必须不出现(否则就是无条件渲染的假接线)。
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// i18n mock 只回键名:本文件的断言全部挂在**共享层产出的中文正文**与 data-* 结构位上,
// 不依赖任何文案 ⇒ mock 换不掉判据。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 8, 25, 3, 4, 5)
const ERROR_TEXT = '上游模型返回 429，请稍后重试'

function erroredMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'h1',
    role: 'assistant',
    content: ERROR_TEXT,
    createdAt: NOW,
    error: true,
    ...over,
  }
}

function renderMessage(m: ChatMessage) {
  return render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('D94 交接单接线:失败位必须产出可对外提交的脱敏交接单', () => {
  it('错误消息 → 交接单在错误卡内部渲染,且四段结构位齐备', () => {
    const { container } = renderMessage(erroredMessage())
    const card = container.querySelector<HTMLElement>(
      '[data-testid="message-error-card-h1"]',
    ) as HTMLElement | null
    const handoff = container.querySelector<HTMLElement>('[data-testid="message-handoff-h1"]')

    expect(card).not.toBeNull()
    expect(handoff).not.toBeNull()
    // 后代关系:交接单必须挂在错误卡里,不能是页面别处的孤立卡片
    expect(card!.contains(handoff)).toBe(true)
    // 四段式结构位(diagnosis / fixSteps / evidence / productSurface)由共享层 HANDOFF_SECTIONS 产出
    for (const section of ['diagnosis', 'fixSteps', 'evidence', 'productSurface']) {
      expect(handoff!.querySelector(`[data-handoff-section="${section}"]`)).not.toBeNull()
    }
  })

  it('卡片正文含该条消息的错误原文 ⇒ ctx 取的是消息字段而非写死样例', () => {
    const { container } = renderMessage(erroredMessage())
    const evidence = container.querySelector<HTMLElement>('[data-handoff-section="evidence"]')
    expect(evidence).not.toBeNull()
    expect(evidence!.textContent ?? '').toContain(ERROR_TEXT)
  })

  it('反向对照:同一条消息不带 error 时交接单不得出现(否则是无条件渲染的假接线)', () => {
    const { container } = renderMessage(erroredMessage({ error: false }))
    expect(container.querySelector('[data-testid="message-handoff-h1"]')).toBeNull()
    expect(container.querySelector('[data-testid="message-error-card-h1"]')).toBeNull()
  })

  it('时间戳缺失(非有限数)时不臆造时间:occurredAt 走共享层"未提供"文案,卡片仍渲染', () => {
    const { container } = renderMessage(erroredMessage({ createdAt: Number.NaN }))
    const handoff = container.querySelector('[data-handoff-section="productSurface"]')
    expect(handoff).not.toBeNull()
    expect(container.querySelector('[data-testid="message-handoff-h1"]')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
