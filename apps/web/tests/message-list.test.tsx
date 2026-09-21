// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * MessageList 深度优化测试(2026-07-28 立,Phase 19.5 深度对标 AI 工作台 对话列表)
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
    // D22(2026-09-19 立):error 独立消息类型 + 圈选引用按钮 i18n 键
    errorCardTitle: 'Request failed',
    quoteSelection: 'Quote selection',
    quoteSelectionAdded: 'Added to references',
    jumpToLatest: 'Jump to latest',
    latest: 'Latest',
    // ai.toolCall 命名空间:2026-09-01 TypingIndicator i18n 化后用 useTranslations('ai.toolCall'),
    // mockT 若缺 key 会回落返回原始 key 文本 → 思考预览断言(/正在思考/)失效。
    // 此处为 zh-CN 真实译文(与 packages/i18n/messages/web/zh-CN.json 一致)。
    callingTool: '正在调用工具 {name}',
    thinking: '正在思考: {preview}',
    waitingResponse: '正在等待模型响应…',
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
  // MessageItem → useTts() 会调用 useLocale();mock 必须覆盖到该导出,否则整棵子树抛
  // "No \"useLocale\" export is defined on the next-intl mock"(与 ide/timeline 等测试同约定)
  useLocale: () => 'zh-CN',
}))

vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Trigger: ({ children }: { children: React.ReactElement }) => <>{children}</>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Arrow: () => null,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    setTokenProvider: vi.fn(),
    setBaseUrl: vi.fn(),
    setStreamBaseUrl: vi.fn(),
  }
})

vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const Icon = IconSpan
  // 2026-08-28 修复:spread actual 兜底依赖链引入的清单外新图标(MessageCircle/Building2...)
  return {
    __esModule: true,
    ...actual,
    Sparkles: Icon,
    AlertCircle: Icon,
    AlertTriangle: Icon,
    Loader2: Icon,
    ChevronDown: Icon,
    ShieldCheck: Icon,
    ShieldAlert: Icon,
    Hand: Icon,
    Info: Icon,
    MessageSquare: Icon,
    ListTree: Icon,
    Copy: Icon,
    Check: Icon,
    RefreshCw: Icon,
    ArrowDown: Icon,
    Search: Icon,
    Layers: Icon,
    Clock: Icon,
    ListTodo: Icon,
    ChevronRight: Icon,
    Star: Icon,
    Share2: Icon,
    Pencil: Icon,
    Trash2: Icon,
    MessageCircle: Icon,
    BarChart3: Icon,
    Eye: Icon,
    EyeOff: Icon,
    Download: Icon,
    Code: Icon,
    Megaphone: Icon,
    CheckCircle: Icon,
    CheckCircle2: Icon,
    Terminal: Icon,
    X: Icon,
    XCircle: Icon,
    Brain: Icon,
    FileSearch: Icon,
    Globe: Icon,
    FilePen: Icon,
    Plus: Icon,
    Minus: Icon,
    Wrench: Icon,
  }
})

// chat store mock(子 agent 活动列表为默认空数组)
// 用 zustand-like 模式:内部维护可变 state + setUserScrolledUp 触发订阅者重渲染
// 用 vi.hoisted 让变量和 mock factory 都被提升,绕开"factory 内不能引用顶层变量"的限制
const mockChatStore = vi.hoisted(() => {
  return {
    state: {
      messages: [] as unknown[],
      subAgentActivities: [] as unknown[],
      conversationId: null as string | null,
      userScrolledUp: false,
      // 2026-09-18 补齐:真实 store 新增 memoryUpdateNotices(记忆更新提示,按 messageId
      // 聚合),MessageItem 以叶子选择器订阅 `s.memoryUpdateNotices.find(...)`;
      // 假 store 缺该字段会直接 TypeError,导致本文件 34 项全红。
      memoryUpdateNotices: [] as { messageId: string; items: string[] }[],
      // 2026-09-19 补齐:Steer(中途引导)新增 steerNoticesByMessageId(按 messageId
      // 聚合),MessageItem 以叶子选择器订阅 `s.steerNoticesByMessageId[m.id] ?? null`;
      // 假 store 缺该字段会直接 TypeError(同上款炸法)。
      steerNoticesByMessageId: {} as Record<string, unknown[]>,
      // 2026-09-19 补齐:D1 usage 计量帧新增 usageByMessageId(usage 对象按 messageId
      // 聚合),message-item-parts.tsx 以叶子选择器订阅 `s.usageByMessageId[messageId]`;
      // 假 store 缺该字段会直接 TypeError(同上款炸法)。
      usageByMessageId: {} as Record<string, unknown>,
    },
    listeners: new Set<() => void>(),
  }
})
vi.mock('@/stores/chat', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react')
  const { state, listeners } = mockChatStore
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  const notify = () => {
    for (const l of listeners) l()
  }
  const setUserScrolledUp = (up: boolean) => {
    state.userScrolledUp = up
    notify()
  }
  const setState = (partial: Record<string, unknown>) => {
    Object.assign(state, partial)
    notify()
  }
  const useChatStore: unknown = Object.assign(
    (selector: (s: typeof state) => unknown) => {
      const getSnapshot = () => selector(state)
      return ReactMod.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    },
    {
      getState: () => state,
      setState,
      subscribe,
    },
  )
  state.setUserScrolledUp = setUserScrolledUp
  return { useChatStore }
})

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
  activeTab: 'inline' as 'inline' | 'timeline' | 'all',
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

// MarkdownViewer mock(PlanStepsCard reasoning 渲染依赖)
vi.mock('@/components/media/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}))

// tauri-bridge mock(避免 @tauri-apps/plugin-updater 缺失依赖导致测试失败)
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => false,
  checkForUpdates: () => Promise.resolve(null),
  installUpdate: () => Promise.resolve(),
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

// SubAgentTaskTree mock
vi.mock('@/components/ai/progress-sections/sub-agent-task-tree', () => ({
  SubAgentTaskTree: () => <div data-testid="subagent-task-tree" />,
}))

// MessageContextMenu mock
vi.mock('@/components/ai/progress-sections/message-context-menu', () => ({
  MessageContextMenu: () => null,
  MessageSearchBar: () => null,
  plainTextForClipboard: (s: string) => s,
  markdownForClipboard: (s: string) => s,
  normalizeMarkdown: (s: string) => s,
}))

// TimelineEventRow mock
vi.mock('@/components/ai/progress-sections/timeline-event', () => ({
  TimelineEventRow: () => <div data-testid="timeline-event-row" />,
}))

// next/image mock(jsdom 下渲染真实 <img>,避免 next/image 优化管线依赖)
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- next/image mock 必须渲染真实 <img>
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

describe('MessageList — v2 深度优化(对标 AI 工作台)', () => {
  beforeEach(() => {
    // jsdom 不实现 scrollIntoView,组件内多处调用(el.scrollIntoView),mock 掉避免 throw
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn()
    }
    // 重置 chat store mock 状态(避免前一个测试把 userScrolledUp 置为 true 后泄漏)
    mockChatStore.state.userScrolledUp = false
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

    // 2026-08-05 更新:2026-07-28 深化后 Copy 按钮常显(ACTION_BTN_CLASS 无 hover 隐藏)
    it('Copy 按钮常显(2026-07-28 深化后 hover 操作区常显)', () => {
      const msg = makeAssistantMsg('m1', 'no hover')
      render(<MessageList {...baseProps} messages={[msg]} />)
      expect(screen.queryByTestId('message-copy-m1')).not.toBeNull()
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
    it('时间戳常驻显示(无需 hover)', () => {
      // 2026-07-31 立:深度对标 Codex/AI 工作台,时间戳常驻显示在气泡底部,
      // 让对话流自带时间感知。用户需求"对话流里显示时间"。
      // 用"今天 10:30"避免 sameDay 判定受当前日期影响
      const today = new Date()
      today.setHours(10, 30, 0, 0)
      const ts = today.getTime()
      const msg = makeAssistantMsg('m-ts', 'content', { createdAt: ts })
      render(<MessageList {...baseProps} messages={[msg]} />)
      // 默认无 hover 即显示时间戳(常驻)
      const tsEl = screen.getByTestId('message-timestamp-m-ts')
      expect(tsEl).toBeTruthy()
      expect(tsEl.textContent).toBe('10:30')
    })

    it('非当天消息显示 MM-DD HH:MM 格式', () => {
      const oldDate = new Date('2026-01-15T14:25:00').getTime()
      const msg = makeAssistantMsg('m-old', 'old', { createdAt: oldDate })
      render(<MessageList {...baseProps} messages={[msg]} />)
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

  // ─── PlanStepsCard 渲染(2026-07-31 增强后改为显式 planSteps 驱动)────────
  // 2026-08-05 更新:重构后 PlanStepsCard 只在消息显式带 planSteps 时渲染,
  // testid 从静态 message-plan-steps-card 改为 message-plan-steps-<id>。
  describe('PlanStepsCard 渲染', () => {
    const planStep = (over: Partial<Record<string, unknown>> = {}) => ({
      id: 'ps1',
      step: '分析需求',
      status: 'in_progress' as const,
      ...over,
    })

    it('消息带 planSteps:渲染 PlanStepsCard(带消息 id 的 testid)', () => {
      const msgs = [
        makeAssistantMsg('a1', '这是回答', {
          planSteps: [planStep()],
        }),
      ]
      render(<MessageList {...baseProps} messages={msgs} />)
      // D21(2026-09-19 立):初始折叠态由折叠策略驱动 — 本例为轻查询(短正文+无工具+零耗时),
      // auto 口径下默认展开,卡片无需点击即可见;再点击触发器验证可收起
      const trigger = document.querySelector('[data-stream-group] button') as HTMLElement
      expect(trigger).toBeTruthy()
      expect(screen.queryByTestId('message-plan-steps-a1')).toBeTruthy()
      fireEvent.click(trigger)
      expect(screen.queryByTestId('message-plan-steps-a1')).toBeNull()
    })

    it('纯文本对话(无 planSteps):不渲染 PlanStepsCard', () => {
      const msgs = [makeAssistantMsg('a1', '这是回答')]
      render(<MessageList {...baseProps} messages={msgs} />)
      expect(screen.queryByTestId('message-plan-steps-a1')).toBeNull()
    })

    it('reasoning/content/toolCalls 不自动渲染卡片(派生仅用于跳转映射)', () => {
      const msgs = [
        makeAssistantMsg('a1', '最终答案', {
          reasoning: '我在思考...',
          toolCalls: [
            { id: 'tc1', toolName: 'read_file', args: {}, status: 'success', duration: 1500 },
          ],
        }),
      ]
      render(<MessageList {...baseProps} messages={msgs} />)
      expect(screen.queryByTestId('message-plan-steps-a1')).toBeNull()
    })

    it('空 assistant 消息:不显示 PlanStepsCard', () => {
      const msgs = [makeAssistantMsg('a1', '')]
      render(<MessageList {...baseProps} messages={msgs} />)
      expect(screen.queryByTestId('message-plan-steps-a1')).toBeNull()
    })
  })

  // 2026-08-29:思考过程自动展开/收起生命周期(对标主流 AI 产品:思考中展开,思考结束收起)
  // 注意渲染路径:content 为空的"思考/等待"阶段只渲染 TypingIndicator,
  // ThinkingSection 在正文到达后才挂载 → 生命周期断言基于真实挂载时机
  describe('思考过程展开/收起生命周期', () => {
    it('思考阶段(content 为空):不渲染思考区,由 TypingIndicator 展示思考预览', () => {
      const msgs = [makeAssistantMsg('a1', '', { reasoning: '让我想一想这个问题' })]
      render(<MessageList {...baseProps} messages={msgs} isStreaming />)
      expect(screen.queryByTestId('thinking-section')).toBeNull()
      expect(screen.getByText(/正在思考/)).toBeTruthy()
    })

    it('正文到达:思考区挂载后自动收起(思考结束让位给回答,不闪展开态)', () => {
      const msgs = [makeAssistantMsg('a1', '', { reasoning: '让我想一想这个问题' })]
      const { rerender } = render(<MessageList {...baseProps} messages={msgs} isStreaming />)
      expect(screen.queryByTestId('thinking-section')).toBeNull()
      // 正文第一个 token 到达 → 思考区挂载,自动展开标记生效 → 立即收起
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '答案来了', { reasoning: '让我想一想这个问题' })]}
          isStreaming
        />,
      )
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'false',
      )
    })

    it('正文流式期间 reasoning 交错到达:自动展开;流结束自动收起', () => {
      const msgs = [makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下' })]
      const { rerender } = render(<MessageList {...baseProps} messages={msgs} isStreaming />)
      // 交错输出:正文已有内容但 reasoning 继续更新 → 自动展开
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下,再补充分析' })]}
          isStreaming
        />,
      )
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'true',
      )
      // 流结束 → 自动收起
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下,再补充分析' })]}
        />,
      )
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'false',
      )
    })

    it('正文流式期间 reasoning 交错增长:显示增长指示(data-thinking-growing);流结束指示消失', () => {
      const msgs = [makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下' })]
      const { rerender } = render(<MessageList {...baseProps} messages={msgs} isStreaming />)
      // 交错输出:reasoning 超出基线继续增长 → 自动展开 + 增长指示(2026-08-29 立)
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下,再补充分析' })]}
          isStreaming
        />,
      )
      const section = screen.getByTestId('thinking-section')
      expect(section.getAttribute('data-thinking-growing')).toBe('true')
      expect(section.getAttribute('data-thinking-expanded')).toBe('true')
      // 流结束 → 增长指示自动消失
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下,再补充分析' })]}
        />,
      )
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-growing')).toBe(
        'false',
      )
    })

    it('用户手动展开后:流结束不强制收起(尊重用户操作)', () => {
      const msgs = [makeAssistantMsg('a1', '部分回答', { reasoning: '先想一下' })]
      const { rerender } = render(<MessageList {...baseProps} messages={msgs} isStreaming />)
      // 正文已在输出 → 思考区挂载即折叠;用户手动展开
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'false',
      )
      fireEvent.click(screen.getByTestId('thinking-toggle'))
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'true',
      )
      // 流结束 → 用户手动展开的保持展开
      rerender(
        <MessageList
          {...baseProps}
          messages={[makeAssistantMsg('a1', '完整回答', { reasoning: '先想一下' })]}
        />,
      )
      expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
        'true',
      )
    })
  })

  // ─── 10. D22:error 独立消息类型 / system 角色分支 / 圈选引用(2026-09-19 立)──
  describe('D22 消息类型与引用交互', () => {
    afterEach(() => {
      // 恢复本 describe 内的 getSelection 等 spy,避免泄漏到其他 describe
      vi.restoreAllMocks()
    })

    it('system 消息:居中提示条渲染,无 copy/retry/圈选等任何操作按钮', () => {
      const msgs = [
        {
          id: 'm-sys',
          role: 'system',
          content: '上下文已注入项目规则',
          createdAt: Date.now(),
          model: 'test-model',
        } as ChatMessage,
      ]
      render(<MessageList {...baseProps} messages={msgs} />)
      const sys = screen.getByTestId('message-system-m-sys')
      expect(sys).toBeTruthy()
      expect(sys.getAttribute('data-role')).toBe('system')
      expect(sys.textContent).toContain('上下文已注入项目规则')
      // system 条目不提供任何操作(防上下文注入通道,请求侧已同步拒绝)
      expect(screen.queryByTestId('message-copy-m-sys')).toBeNull()
      expect(screen.queryByTestId('message-retry-m-sys')).toBeNull()
      expect(screen.queryByTestId('message-quote-selection-m-sys')).toBeNull()
    })

    it('error 消息:红色错误卡片(独立标题头 + 正文剥离 ⚠ 前缀)', () => {
      // 内聚 retry 按钮的点击行为已由上方「错误重试按钮」describe 覆盖(testid
      // message-retry-m-err 保留在卡片内,向后兼容),此处只验证卡片新结构。
      const msgs = [makeAssistantMsg('m-err', '⚠ 余额不足', { error: true })]
      render(<MessageList {...baseProps} messages={msgs} />)
      const card = screen.getByTestId('message-error-card-m-err')
      expect(card).toBeTruthy()
      // 独立标题头(errorCardTitle 译文)
      expect(screen.getByText('Request failed')).toBeTruthy()
      // 正文剥离 shared 层附加的 ⚠ 前缀,只展示纯错误文案
      expect(screen.getByText('余额不足')).toBeTruthy()
      // retry 按钮内聚卡片底部
      expect(screen.getByTestId('message-retry-m-err')).toBeTruthy()
    })

    it('assistant 消息无选区:不显示「引用选中」按钮', () => {
      const msgs = [makeAssistantMsg('a-nosel', '无选区内容')]
      render(<MessageList {...baseProps} messages={msgs} />)
      expect(screen.queryByTestId('message-quote-selection-a-nosel')).toBeNull()
    })

    it('error 消息即使有选区也不显示圈选按钮(error 卡片不可圈选)', () => {
      const msgs = [makeAssistantMsg('a-errsel', '⚠ 出错内容', { error: true })]
      render(<MessageList {...baseProps} messages={msgs} />)
      const anchorNode = screen.getByTestId('message-error-card-a-errsel').firstChild
      vi.spyOn(window, 'getSelection').mockReturnValue({
        anchorNode,
        isCollapsed: false,
        toString: () => '出错内容',
        removeAllRanges: vi.fn(),
      } as unknown as Selection)
      fireEvent(document, new Event('selectionchange'))
      expect(screen.queryByTestId('message-quote-selection-a-errsel')).toBeNull()
    })

    it('圈选 AI 回复文本:尾部浮现「引用选中」按钮,点击派发 ihui:add-text-reference 并清除选区', async () => {
      const msgs = [makeAssistantMsg('a-sel', '可圈选的回答内容')]
      render(<MessageList {...baseProps} messages={msgs} />)
      // 锚点须真实落在消息内容区(markdown-stream 由 mock 渲染,是 contentAreaRef 子孙)
      const anchorNode = document.querySelector('[data-testid="markdown-stream"]')!.firstChild
      const removeAllRanges = vi.fn()
      vi.spyOn(window, 'getSelection').mockReturnValue({
        anchorNode,
        isCollapsed: false,
        toString: () => '可圈选的回答',
        removeAllRanges,
      } as unknown as Selection)
      fireEvent(document, new Event('selectionchange'))
      const btn = await screen.findByTestId('message-quote-selection-a-sel')
      expect(btn.textContent).toContain('Quote selection')
      const handler = vi.fn()
      window.addEventListener('ihui:add-text-reference', handler)
      try {
        fireEvent.click(btn)
        expect(handler).toHaveBeenCalledTimes(1)
        const evt = handler.mock.calls[0]?.[0] as CustomEvent | undefined
        expect(evt?.detail?.text).toBe('可圈选的回答')
      } finally {
        window.removeEventListener('ihui:add-text-reference', handler)
      }
      // 点击后:清除原生选区 + toast + 组件内选区态复位(按钮消失)
      expect(removeAllRanges).toHaveBeenCalled()
      expect(toastMock.success).toHaveBeenCalledWith('Added to references')
      await waitFor(() => expect(screen.queryByTestId('message-quote-selection-a-sel')).toBeNull())
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
