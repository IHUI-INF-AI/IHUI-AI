// @vitest-environment jsdom
/**
 * MessageList 深度优化测试(2026-07-28 立,Phase 19.5 深度对标 Trae Work 对话列表)
 *
 * 覆盖 4 个新增优化:
 * 1. Copy 快捷按钮:消息 hover 时显示,点击复制内容到剪贴板(成功/失败 toast)
 * 2. 错误重试按钮:m.error 时气泡底部显示,点击派发 'ihui:retry-message' 事件
 * 3. Jump-to-latest 浮动按钮:用户向上滚动时显示,点击滚到底 + 重置
 * 4. 键盘导航:↑/↓ 切换 focused message,Home/End 跳首/末,Esc 清除,Enter 展开 reasoning
 * 5. 时间戳 footer:hover 时显示
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'

// ─── Mocks(vi.hoisted 必须在 vi.mock 之前)────────────────────────────
const { mockT, toastMock, IconSpan } = vi.hoisted(() => {
  const map: Record<string, string> = {
    'permission.mode.ask': '请求批准',
    'permission.mode.askDesc': '...',
    'permission.mode.auto': '替我审批',
    'permission.mode.autoDesc': '...',
    'permission.mode.full': '完全访问',
    'permission.mode.fullDesc': '...',
    me: '我',
    hideReasoning: '隐藏推理过程',
    showReasoning: '显示推理过程',
    loading: '加载任务中...',
    fallbackNotice: '已切换到备用模型 {backup}',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    retry: 'Retry',
    jumpToLatest: 'Jump to latest',
    latest: 'Latest',
  }
  const mockT = (key: string, params?: Record<string, unknown>) => {
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(`{${k}}`, String(val))
      }
    }
    return v
  }
  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  }
  const IconSpan = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return { mockT, toastMock, IconSpan }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('@ihui/api-client', () => ({}))

vi.mock('lucide-react', () => {
  const Icon = IconSpan
  return {
    __esModule: true,
    Sparkles: Icon,
    AlertCircle: Icon,
    Loader2: Icon,
    ChevronDown: Icon,
    ShieldCheck: Icon,
    ShieldAlert: Icon,
    Hand: Icon,
    MessageSquare: Icon,
    ListTree: Icon,
    Copy: Icon,
    Check: Icon,
    RefreshCw: Icon,
    ArrowDown: Icon,
  }
})

// chat store mock(子 agent 活动列表为默认空数组)
vi.mock('@/stores/chat', () => ({
  useChatStore: (
    selector: (s: {
      messages: unknown[]
      subAgentActivities: unknown[]
      conversationId: string | null
    }) => unknown,
  ) =>
    selector({
      messages: [],
      subAgentActivities: [],
      conversationId: null,
    }),
}))

// progress-jump-store mock
const progressJumpStoreState = {
  pendingJumpToMessage: null as { messageId: string; nonce: number } | null,
  hoveredPlanStepId: null as string | null,
  hoveredMessageId: null as string | null,
  highlightedMessageId: null as string | null,
  planStepToMessageId: {} as Record<string, string>,
  messageToPlanStepIds: {} as Record<string, string[]>,
  requestJumpToMessage: vi.fn(),
  clearPendingJump: vi.fn(),
  setHoveredPlanStep: vi.fn(),
  setHoveredMessage: vi.fn(),
  flashHighlight: vi.fn(),
  linkPlanStepToMessage: vi.fn(),
  clearAllLinks: vi.fn(),
}
vi.mock('@/stores/progress-jump-store', () => ({
  useProgressJumpStore: (selector?: (s: typeof progressJumpStoreState) => unknown) =>
    selector ? selector(progressJumpStoreState) : progressJumpStoreState,
}))

// timeline-store mock
const timelineStoreState = {
  activeTab: 'inline' as 'inline' | 'timeline',
  events: [] as unknown[],
  setActiveTab: vi.fn(),
  setEvents: vi.fn(),
  toggleExpanded: vi.fn(),
  expandedEventIds: [] as string[],
  addEvent: vi.fn(),
  reset: vi.fn(),
}
vi.mock('@/stores/timeline-store', () => ({
  useTimelineStore: (selector?: (s: typeof timelineStoreState) => unknown) =>
    selector ? selector(timelineStoreState) : timelineStoreState,
}))

// toast mock
vi.mock('@/components/common', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/components/common')
  return {
    ...actual,
    toast: toastMock,
  }
})

// MarkdownStream mock
vi.mock('@/components/ai/markdown-stream', () => ({
  MarkdownStream: ({ content }: { content: string }) => (
    <div data-testid="markdown-stream">{content}</div>
  ),
}))

// ToolCallCard mock
vi.mock('@/components/ai/tool-call-card', () => ({
  ToolCallCard: () => <div data-testid="tool-call-card" />,
  deriveDiffInfo: () => null,
}))

// PromptTemplates mock
vi.mock('@/components/ai/prompt-templates', () => ({
  PromptTemplates: () => <div data-testid="prompt-templates" />,
}))

// CompressionDivider mock
vi.mock('@/components/ai/progress-sections/compression-divider', () => ({
  CompressionDivider: ({ label }: { label?: string }) => (
    <div data-testid="compression-divider">{label}</div>
  ),
}))

// SubAgentTaskTree mock
vi.mock('@/components/ai/progress-sections/sub-agent-task-tree', () => ({
  SubAgentTaskTree: () => <div data-testid="subagent-task-tree" />,
}))

// MessageContextMenu mock
vi.mock('@/components/ai/progress-sections/message-context-menu', () => ({
  MessageContextMenu: () => null,
  plainTextForClipboard: (s: string) => s,
  markdownForClipboard: (s: string) => s,
}))

// TimelineEventRow mock
vi.mock('@/components/ai/progress-sections/timeline-event', () => ({
  TimelineEventRow: () => <div data-testid="timeline-event-row" />,
}))

// next/image mock
vi.mock('next/image', () => ({
  default: ({ alt, ...rest }: { alt: string }) => <img alt={alt} {...rest} />,
}))

import { MessageList } from '../src/components/chat/message-list'
import type { ChatMessage } from '../src/stores/chat'

function makeUserMsg(
  id: string,
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    createdAt: Date.now() - 60_000,
    model: 'test-model',
    ...overrides,
  } as ChatMessage
}

function makeAssistantMsg(
  id: string,
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    createdAt: Date.now() - 30_000,
    model: 'test-model',
    ...overrides,
  } as ChatMessage
}

const baseProps = {
  messages: [] as ChatMessage[],
  isStreaming: false,
  emptyTitle: '开始新任务',
  emptyHint: '在下方输入',
  assistantLabel: 'AI 助手',
}

describe('MessageList — v2 深度优化(对标 Trae Work)', () => {
  beforeEach(() => {
    // jsdom 不实现 scrollIntoView,组件内多处调用(el.scrollIntoView),mock 掉避免 throw
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn()
    }
    progressJumpStoreState.pendingJumpToMessage = null
    progressJumpStoreState.highlightedMessageId = null
    progressJumpStoreState.hoveredMessageId = null
    progressJumpStoreState.requestJumpToMessage.mockClear()
    progressJumpStoreState.clearPendingJump.mockClear()
    progressJumpStoreState.flashHighlight.mockClear()
    timelineStoreState.activeTab = 'inline'
    timelineStoreState.events = []
    timelineStoreState.setActiveTab.mockClear()
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    toastMock.info.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  // ─── 1. Copy 快捷按钮 ──────────────────────────────────────────
  describe('Copy 快捷按钮', () => {
    it('hover assistant 消息时显示 Copy 按钮', () => {
      const msg = makeAssistantMsg('m1', 'Hello AI')
      render(<MessageList {...baseProps} messages={[msg]} />)
      const item = document.querySelector('[data-message-id="m1"]')!
      fireEvent.mouseEnter(item)
      const btn = screen.getByTestId('message-copy-m1')
      expect(btn).toBeTruthy()
      expect(btn.getAttribute('aria-label')).toBe('Copy')
    })

    it('hover user 消息时也显示 Copy 按钮(用户消息可复制自己的提问)', () => {
      const msg = makeUserMsg('u1', '我的问题')
      render(<MessageList {...baseProps} messages={[msg]} />)
      const item = document.querySelector('[data-message-id="u1"]')!
      fireEvent.mouseEnter(item)
      const btn = screen.getByTestId('message-copy-u1')
      expect(btn).toBeTruthy()
    })

    it('点击 Copy 按钮 → 写入剪贴板 + 显示 Copied toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      // happy-dom 环境可能没 navigator.clipboard,手动注入
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      })
      const msg = makeAssistantMsg('m-copy', '复制测试内容')
      render(<MessageList {...baseProps} messages={[msg]} />)
      const item = document.querySelector('[data-message-id="m-copy"]')!
      fireEvent.mouseEnter(item)
      const btn = screen.getByTestId('message-copy-m-copy')
      await act(async () => {
        fireEvent.click(btn)
      })
      expect(writeText).toHaveBeenCalledWith('复制测试内容')
      expect(toastMock.success).toHaveBeenCalledWith('Copied')
    })

    it('剪贴板写入失败 → 弹出 Copy failed toast', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('permission denied'))
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      })
      const msg = makeAssistantMsg('m-fail', 'fail test')
      render(<MessageList {...baseProps} messages={[msg]} />)
      fireEvent.mouseEnter(document.querySelector('[data-message-id="m-fail"]')!)
      const btn = screen.getByTestId('message-copy-m-fail')
      await act(async () => {
        fireEvent.click(btn)
      })
      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith('Copy failed', expect.anything())
      })
    })

    it('空内容消息不显示 Copy 按钮', () => {
      const msg = makeAssistantMsg('m-empty', '')
      render(<MessageList {...baseProps} messages={[msg]} />)
      fireEvent.mouseEnter(document.querySelector('[data-message-id="m-empty"]')!)
      expect(screen.queryByTestId('message-copy-m-empty')).toBeNull()
    })

    it('未 hover 时 Copy 按钮不渲染', () => {
      const msg = makeAssistantMsg('m1', 'no hover')
      render(<MessageList {...baseProps} messages={[msg]} />)
      expect(screen.queryByTestId('message-copy-m1')).toBeNull()
    })
  })

  // ─── 2. 错误重试按钮 ──────────────────────────────────────────
  describe('错误重试按钮', () => {
    it('m.error 消息在气泡下方显示 Retry 按钮', () => {
      const msg = makeAssistantMsg('m-err', '失败内容', { error: true })
      render(<MessageList {...baseProps} messages={[msg]} />)
      const btn = screen.getByTestId('message-retry-m-err')
      expect(btn).toBeTruthy()
      expect(btn.textContent).toContain('Retry')
    })

    it('点击 Retry 按钮 → 派发 ihui:retry-message 事件 + info toast', () => {
      const msg = makeAssistantMsg('m-err', '失败', { error: true })
      const handler = vi.fn()
      window.addEventListener('ihui:retry-message', handler)
      render(<MessageList {...baseProps} messages={[msg]} />)
      const btn = screen.getByTestId('message-retry-m-err')
      fireEvent.click(btn)
      expect(handler).toHaveBeenCalledTimes(1)
      const detail = (handler.mock.calls[0]![0] as CustomEvent<{ messageId: string }>).detail
      expect(detail.messageId).toBe('m-err')
      expect(toastMock.info).toHaveBeenCalledWith('Retry')
      window.removeEventListener('ihui:retry-message', handler)
    })

    it('非 error 消息不显示 Retry 按钮', () => {
      const msg = makeAssistantMsg('m-ok', '正常')
      render(<MessageList {...baseProps} messages={[msg]} />)
      expect(screen.queryByTestId('message-retry-m-ok')).toBeNull()
    })
  })

  // ─── 3. Jump-to-latest 浮动按钮 ────────────────────────────────
  describe('Jump-to-latest 浮动按钮', () => {
    it('默认不显示(用户未向上滚动)', () => {
      const msg = makeAssistantMsg('m1', 'hi')
      render(<MessageList {...baseProps} messages={[msg]} />)
      expect(screen.queryByTestId('message-list-jump-latest')).toBeNull()
    })

    it('用户向上滚动超过 120px 后显示按钮', async () => {
      const msg = makeAssistantMsg('m1', 'hi')
      const { container } = render(<MessageList {...baseProps} messages={[msg]} />)
      const panel = container.querySelector(
        '[data-testid="message-list-inline-panel"]',
      ) as HTMLElement
      // 模拟大量内容导致可滚动
      Object.defineProperty(panel, 'scrollHeight', { value: 1000, configurable: true })
      Object.defineProperty(panel, 'clientHeight', { value: 200, configurable: true })
      Object.defineProperty(panel, 'scrollTop', { value: 0, configurable: true })
      // 触发滚动:距离底部 1000 - 0 - 200 = 800px > 120 → 向上滚动
      await act(async () => {
        fireEvent.scroll(panel)
      })
      // rAF 后 state 更新
      await waitFor(() => {
        expect(screen.getByTestId('message-list-jump-latest')).toBeTruthy()
      })
    })

    it('点击 jump-to-latest → 派发 ihui:jump-to-latest 事件 + 按钮消失', async () => {
      const msg = makeAssistantMsg('m1', 'hi')
      const { container } = render(<MessageList {...baseProps} messages={[msg]} />)
      const panel = container.querySelector(
        '[data-testid="message-list-inline-panel"]',
      ) as HTMLElement
      Object.defineProperty(panel, 'scrollHeight', { value: 1000, configurable: true })
      Object.defineProperty(panel, 'clientHeight', { value: 200, configurable: true })
      Object.defineProperty(panel, 'scrollTop', { value: 0, configurable: true })
      const handler = vi.fn()
      window.addEventListener('ihui:jump-to-latest', handler)
      await act(async () => {
        fireEvent.scroll(panel)
      })
      const btn = await waitFor(() => screen.getByTestId('message-list-jump-latest'))
      // mock scrollIntoView 避免 jsdom 报错
      Element.prototype.scrollIntoView = vi.fn()
      await act(async () => {
        fireEvent.click(btn)
      })
      expect(handler).toHaveBeenCalled()
      window.removeEventListener('ihui:jump-to-latest', handler)
    })

    it('isStreaming 时 jump-to-latest 按钮显示脉冲红点', async () => {
      const msg = makeAssistantMsg('m1', 'hi')
      const { container } = render(<MessageList {...baseProps} messages={[msg]} isStreaming />)
      const panel = container.querySelector(
        '[data-testid="message-list-inline-panel"]',
      ) as HTMLElement
      Object.defineProperty(panel, 'scrollHeight', { value: 1000, configurable: true })
      Object.defineProperty(panel, 'clientHeight', { value: 200, configurable: true })
      Object.defineProperty(panel, 'scrollTop', { value: 0, configurable: true })
      await act(async () => {
        fireEvent.scroll(panel)
      })
      await waitFor(() => {
        expect(screen.getByTestId('message-list-jump-latest-dot')).toBeTruthy()
      })
    })
  })

  // ─── 4. 键盘导航 ──────────────────────────────────────────────
  describe('键盘导航 ↑/↓', () => {
    it('ArrowDown:无聚焦时聚焦到首条消息', () => {
      const msgs = [makeUserMsg('u1', 'hi'), makeAssistantMsg('a1', 'hello')]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      })
      // u1 消息应有 data-message-focused=true
      const u1 = document.querySelector('[data-message-id="u1"]')!
      expect(u1.getAttribute('data-message-focused')).toBe('true')
    })

    it('ArrowDown 二次:从 u1 切到 a1', () => {
      const msgs = [makeUserMsg('u1', 'hi'), makeAssistantMsg('a1', 'hello')]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      })
      const a1 = document.querySelector('[data-message-id="a1"]')!
      expect(a1.getAttribute('data-message-focused')).toBe('true')
      const u1 = document.querySelector('[data-message-id="u1"]')!
      expect(u1.getAttribute('data-message-focused')).toBe('false')
    })

    it('ArrowUp:从末条往上切到前一条', () => {
      const msgs = [makeUserMsg('u1', 'hi'), makeAssistantMsg('a1', 'hello')]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        // 先 ArrowDown 两次聚焦到 a1(末条)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        // 再 ArrowUp 回到 u1
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
      })
      const u1 = document.querySelector('[data-message-id="u1"]')!
      expect(u1.getAttribute('data-message-focused')).toBe('true')
    })

    it('Home/End:跳到首/末条', () => {
      const msgs = [
        makeUserMsg('u1', 'a'),
        makeAssistantMsg('a1', 'b'),
        makeAssistantMsg('a2', 'c'),
      ]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      })
      expect(
        document.querySelector('[data-message-id="a2"]')!.getAttribute('data-message-focused'),
      ).toBe('true')
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
      })
      expect(
        document.querySelector('[data-message-id="u1"]')!.getAttribute('data-message-focused'),
      ).toBe('true')
    })

    it('Escape:清除聚焦', () => {
      const msgs = [makeUserMsg('u1', 'a')]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(
        document.querySelector('[data-message-id="u1"]')!.getAttribute('data-message-focused'),
      ).toBe('false')
    })

    it('焦点在 INPUT 时不拦截快捷键(避免与输入冲突)', () => {
      const msgs = [makeUserMsg('u1', 'a')]
      render(
        <div>
          <input data-testid="kb-input" type="text" />
          <MessageList {...baseProps} messages={msgs} />
        </div>,
      )
      const input = screen.getByTestId('kb-input')
      input.focus()
      act(() => {
        const evt = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        Object.defineProperty(evt, 'target', { value: input })
        window.dispatchEvent(evt)
      })
      // u1 不应被聚焦
      expect(
        document.querySelector('[data-message-id="u1"]')!.getAttribute('data-message-focused'),
      ).toBe('false')
    })

    it('Enter on focused reasoning message:派发 ihui:toggle-reasoning 事件', () => {
      const msgs = [makeAssistantMsg('a1', 'answer', { reasoning: 'thinking...' })]
      render(<MessageList {...baseProps} messages={msgs} />)
      const handler = vi.fn()
      window.addEventListener('ihui:toggle-reasoning', handler)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(handler).toHaveBeenCalled()
      const detail = (handler.mock.calls[0]![0] as CustomEvent<{ messageId: string }>).detail
      expect(detail.messageId).toBe('a1')
      window.removeEventListener('ihui:toggle-reasoning', handler)
    })

    it('Enter on message without reasoning:不派发事件(无操作)', () => {
      const msgs = [makeAssistantMsg('a1', 'answer')]
      render(<MessageList {...baseProps} messages={msgs} />)
      const handler = vi.fn()
      window.addEventListener('ihui:toggle-reasoning', handler)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(handler).not.toHaveBeenCalled()
      window.removeEventListener('ihui:toggle-reasoning', handler)
    })

    it('Cmd+ArrowDown:不拦截,保留浏览器原生行为', () => {
      const msgs = [makeUserMsg('u1', 'a')]
      render(<MessageList {...baseProps} messages={msgs} />)
      act(() => {
        const evt = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          metaKey: true,
        })
        window.dispatchEvent(evt)
      })
      expect(
        document.querySelector('[data-message-id="u1"]')!.getAttribute('data-message-focused'),
      ).toBe('false')
    })
  })

  // ─── 5. 时间戳 footer ─────────────────────────────────────────
  describe('时间戳 footer', () => {
    it('hover 消息时显示时间戳', () => {
      const ts = new Date('2026-07-28T10:30:00').getTime()
      const msg = makeAssistantMsg('m-ts', 'content', { createdAt: ts })
      render(<MessageList {...baseProps} messages={[msg]} />)
      const item = document.querySelector('[data-message-id="m-ts"]')!
      // 默认无 hover:时间戳不显示
      expect(screen.queryByTestId('message-timestamp-m-ts')).toBeNull()
      // hover 后显示
      fireEvent.mouseEnter(item)
      const tsEl = screen.getByTestId('message-timestamp-m-ts')
      expect(tsEl).toBeTruthy()
      expect(tsEl.textContent).toBe('10:30')
    })

    it('非当天消息显示 MM-DD HH:MM 格式', () => {
      const oldDate = new Date('2026-01-15T14:25:00').getTime()
      const msg = makeAssistantMsg('m-old', 'old', { createdAt: oldDate })
      render(<MessageList {...baseProps} messages={[msg]} />)
      fireEvent.mouseEnter(document.querySelector('[data-message-id="m-old"]')!)
      const tsEl = screen.getByTestId('message-timestamp-m-old')
      expect(tsEl.textContent).toBe('01-15 14:25')
    })
  })

  // ─── 6. 集成测试:基本渲染 + 空状态 ────────────────────────────
  describe('基础渲染', () => {
    it('空状态:显示空标题 + 提示', () => {
      render(<MessageList {...baseProps} messages={[]} />)
      expect(screen.getByText('开始新任务')).toBeTruthy()
      expect(screen.getByText('在下方输入')).toBeTruthy()
    })

    it('有消息:渲染所有消息 + 保持现有 props 接口不变', () => {
      const msgs = [makeUserMsg('u1', '问题'), makeAssistantMsg('a1', '回答')]
      render(<MessageList {...baseProps} messages={msgs} />)
      expect(document.querySelectorAll('[data-message-id]').length).toBe(2)
    })
  })
})
