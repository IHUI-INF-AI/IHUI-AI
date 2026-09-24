// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D64③ 思考卡双态的**宿主接线**取证(2026-09-24 立)。
// 组件单测只能证明 ThinkingSection 自己会渲染 slot；本文件钉的是宿主那两条容易断的约定：
//   ① 无思考 + 有引用 ⇒ 卡出现、标题走 refs 态、引用条**在卡内**；
//   ② 同一份引用**全树只出现一次**(卡内一份 ⇒ 卡外那份必须让位) —— 否则 MessageItem
//      会在卡内卡外各列一份，而 typecheck 与组件单测都看不出来。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CitationEntry } from '@ihui/types'
import { useChatStore, type ChatMessage } from '@/stores/chat'

// 取词全部回显键名即可：本文件判的是**结构与出现次数**，不是译文
// (ai.pane.* 的逐语言可解析性由 check-word-table-resolvable 与本目录既有用例各自负责)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

import { TooltipProvider } from '@/components/feedback'
import { MessageItem } from '../MessageItem'

const NOW = Date.UTC(2026, 8, 24, 10, 0, 0)
const CITATIONS: CitationEntry[] = [
  { source: 'codebase', label: 'message-list/MessageItem.tsx' },
  { source: 'knowledge_cards', label: '思考卡双态', url: 'https://example.test/a' },
]

function assistantMessage(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm-refs',
    role: 'assistant',
    content: '这是答案正文。',
    createdAt: NOW,
    ...over,
  }
}

function renderItem(message: ChatMessage): void {
  useChatStore.setState({ messages: [message] })
  render(
    <TooltipProvider>
      <MessageItem message={message} isLast isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('D64③ MessageItem 引用态接线', () => {
  it('无思考 + 有引用 → 卡以 refs 态出现，展开后引用条在卡内且全树仅一份', () => {
    renderItem(assistantMessage({ citations: CITATIONS }))

    const card = screen.getByTestId('thinking-section')
    expect(card.getAttribute('data-thinking-title-variant')).toBe('refs')
    // 折叠态不挂载子项(D58/H22 既有口径)，此时引用条只有卡外那一份
    expect(screen.getAllByTestId('citation-bar')).toHaveLength(1)
    expect(screen.queryByTestId('thinking-refs-wrapper')).toBeNull()

    // 展开后：卡内出现 slot；宿主让位 ⇒ 全树仍然只有一份 citation-bar
    fireEvent.click(screen.getByTestId('thinking-toggle'))
    const wrappers = screen.getAllByTestId('thinking-refs-wrapper')
    expect(wrappers).toHaveLength(1)
    expect(wrappers[0]?.querySelector('[data-testid="citation-bar"]')).not.toBeNull()
    expect(screen.getAllByTestId('citation-bar')).toHaveLength(1)
  })

  it('有思考 + 有引用 → 引用条回到卡外一份，卡内不得再出现第二份', () => {
    renderItem(assistantMessage({ reasoning: '先拆解需求。', citations: CITATIONS }))

    const card = screen.getByTestId('thinking-section')
    expect(card.getAttribute('data-thinking-title-variant')).toBe('thinking')
    expect(screen.queryByTestId('thinking-refs-wrapper')).toBeNull()
    expect(screen.getAllByTestId('citation-bar')).toHaveLength(1)
  })

  it('无思考 无引用 → 不渲染空壳卡(与改造前一致)', () => {
    renderItem(assistantMessage({}))
    expect(screen.queryByTestId('thinking-section')).toBeNull()
    expect(screen.queryByTestId('citation-bar')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
