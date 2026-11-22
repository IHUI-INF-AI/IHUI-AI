// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D115(G-229)审查卡**接线**取证(2026-10-24 立):
// review-findings-card.test.tsx 只证"组件按 props 分组",那一层发现不了
// "帧到了但没人落库 / 卡片没挂进消息流"这一型(此前正是 dead wiring)。
// 本用例喂**真 store + 真 MessageItem + 真 onReviewFinding 工厂**:
// ① 流里来两条 review-finding ⇒ 消息气泡里出现卡片,且按 P1→P2 分组(与到达顺序无关);
// ② 新建对话(clearMessages)⇒ 旧 findings 不残留;同一消息重新审查(index=1)⇒ 旧列表被新一轮覆盖。
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

import type { ReviewFindingEvent } from '@ihui/api-client'

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { createReviewFindingHandler } from '@/hooks/use-chat/stream-handlers'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0)
const ID = 'a-review'

function assistantMsg(): ChatMessage {
  return { id: ID, role: 'assistant', content: '审查完成', createdAt: NOW }
}

function finding(
  overrides: Partial<ReviewFindingEvent> & { findingId: string },
): ReviewFindingEvent {
  return {
    index: 1,
    total: 2,
    severity: 'P1',
    file: 'src/a.ts',
    line: 42,
    title: 'finding',
    detail: '',
    suggestion: '',
    ...overrides,
  }
}

function renderMessage() {
  render(
    <TooltipProvider>
      <MessageItem message={assistantMsg()} isLast isStreaming assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [], reviewFindingsByMessageId: {} })
})

describe('review-finding 帧 → MessageItem 审查卡(D115 接线)', () => {
  it('流里两条 finding ⇒ 卡片出现并按 P1→P2 分组(与到达顺序无关)', () => {
    useChatStore.setState({ messages: [assistantMsg()], reviewFindingsByMessageId: {} })
    renderMessage()
    // 负例:未收到帧时不得占位
    expect(screen.queryByTestId('review-findings-card')).toBeNull()

    const onFinding = createReviewFindingHandler(ID)
    act(() => {
      onFinding(
        finding({ findingId: 'rf-1', index: 1, severity: 'P2', file: 'src/p2.ts', line: 7 }),
      )
      onFinding(
        finding({ findingId: 'rf-2', index: 2, severity: 'P1', file: 'src/a.ts', line: 42 }),
      )
    })

    expect(screen.getByTestId(`message-review-findings-${ID}`)).toBeTruthy()
    const groups = Array.from(
      screen.getByTestId('review-findings-card').querySelectorAll('section[data-severity]'),
    )
    expect(groups.map((g) => g.getAttribute('data-severity'))).toEqual(['P1', 'P2'])
    expect(screen.queryByTestId('review-group-Nit')).toBeNull()
    expect(screen.getByTestId('review-finding-rf-1')).toBeTruthy()
    expect(screen.getByTestId('review-finding-rf-2')).toBeTruthy()
  })

  it('新建对话清空 store ⇒ 旧 findings 不再渲染(不残留)', () => {
    useChatStore.setState({ messages: [assistantMsg()], reviewFindingsByMessageId: {} })
    renderMessage()
    const onFinding = createReviewFindingHandler(ID)
    act(() => onFinding(finding({ findingId: 'rf-1' })))
    expect(screen.getByTestId('review-findings-card')).toBeTruthy()

    act(() => useChatStore.getState().clearMessages())
    expect(useChatStore.getState().reviewFindingsByMessageId).toEqual({})
    expect(screen.queryByTestId('review-findings-card')).toBeNull()
  })

  it('同一消息重新审查:index=1 首帧覆盖旧列表(两轮不混卡)', () => {
    useChatStore.setState({ messages: [assistantMsg()], reviewFindingsByMessageId: {} })
    renderMessage()
    const onFinding = createReviewFindingHandler(ID)
    act(() => {
      onFinding(finding({ findingId: 'rf-1', index: 1, severity: 'P1' }))
      onFinding(finding({ findingId: 'rf-2', index: 2, severity: 'P2' }))
    })
    expect(screen.getByTestId('review-finding-rf-1')).toBeTruthy()

    act(() =>
      onFinding(finding({ findingId: 'rf-9', index: 1, severity: 'Nit', file: 'src/new.ts' })),
    )
    expect(useChatStore.getState().reviewFindingsByMessageId[ID]?.map((f) => f.findingId)).toEqual([
      'rf-9',
    ])
    expect(screen.queryByTestId('review-finding-rf-1')).toBeNull()
    expect(screen.getByTestId('review-finding-rf-9')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
