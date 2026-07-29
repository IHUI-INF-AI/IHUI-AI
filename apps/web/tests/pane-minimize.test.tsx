// @vitest-environment jsdom
/**
 * Phase 23(2026-07-29):AgentTaskProgressPane 最小化模式 + Timeline 空状态优化 单测
 *
 * 覆盖:
 * - 最小化模式(8 test):
 *   1. 点击 minimize → isMinimized=true + 摘要条可见
 *   2. 摘要条显示进度百分比
 *   3. 摘要条显示工具调用数
 *   4. 摘要条显示子智能体数(subagentCount > 0 时)
 *   5. 子智能体数=0 时不显示子智能体文本
 *   6. 点击展开按钮 → isMinimized=false + 完整面板可见
 *   7. 摘要条有 role="status" + aria-live="polite"
 *   8. idle 状态(progress=0, toolCallCount=0)→ 自动展开
 *
 * - Timeline 空状态(7 test):
 *   9.  无事件 → 显示空状态(data-testid="timeline-empty-state")
 *   10. 空状态有 Inbox 图标
 *   11. 空状态有标题文本
 *   12. 空状态有提示文本
 *   13. 有事件但筛选无结果 → 显示筛选空状态(data-testid="timeline-filter-empty")
 *   14. 有事件 + filterType='all' → 不显示空状态
 *   15. 空状态不显示筛选按钮
 *
 * AGENTS.md §3:测试文件允许 any(mock 场景)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// ─── next-intl mock ──────────────────────────────────────────────
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    ariaLabel: 'Agent 任务进度面板',
    pin: '置顶',
    unpin: '取消置顶',
    minimize: '最小化',
    expandAll: '展开全部',
    collapseAll: '折叠全部',
    reconnecting: 'SSE 断连,正在重连(第 {n}/5 次)',
    progressLabel: '任务进度 {pct}%',
    'sseStatus.connected': '已连接',
    'sseStatus.connecting': '连接中',
    'sseStatus.reconnecting': '重连中',
    'sseStatus.disconnected': '已断开',
    'sseStatus.reconnectingShort': '重连 {n}/{max}',
    'sseStatus.disconnectedShort': '已断开',
    'sseStatus.tooltipError': '连接错误: {error}',
    stepInProgress: '步骤 {n}: {step} (进行中)',
    stepCompleted: '步骤 {n}: {step} (已完成)',
    stepPending: '步骤 {n}: {step} (待执行)',
    toolCallsCount: '{n} 次工具调用',
    sectionsToolbarLabel: '折叠子区工具栏',
    copy: '复制',
    copied: '已复制',
    'relativeTime.justNow': '刚刚',
    'relativeTime.secondsAgo': '{n}s前',
    'relativeTime.minutesAgo': '{n}m前',
    'relativeTime.hoursAgo': '{n}h前',
    'relativeTime.daysAgo': '{n}d前',
    'changes.title': '文件变更',
    'changes.oldContent': '原内容',
    'changes.copyOldContent': '复制原内容',
    'changes.newFile': '新文件',
    'changes.newContent': '新内容',
    'changes.copyNewContent': '复制新内容',
    'changes.added': '新增 {n}',
    'changes.modified': '修改 {n}',
    'changes.moreItems': '…还有 {n} 项',
    'terminal.title': '终端任务',
    'terminal.output': '输出',
    'terminal.copyOutput': '复制终端输出',
    'terminal.running': '{n} 运行中',
    'terminal.failed': '{n} 失败',
    'terminal.moreItems': '…还有 {n} 项',
    'tools.title': '工具调用',
    'tools.categoryRead': '读取',
    'tools.categorySearch': '搜索',
    'tools.categoryWrite': '编辑',
    'tools.categoryExec': '执行',
    'tools.categoryOther': '其他',
    'tools.args': '参数',
    'tools.copyArgs': '复制参数',
    'tools.result': '结果',
    'tools.copyResult': '复制结果',
    'tools.error': '错误',
    'tools.copyError': '复制错误信息',
    'tools.filterAll': '全部',
    'tools.filterRunning': '运行中',
    'tools.filterSuccess': '成功',
    'tools.filterError': '失败',
    'tools.searchPlaceholder': '搜索工具...',
    'tools.moreItems': '…还有 {n} 项',
    'tools.noMatch': '无匹配结果',
    'subagent.title': 'Subagent 派单',
    'subagent.statusSpawned': '已派发',
    'subagent.statusRunning': '运行中',
    'subagent.statusDone': '已完成',
    'subagent.statusFailed': '失败',
    'subagent.statusDead': '已死亡',
    'subagent.toolCallsTitle': '{n} 次工具调用',
    'subagent.toolCallsCount': '{n}次',
    'subagent.state': '状态:',
    'subagent.role': '角色:',
    'subagent.pendingApproval': '待审批',
    'subagent.startedAt': '启动:',
    'subagent.endedAt': '结束:',
    'subagent.duration': '耗时:',
    'subagent.copyThreadId': '复制 threadId',
    'subagent.toolsCount': '工具调用({n})',
    'subagent.active': '{n} 活跃',
    'subagent.done': '{n} 完成',
    'subagent.failed': '{n} 失败',
    'overview.title': '任务总览',
    'overview.statusIdle': '空闲',
    'overview.statusRunning': '运行中',
    'overview.statusCompleted': '已完成',
    'overview.statusFailed': '失败',
    'overview.statusInterrupted': '已中断',
    'overview.steps': '步骤',
    'overview.subagents': '子代理',
    'overview.active': '活跃',
    'overview.total': '总',
    'overview.dead': '死亡',
    'overview.terminals': '终端',
    'overview.running': '运行',
    'overview.changes': '变更',
    'overview.files': '文件',
    'overview.duration': '耗时',
    'overview.token': 'Token',
    'overview.rate': '速率',
    'overview.eta': '预计',
    'overview.context': '上下文',
    emptyHint: '开始对话后显示任务计划',
    emptyHintsLabel: '任务计划使用提示',
    emptyHint1: '开始对话后,这里会显示 AI 的任务拆解与进度',
    emptyHint2: '子代理 / 工具调用 / 终端输出会自动归类到对应区域',
    emptyHint3: '点击任一任务可跳转到对话流中的对应位置',
    dragHandle: '拖动以调整面板位置',
    celebrate: '全部任务完成',
    helpToggle: '快捷键帮助',
    helpClose: '关闭',
    helpPanelTitle: '键盘快捷键',
    shortcutsGroupNav: '导航',
    shortcutsGroupPane: '面板',
    shortcutsGroupTrigger: '触发器',
    shortcutSectionNav: '折叠子区上下切换',
    shortcutSectionFirstLast: '跳到第一个/最后一个子区',
    shortcutShowHelp: '打开/关闭快捷键帮助',
    shortcutCloseHelp: '关闭快捷键帮助',
    shortcutTogglePane: '切换面板开关',
    shortcutOpenPane: '在输入框打开面板',
    tabInline: '对话',
    tabTimeline: '时间线',
    previewStepNumberAndName: '步骤 {n}: {step}',
    previewDuration: '耗时 {duration}',
    previewTokenK: '{k}k tokens',
    previewToolCalls: '{n} 次工具调用',
    previewRelatedMessage: '关联消息:',
    stepBudgetLabel: '步骤预算',
    executing: '执行中',
    subagentBatch: '子代理批次',
    planListLabel: '任务计划步骤列表',
    completedCount: '{done}/{total} 步骤已完成',
    copyPlan: '复制任务计划',
    moreItems: '…还有 {n} 项',
    jumpToLatest: '跳到最新',
    latest: '最新',
    pinHintPinned: '已置顶,点击外部不关闭',
    pinHintUnpinned: '已取消置顶,点击外部关闭',
    minimizeHint: '最小化任务面板',
    emptyTitle: '等待任务开始',
    emptySubtitle: '对话开始后,任务拆解会显示在这里',
    elapsedTitle: '已耗时 {time}',
    failureBanner: '{n} 个任务失败,点击查看',
    thinkingTitle: '思考过程',
    thinkingStreaming: '思考中...',
    thinkingChars: '字',
    copyThinking: '复制思考内容',
    thinkingElapsedTitle: '已思考 {time}',
    thinkingCharCountTitle: '{n} 个字符',
    // Phase 23 新增 key
    minimizedRunning: 'AI 执行中',
    minimizedTools: '工具调用',
    minimizedSubagents: '子智能体',
    expand: '展开面板',
    timelineEmptyTitle: '暂无事件',
    timelineEmptyHint: '发送消息后,Timeline 将显示 AI 执行事件',
    timelineFilterEmpty: '该类型暂无事件',
    // Timeline tab 相关 key
    timelineFilterAll: '全部',
    timelineFilterPlan: '计划',
    timelineFilterSubagent: '子智能体',
    timelineFilterTool: '工具',
    timelineFilterThinking: '思考',
    timelineCountDone: '已完成',
    timelineCountFailed: '失败',
    timelineCountRunning: '运行中',
    timelineTabsAriaLabel: '时间线 tab 切换',
    timelineSearchPlaceholder: '搜索时间线...',
    timelineSearchAriaLabel: '搜索时间线事件',
    timelineSearchClear: '清空搜索',
    timelineInlineHint: '对话流内联展示(在主消息列表中显示)',
    timelineNoMatch: '没有匹配当前过滤条件的事件',
    timelineClearFilters: '清空过滤',
    timelineExport: '导出为 Markdown',
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
  return { mockT }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// ─── @ihui/api-client mock ───────────────────────────────────────
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
}))

// ─── lucide-react mock(用 span 替代图标) ─────────────────────────
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = ({
    className,
    'data-testid': dataTestId,
    ...rest
  }: {
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }) => (
    <span
      data-testid={dataTestId ?? 'lucide-icon'}
      className={className}
      data-lucide-span="true"
      {...rest}
    />
  )
  return { IconSpan }
})
vi.mock('lucide-react', () => {
  const Icon = IconSpan
  return {
    __esModule: true,
    Pin: Icon,
    PinOff: Icon,
    Minimize2: Icon,
    Maximize2: Icon,
    Circle: Icon,
    Loader2: Icon,
    Check: Icon,
    Copy: Icon,
    ListTodo: Icon,
    MessageSquare: Icon,
    ChevronRight: Icon,
    Brain: Icon,
    Wrench: Icon,
    X: Icon,
    Users: Icon,
    AlertTriangle: Icon,
    FileEdit: Icon,
    FilePlus: Icon,
    FileText: Icon,
    Search: Icon,
    Terminal: Icon,
    TerminalSquare: Icon,
    ChevronsUpDown: Icon,
    ChevronsDownUp: Icon,
    Zap: Icon,
    Activity: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    AlertCircle: Icon,
    SignalHigh: Icon,
    SignalMedium: Icon,
    RotateCw: Icon,
    WifiOff: Icon,
    ArrowDown: Icon,
    Minus: Icon,
    Bot: Icon,
    Clock: Icon,
    ChevronDown: Icon,
    ShieldCheck: Icon,
    ShieldAlert: Icon,
    Hand: Icon,
    ListTree: Icon,
    Signal: Icon,
    SignalLow: Icon,
    Code2: Icon,
    FileCode: Icon,
    Sparkles: Icon,
    GripVertical: Icon,
    HelpCircle: Icon,
    Keyboard: Icon,
    Clipboard: Icon,
    MessageSquareWarning: Icon,
    RefreshCw: Icon,
    Share2: Icon,
    Trash2: Icon,
    Timer: Icon,
    Inbox: Icon,
    FilterX: Icon,
    Download: Icon,
  }
})

// ─── useChatStore mock ───────────────────────────────────────────
const mockChatStoreRefs: {
  getConversationId: () => string | null
  setConversationId: (id: string | null) => void
} = vi.hoisted(() => {
  let id: string | null = null
  return {
    getConversationId: () => id,
    setConversationId: (next: string | null) => {
      id = next
    },
  }
})
vi.mock('@/stores/chat', () => ({
  useChatStore: (
    selector: (s: {
      conversationId: string | null
      messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }>
    }) => unknown,
  ) => selector({ conversationId: mockChatStoreRefs.getConversationId(), messages: [] }),
}))

// ─── useAgentProgress mock(可动态控制 planSteps/tools/subagents) ──
type MockPlanStep = {
  id: string
  step: string
  status: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  endedAt?: string
  durationMs?: number
  explanation?: string
  tokenUsage?: number
}

type MockAgentProgressState = {
  planSteps: MockPlanStep[]
  subagents: unknown[]
  terminals: unknown[]
  tools: unknown[]
  changes: unknown[]
  events: unknown[]
  isStreaming: boolean
  overview: Record<string, unknown>
}

const mockAgentProgressRefs: {
  getState: () => MockAgentProgressState
  setState: (next: Partial<MockAgentProgressState>) => void
  resetState: () => void
} = vi.hoisted(() => {
  const initial: MockAgentProgressState = {
    planSteps: [],
    subagents: [],
    terminals: [],
    tools: [],
    changes: [],
    events: [],
    isStreaming: false,
    overview: {
      status: 'idle',
      currentNode: null,
      plan: null,
      content: '',
      error: null,
      interruptEvent: null,
      sessionStart: null,
      totalSteps: 0,
      completedSteps: 0,
      inProgressSteps: 0,
      pendingSteps: 0,
      totalSubagents: 0,
      activeSubagents: 0,
      deadSubagents: 0,
      totalTerminals: 0,
      runningTerminals: 0,
      totalChanges: 0,
      historicalDurations: [],
      reconnectAttempt: 0,
    },
  }
  const state: MockAgentProgressState = { ...initial }
  return {
    getState: () => state,
    setState: (next) => Object.assign(state, next),
    resetState: () => Object.assign(state, initial),
  }
})

vi.mock('@/hooks/use-agent-progress', async () => {
  const actual = await vi.importActual<typeof import('../src/hooks/use-agent-progress')>(
    '../src/hooks/use-agent-progress',
  )
  return {
    ...actual,
    useAgentProgress: () => {
      const s = mockAgentProgressRefs.getState()
      return {
        overview: s.overview as never,
        planSteps: s.planSteps as never,
        subagents: s.subagents as never,
        terminals: s.terminals as never,
        tools: s.tools as never,
        changes: s.changes as never,
        events: s.events as never,
        isStreaming: s.isStreaming,
        start: () => {},
        stop: () => {},
        clear: () => {},
      }
    },
  }
})

import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'
import { TimelineTab } from '../src/components/ai/progress-sections/timeline-tab'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'
import { useTimelineStore, type TimelineEvent } from '../src/stores/timeline-store'

// ─── 工具函数:构造 Timeline 事件 ─────────────────────────────────
function makeTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 9)}`,
    type: overrides.type ?? 'plan',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:00Z',
    title: overrides.title ?? 'test event',
    description: overrides.description,
    status: overrides.status ?? 'pending',
    messageId: overrides.messageId,
    planStepId: overrides.planStepId,
    toolCallId: overrides.toolCallId,
    children: overrides.children,
    meta: overrides.meta,
  }
}

// ─── 最小化模式测试数据 ──────────────────────────────────────────
const MOCK_PLAN_STEPS_WITH_PROGRESS: MockPlanStep[] = [
  { id: 'p1', step: '步骤 1', status: 'completed' },
  { id: 'p2', step: '步骤 2', status: 'completed' },
  { id: 'p3', step: '步骤 3', status: 'in_progress' },
  { id: 'p4', step: '步骤 4', status: 'pending' },
]

const MOCK_TOOLS = [
  { id: 't1', toolName: 'read_file', args: {}, status: 'success', startedAt: '2026-01-01T00:00:00Z', durationMs: 100 },
  { id: 't2', toolName: 'edit_file', args: {}, status: 'success', startedAt: '2026-01-01T00:00:01Z', durationMs: 200 },
  { id: 't3', toolName: 'search', args: {}, status: 'running', startedAt: '2026-01-01T00:00:02Z' },
]

const MOCK_SUBAGENTS = [
  { id: 's1', threadId: 'thread-1', nickname: 'agent1', handle: '@agent1', color: 'cyan', status: 'running', spawnedAt: '2026-01-01T00:00:00Z', currentTask: '任务 1' },
  { id: 's2', threadId: 'thread-2', nickname: 'agent2', handle: '@agent2', color: 'green', status: 'done', spawnedAt: '2026-01-01T00:00:00Z', currentTask: '任务 2' },
]

// ═════════════════════════════════════════════════════════════════
// 最小化模式测试(8 test)
// ═════════════════════════════════════════════════════════════════
describe('AgentTaskProgressPane — Phase 23 最小化模式', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
    mockAgentProgressRefs.resetState()
    mockChatStoreRefs.setConversationId(null)
    try {
      window.localStorage.removeItem('agent-progress-pane-position')
      window.localStorage.removeItem('agent-progress-pane-position-v2')
      window.localStorage.removeItem('agent-progress-pane-position-v3')
    } catch {
      // 忽略
    }
  })

  afterEach(() => {
    cleanup()
    mockChatStoreRefs.setConversationId(null)
  })

  /** 设置 threadId(同时通过 conversationId 让 useEffect 不会覆盖) */
  const setTestThreadId = (id: string) => {
    mockChatStoreRefs.setConversationId(id)
    useAgentProgressPaneStore.getState().setThreadId(id)
  }

  /** 设置有进度的 mock 数据(4 步 2 完成 → 50%,3 tools,2 subagents) */
  const setupProgressData = () => {
    mockAgentProgressRefs.setState({
      planSteps: MOCK_PLAN_STEPS_WITH_PROGRESS,
      tools: MOCK_TOOLS,
      subagents: MOCK_SUBAGENTS,
      isStreaming: true,
    })
  }

  // ── 1. 点击 minimize → isMinimized=true + 摘要条可见 ──

  it('1. 点击 minimize 按钮 → 摘要条可见(data-testid="pane-minimized-bar")', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-1')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    // 初始:完整面板可见,摘要条不存在
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeNull()
    expect(document.body.querySelector('[data-testid="agent-progress-pane"]')).toBeTruthy()

    // 点击最小化
    fireEvent.click(screen.getByTestId('pane-minimize'))

    // 摘要条出现
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeTruthy()
    // 完整面板不再渲染
    expect(document.body.querySelector('[data-testid="agent-progress-pane"]')).toBeNull()
  })

  // ── 2. 摘要条显示进度百分比 ──

  it('2. 摘要条显示进度百分比(50% — 2/4 completed)', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-2')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    fireEvent.click(screen.getByTestId('pane-minimize'))

    const bar = document.body.querySelector('[data-testid="pane-minimized-bar"]')
    expect(bar).toBeTruthy()
    // 50% (2/4 completed)
    expect(bar?.textContent).toContain('50')
    expect(bar?.textContent).toContain('%')
  })

  // ── 3. 摘要条显示工具调用数 ──

  it('3. 摘要条显示工具调用数(3 tools)', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-3')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    fireEvent.click(screen.getByTestId('pane-minimize'))

    const bar = document.body.querySelector('[data-testid="pane-minimized-bar"]')
    expect(bar).toBeTruthy()
    // 3 tools
    expect(bar?.textContent).toContain('3')
    expect(bar?.textContent).toContain('工具调用')
  })

  // ── 4. 摘要条显示子智能体数(subagentCount > 0 时) ──

  it('4. 摘要条显示子智能体数(2 subagents > 0 时显示)', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-4')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    fireEvent.click(screen.getByTestId('pane-minimize'))

    const bar = document.body.querySelector('[data-testid="pane-minimized-bar"]')
    expect(bar).toBeTruthy()
    // 2 subagents
    expect(bar?.textContent).toContain('2')
    expect(bar?.textContent).toContain('子智能体')
  })

  // ── 5. 子智能体数=0 时不显示子智能体文本 ──

  it('5. 子智能体数=0 时不显示子智能体文本', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-5')
    // 有进度但无 subagents
    mockAgentProgressRefs.setState({
      planSteps: MOCK_PLAN_STEPS_WITH_PROGRESS,
      tools: MOCK_TOOLS,
      subagents: [],
      isStreaming: true,
    })

    const { container } = render(<AgentTaskProgressPane />)
    fireEvent.click(screen.getByTestId('pane-minimize'))

    const bar = document.body.querySelector('[data-testid="pane-minimized-bar"]')
    expect(bar).toBeTruthy()
    // 不含"子智能体"文本
    expect(bar?.textContent).not.toContain('子智能体')
  })

  // ── 6. 点击展开按钮 → isMinimized=false + 完整面板可见 ──

  it('6. 点击展开按钮 → 完整面板恢复(data-testid="agent-progress-pane" 可见)', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-6')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    // 最小化
    fireEvent.click(screen.getByTestId('pane-minimize'))
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeTruthy()
    expect(document.body.querySelector('[data-testid="agent-progress-pane"]')).toBeNull()

    // 点击展开
    fireEvent.click(screen.getByTestId('pane-expand'))

    // 完整面板恢复
    expect(document.body.querySelector('[data-testid="agent-progress-pane"]')).toBeTruthy()
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeNull()
  })

  // ── 7. 摘要条有 role="status" + aria-live="polite" ──

  it('7. 摘要条有 role="status" + aria-live="polite"(a11y 屏幕阅读器播报)', () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-7')
    setupProgressData()

    const { container } = render(<AgentTaskProgressPane />)
    fireEvent.click(screen.getByTestId('pane-minimize'))

    const bar = document.body.querySelector('[data-testid="pane-minimized-bar"]')
    expect(bar).toBeTruthy()
    expect(bar?.getAttribute('role')).toBe('status')
    expect(bar?.getAttribute('aria-live')).toBe('polite')
  })

  // ── 8. idle 状态(progress=0, toolCallCount=0)→ 自动展开 ──

  it('8. idle 状态(progress=0, toolCallCount=0)→ 自动展开(摘要条消失)', async () => {
    useAgentProgressPaneStore.getState().openPane()
    setTestThreadId('thread-min-8')
    // 初始有进度
    setupProgressData()

    const { container, rerender } = render(<AgentTaskProgressPane />)
    // 最小化
    fireEvent.click(screen.getByTestId('pane-minimize'))
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeTruthy()

    // 切换到 idle 状态(清空 planSteps + tools)
    mockAgentProgressRefs.setState({
      planSteps: [],
      tools: [],
      isStreaming: false,
    })

    // 重新渲染触发 effect
    await act(async () => {
      rerender(<AgentTaskProgressPane />)
      await Promise.resolve()
    })

    // 摘要条自动消失(isMinimized → false)
    expect(document.body.querySelector('[data-testid="pane-minimized-bar"]')).toBeNull()
    // 完整面板恢复
    expect(document.body.querySelector('[data-testid="agent-progress-pane"]')).toBeTruthy()
  })
})

// ═════════════════════════════════════════════════════════════════
// Timeline 空状态优化测试(7 test)
// ═════════════════════════════════════════════════════════════════
describe('TimelineTab — Phase 23 空状态优化', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
  })

  // ── 9. 无事件 → 显示空状态(data-testid="timeline-empty-state") ──

  it('9. 无事件 + activeTab=timeline → 显示空状态(data-testid="timeline-empty-state")', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setEvents([])
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-empty-state')).toBeTruthy()
    // 保留向后兼容:timeline-empty 仍存在
    expect(screen.getByTestId('timeline-empty')).toBeTruthy()
  })

  // ── 10. 空状态有 Inbox 图标 ──

  it('10. 空状态有 Inbox 图标(lucide-icon)', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setEvents([])
    const { container } = render(<TimelineTab />)
    const emptyState = container.querySelector('[data-testid="timeline-empty-state"]')
    expect(emptyState).toBeTruthy()
    // Inbox 图标(lucide mock 渲染为 span)
    const icon = emptyState?.querySelector('[data-testid="lucide-icon"]')
    expect(icon).toBeTruthy()
  })

  // ── 11. 空状态有标题文本 ──

  it('11. 空状态有标题文本(timelineEmptyTitle → "暂无事件")', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setEvents([])
    render(<TimelineTab />)
    expect(screen.getByText('暂无事件')).toBeTruthy()
  })

  // ── 12. 空状态有提示文本 ──

  it('12. 空状态有提示文本(timelineEmptyHint → "发送消息后...")', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setEvents([])
    render(<TimelineTab />)
    expect(screen.getByText('发送消息后,Timeline 将显示 AI 执行事件')).toBeTruthy()
  })

  // ── 13. 有事件但筛选无结果 → 显示筛选空状态 ──

  it('13. 有事件但筛选无结果 → 显示筛选空状态(data-testid="timeline-filter-empty")', () => {
    // 只有 plan 事件,筛选 tool → 无匹配
    useTimelineStore.getState().setEvents([
      makeTimelineEvent({ id: 'p1', type: 'plan', title: 'Plan 1', status: 'done' }),
      makeTimelineEvent({ id: 'p2', type: 'plan', title: 'Plan 2', status: 'pending' }),
    ])
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setFilterType('tool')
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-filter-empty')).toBeTruthy()
    // 保留向后兼容:timeline-no-match 仍存在
    expect(screen.getByTestId('timeline-no-match')).toBeTruthy()
  })

  // ── 14. 有事件 + filterType='all' → 不显示空状态 ──

  it('14. 有事件 + filterType=all → 不显示空状态(显示事件列表)', () => {
    useTimelineStore.getState().setEvents([
      makeTimelineEvent({ id: 'p1', type: 'plan', title: 'Plan 1', status: 'done' }),
    ])
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setFilterType('all')
    render(<TimelineTab />)
    // 空状态不显示
    expect(screen.queryByTestId('timeline-empty-state')).toBeNull()
    expect(screen.queryByTestId('timeline-filter-empty')).toBeNull()
    // 事件列表显示
    expect(screen.getByTestId('timeline-events')).toBeTruthy()
  })

  // ── 15. 空状态不显示筛选按钮 ──

  it('15. 无事件时不显示筛选按钮(filter-row 不渲染)', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setEvents([])
    render(<TimelineTab />)
    // 空状态显示
    expect(screen.getByTestId('timeline-empty-state')).toBeTruthy()
    // 筛选行不显示(因为 events.length === 0)
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
    // 搜索行不显示
    expect(screen.queryByTestId('timeline-search-row')).toBeNull()
  })
})
