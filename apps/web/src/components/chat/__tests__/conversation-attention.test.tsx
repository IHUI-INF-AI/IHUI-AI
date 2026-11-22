// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, number>) => {
    switch (key) {
      case 'attentionWaiting':
        return '等待你处理'
      case 'attentionUnread':
        return `有 ${params?.count ?? 0} 条未读更新`
      case 'batchAttentionSummary':
        return `其中等待处理 ${params?.waiting ?? 0} · 未读 ${params?.unread ?? 0}`
      case 'selectedCount':
        return `已选 ${params?.count ?? 0} 项`
      case 'messageCount':
        return `共 ${params?.count ?? 0} 条消息`
      default:
        return key
    }
  },
  useLocale: () => 'zh-CN',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import {
  BatchAttentionSummaryLine,
  ConversationAttentionBadges,
  ConversationList,
} from '../conversation-list'
import { useChatStore } from '@/stores/chat'

/**
 * D53 会话注意力徽章(G-64)渲染守门测试。
 *
 * 覆盖:四态各一用例(idle/waiting/unread/waiting-unread)+ 多选条文案断言 +
 * pendingQuestion 挂起→等待你处理联动(整表渲染,当前会话行自动等待,其他行不受影响)。
 * 文案键(chatHistory.attentionWaiting/attentionUnread/batchAttentionSummary)由主 agent
 * 统一入词表,此处 mock 与提议文案保持一致(见交付物词表键清单)。
 */
describe('ConversationAttentionBadges 四态', () => {
  afterEach(() => cleanup())

  it('idle:零占位,不渲染任何徽章', () => {
    const { container } = render(<ConversationAttentionBadges state="idle" unreadCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('waiting:渲染「等待你处理」', () => {
    render(<ConversationAttentionBadges state="waiting" unreadCount={0} />)
    expect(screen.getByTestId('attention-badge-waiting')).toBeTruthy()
    expect(screen.getByText('等待你处理')).toBeTruthy()
    expect(screen.queryByTestId('attention-badge-unread')).toBeNull()
  })

  // unread 徽章现走项目 Tooltip(§4 禁原生提示窗)→ 与文件内既有写法一致,需 provider 包裹
  it('unread:渲染未读数徽章(确定性居中模板类)', () => {
    render(
      <TooltipProvider>
        <ConversationAttentionBadges state="unread" unreadCount={7} />
      </TooltipProvider>,
    )
    const badge = screen.getByTestId('attention-badge-unread')
    expect(badge.textContent).toContain('7')
    // AGENTS.md 数字徽章强制模板:inline-flex + 定高 + 最小宽 + 双向居中 + leading-none + 等宽数字
    for (const cls of [
      'inline-flex',
      'h-4',
      'min-w-4',
      'items-center',
      'justify-center',
      'leading-none',
      'tabular-nums',
    ]) {
      expect(badge.classList.contains(cls)).toBe(true)
    }
    expect(badge.getAttribute('aria-label')).toBe('有 7 条未读更新')
    expect(screen.queryByTestId('attention-badge-waiting')).toBeNull()
  })

  it('waiting-unread:两徽章并排', () => {
    render(
      <TooltipProvider>
        <ConversationAttentionBadges state="waiting-unread" unreadCount={2} />
      </TooltipProvider>,
    )
    expect(screen.getByTestId('attention-badge-waiting')).toBeTruthy()
    const badge = screen.getByTestId('attention-badge-unread')
    expect(badge.textContent).toContain('2')
  })

  it('未读超 99 封顶 99+', () => {
    render(
      <TooltipProvider>
        <ConversationAttentionBadges state="unread" unreadCount={150} />
      </TooltipProvider>,
    )
    expect(screen.getByTestId('attention-badge-unread').textContent).toContain('99+')
  })

  it('未读徽章由项目 Tooltip 承载提示,不再挂原生 title(§4)', () => {
    render(
      <TooltipProvider>
        <ConversationAttentionBadges state="unread" unreadCount={7} />
      </TooltipProvider>,
    )
    const badge = screen.getByTestId('attention-badge-unread')
    expect(badge.getAttribute('title')).toBeNull()
    // Radix Trigger 用 asChild 合到本 span:aria-describedby 在关闭态也已挂,
    // 足以证明 hover 提示已由项目 Tooltip 接管(无需模拟 hover → 不受 300ms 时延抖动影响)。
    expect(badge.getAttribute('aria-describedby')).toBeTruthy()
    expect(badge.getAttribute('aria-label')).toBe('有 7 条未读更新')
  })
})

describe('BatchAttentionSummaryLine 多选条文案', () => {
  afterEach(() => cleanup())

  it('两项皆 0 时零占位', () => {
    const { container } = render(<BatchAttentionSummaryLine waitingCount={0} unreadCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('非零时渲染汇总文案(批量条文案断言)', () => {
    render(<BatchAttentionSummaryLine waitingCount={1} unreadCount={2} />)
    const line = screen.getByTestId('batch-attention-summary')
    expect(line.textContent).toBe('其中等待处理 1 · 未读 2')
  })
})

describe('ConversationList pendingQuestion 联动', () => {
  afterEach(() => {
    cleanup()
    useChatStore.setState({ conversationId: null, pendingQuestion: null })
  })

  const items = [
    {
      id: 'c1',
      title: '当前会话',
      model: 'auto',
      lastMessageAt: new Date().toISOString(),
      messageCount: 3,
      favorite: false,
    },
    {
      id: 'c2',
      title: '其他会话',
      model: 'auto',
      lastMessageAt: new Date().toISOString(),
      messageCount: 1,
      favorite: false,
    },
  ]

  function renderList() {
    const client = new QueryClient()
    return render(
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <ConversationList items={items} />
        </QueryClientProvider>
      </TooltipProvider>,
    )
  }

  it('无挂起时两行都无等待徽章', () => {
    useChatStore.setState({ conversationId: 'c1', pendingQuestion: null })
    renderList()
    expect(screen.queryByTestId('attention-badge-waiting')).toBeNull()
  })

  it('pendingQuestion 挂起 → 仅当前会话行进入等待态', () => {
    useChatStore.setState({
      conversationId: 'c1',
      pendingQuestion: {
        questionId: 'q1',
        prompt: '继续吗?',
        options: [],
        allowCustom: true,
        allowMultiple: false,
      },
    })
    renderList()
    const waiting = screen.getAllByTestId('attention-badge-waiting')
    expect(waiting).toHaveLength(1)
    expect(waiting[0]?.textContent).toContain('等待你处理')
  })

  it('attentionById 显式等待:非当前会话行也能等待', () => {
    useChatStore.setState({ conversationId: 'c1', pendingQuestion: null })
    const client = new QueryClient()
    render(
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <ConversationList items={items} attentionById={{ c2: { unread: 4 } }} />
        </QueryClientProvider>
      </TooltipProvider>,
    )
    expect(screen.queryByTestId('attention-badge-waiting')).toBeNull()
    const unread = screen.getByTestId('attention-badge-unread')
    expect(unread.textContent).toContain('4')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
