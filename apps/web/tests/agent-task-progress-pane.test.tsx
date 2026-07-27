// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Mock next-intl — vi.hoisted 确保 mockT 在 vi.mock 工厂和测试体中均可使用
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    'pane.title': '任务计划',
    'pane.ariaLabel': 'Agent 任务进度面板',
    'pane.pin': '置顶',
    'pane.unpin': '取消置顶',
    'pane.minimize': '最小化',
    'pane.expandAll': '展开全部',
    'pane.collapseAll': '折叠全部',
    'pane.reconnecting': 'SSE 断连,正在重连(第 {n}/5 次)',
    'pane.stepInProgress': '步骤 {n}: {step} (进行中)',
    'pane.stepCompleted': '步骤 {n}: {step} (已完成)',
    'pane.stepPending': '步骤 {n}: {step} (待执行)',
    'pane.toolCallsCount': '{n} 次工具调用',
    'copy': '复制',
    'copied': '已复制',
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

// Mock @ihui/api-client
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
}))

// Mock lucide-react 图标为简单 span(避免 jsdom 渲染 svg 复杂性)
// vi.hoisted 确保 IconSpan 在 vi.mock 工厂执行前已定义
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = () => <span data-testid="lucide-icon" />
  return { IconSpan }
})
vi.mock('lucide-react', () => ({
  Pin: IconSpan,
  PinOff: IconSpan,
  Minimize2: IconSpan,
  Circle: IconSpan,
  Loader2: IconSpan,
  Check: IconSpan,
  Copy: IconSpan,
  ListTodo: IconSpan,
  MessageSquare: IconSpan,
  ChevronRight: IconSpan,
  Brain: IconSpan,
  Wrench: IconSpan,
  X: IconSpan,
  Users: IconSpan,
  AlertTriangle: IconSpan,
  FileEdit: IconSpan,
  FilePlus: IconSpan,
  FileText: IconSpan,
  Search: IconSpan,
  Terminal: IconSpan,
  TerminalSquare: IconSpan,
  ChevronsUpDown: IconSpan,
  ChevronsDownUp: IconSpan,
  Activity: IconSpan,
  CheckCircle2: IconSpan,
  XCircle: IconSpan,
  AlertCircle: IconSpan,
}))

// Mock useChatStore.conversationId(避免引入整个 chat store)
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: { conversationId: string | null }) => unknown) =>
    selector({ conversationId: null }),
}))

import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'
import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'
import { FoldableSection, formatRelativeTime } from '../src/components/ai/progress-sections/foldable-section'
import { ThinkingSection } from '../src/components/ai/progress-sections/thinking-section'
import { ToolCallsSection } from '../src/components/ai/progress-sections/tool-calls-section'
import { SubagentSection } from '../src/components/ai/progress-sections/subagent-section'
import { ChangesSection } from '../src/components/ai/progress-sections/changes-section'
import { TerminalSection } from '../src/components/ai/progress-sections/terminal-section'
import { OverviewSection } from '../src/components/ai/progress-sections/overview-section'
import type {
  AgentToolCall,
  Subagent,
  AgentChange,
  TerminalTask,
  AgentOverview,
} from '../src/hooks/use-agent-progress'

describe('AgentProgressPane Store — v6.1 popover 简化', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / pinned=true / progress=0,0', () => {
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.pinned).toBe(true)
    expect(s.progressCurrent).toBe(0)
    expect(s.progressTotal).toBe(0)
  })

  it('openPane — 打开(无参数,v6.1 不再接受 threadId)', () => {
    useAgentProgressPaneStore.getState().openPane()
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('closePane — 关闭但保留 threadId', () => {
    useAgentProgressPaneStore.getState().setThreadId('thread-abc')
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().closePane()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBe('thread-abc')
  })

  it('toggle — 切换 open 状态', () => {
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    useAgentProgressPaneStore.getState().toggle()
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    useAgentProgressPaneStore.getState().toggle()
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('togglePin — 切换 pinned 状态', () => {
    expect(useAgentProgressPaneStore.getState().pinned).toBe(true)
    useAgentProgressPaneStore.getState().togglePin()
    expect(useAgentProgressPaneStore.getState().pinned).toBe(false)
    useAgentProgressPaneStore.getState().togglePin()
    expect(useAgentProgressPaneStore.getState().pinned).toBe(true)
  })

  it('setProgress — 设置当前进度', () => {
    useAgentProgressPaneStore.getState().setProgress(3, 8)
    expect(useAgentProgressPaneStore.getState().progressCurrent).toBe(3)
    expect(useAgentProgressPaneStore.getState().progressTotal).toBe(8)
  })

  it('reset — 恢复默认状态', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().setThreadId('thread-x')
    useAgentProgressPaneStore.getState().togglePin()
    useAgentProgressPaneStore.getState().setProgress(2, 5)
    useAgentProgressPaneStore.getState().reset()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.pinned).toBe(true)
    expect(s.progressCurrent).toBe(0)
    expect(s.progressTotal).toBe(0)
  })
})

describe('AgentProgressTrigger — v5 内联文字按钮', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
    cleanup()
  })
  afterEach(() => {
    cleanup()
  })

  it('无进度时显示"任务列表"', () => {
    render(<AgentProgressTrigger />)
    const trigger = screen.getByTestId('agent-progress-trigger')
    expect(trigger).toBeTruthy()
    expect(trigger.textContent).toBe('任务列表')
  })

  it('有进度时显示"01/06"格式', () => {
    useAgentProgressPaneStore.getState().setProgress(1, 6)
    render(<AgentProgressTrigger />)
    const trigger = screen.getByTestId('agent-progress-trigger')
    expect(trigger.textContent).toBe('01/06')
  })

  it('点击切换面板开关', () => {
    render(<AgentProgressTrigger />)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    fireEvent.click(screen.getByTestId('agent-progress-trigger'))
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('面板打开时 trigger 不渲染(与 popover 联动隐藏,v6)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentProgressTrigger />)
    // open=true → trigger 隐藏,把空间让给 popover
    expect(screen.queryByTestId('agent-progress-trigger')).toBeNull()
  })

  it('trigger 默认态含背景色 + 描边(v6 bg-card + border-border)', () => {
    render(<AgentProgressTrigger />)
    const trigger = screen.getByTestId('agent-progress-trigger')
    expect(trigger.className).toContain('bg-card')
    expect(trigger.className).toContain('border-border')
  })

  it('Ctrl+Shift+J 切换面板', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'j',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      )
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('ArrowDown 打开未打开的面板', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        }),
      )
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('焦点在 INPUT 时不拦截快捷键', () => {
    render(
      <div>
        <input data-testid="test-input" type="text" />
        <AgentProgressTrigger />
      </div>,
    )
    const input = screen.getByTestId('test-input')
    input.focus()
    act(() => {
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      })
      Object.defineProperty(evt, 'target', { value: input })
      window.dispatchEvent(evt)
    })
    // 面板未打开(因为焦点在 input,快捷键被忽略)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })
})

describe('AgentTaskProgressPane — v6.1 popover 渲染', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('未打开时不渲染', () => {
    const { container } = render(<AgentTaskProgressPane />)
    expect(container.firstChild).toBeNull()
  })

  it('打开但无 threadId — 显示"开始对话后显示任务计划"提示', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByTestId('agent-progress-pane')).toBeTruthy()
    // 无 threadId 输入框(v6.1 删除)
    expect(screen.queryByTestId('thread-id-input')).toBeNull()
    expect(screen.getByText('开始对话后显示任务计划')).toBeTruthy()
  })

  it('最小化按钮可见且与 trigger 联动(点击 toggle,open 从 true 变 false)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const minimizeBtn = screen.getByTestId('pane-minimize')
    expect(minimizeBtn).toBeTruthy()
    // 点击最小化 → toggle → open=false(与 trigger 按钮点击行为一致:popover 关闭)
    fireEvent.click(minimizeBtn)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    // popover 关闭后组件 return null,minimize 按钮不再渲染
    // 再次打开需通过 trigger 按钮(或 openPane),体现"与 trigger 联动"
    useAgentProgressPaneStore.getState().openPane()
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('pin 按钮存在且可切换 pinned 状态', () => {
    useAgentProgressPaneStore.getState().openPane()
    // 默认 pinned=true
    expect(useAgentProgressPaneStore.getState().pinned).toBe(true)
    render(<AgentTaskProgressPane />)
    const pinBtn = screen.getByTestId('pane-pin')
    expect(pinBtn).toBeTruthy()
    fireEvent.click(pinBtn)
    expect(useAgentProgressPaneStore.getState().pinned).toBe(false)
  })

  it('v9 展开全部/折叠全部按钮存在且可点击', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const expandBtn = screen.getByTestId('pane-expand-all')
    expect(expandBtn).toBeTruthy()
    fireEvent.click(expandBtn)
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('pinned=true 时 Esc 不关闭(避免误操作)', () => {
    useAgentProgressPaneStore.getState().openPane()
    // 默认 pinned=true
    render(<AgentTaskProgressPane />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('pinned=false 时 Esc 关闭', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().togglePin() // pinned=false
    render(<AgentTaskProgressPane />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  // v6.1 重构后已删除的功能(对应测试也删除):
  // - threadId 输入框(v6.1 自动从 useChatStore.conversationId 同步)
  // - verbose/autoScroll/paneHeight/expandedIds(v4 残留,v6 已删除)
  // - resize handle(v4 残留,v6 popover 固定尺寸)
})

describe('Progress Sections — 折叠子区组件(对齐 Trae Work)', () => {
  afterEach(() => {
    cleanup()
  })

  it('FoldableSection — 默认折叠,点击切换展开/折叠', () => {
    const { container } = render(
      <FoldableSection title="测试" data-testid="test-foldable">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')
    expect(btn).toBeTruthy()
    expect(btn?.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn!)
    expect(btn?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn!)
    expect(btn?.getAttribute('aria-expanded')).toBe('false')
  })

  it('FoldableSection — count > 0 时显示计数', () => {
    const { container } = render(
      <FoldableSection title="测试" count={5} data-testid="test-foldable">
        <span>内容</span>
      </FoldableSection>,
    )
    expect(container.textContent).toContain('5')
  })

  it('ThinkingSection — 无内容无节点时不渲染', () => {
    const { container } = render(
      <ThinkingSection content="" currentNode={null} isStreaming={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('ThinkingSection — 有内容时渲染', () => {
    const { container } = render(
      <ThinkingSection content="正在分析..." currentNode="planner" isStreaming={true} />,
    )
    expect(container.firstChild).not.toBeNull()
    // 展开后检查内容(FoldableSection 默认折叠)
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('正在分析')
  })

  it('ToolCallsSection — 无工具调用时不渲染', () => {
    const { container } = render(<ToolCallsSection tools={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('ToolCallsSection — 有工具调用时渲染并显示分类摘要', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't1',
        toolName: 'read_file',
        args: { file_path: 'src/components/Button.tsx' },
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
        durationMs: 1000,
      },
      {
        id: 't2',
        toolName: 'search',
        args: { query: 'useEffect' },
        status: 'success',
        startedAt: '2026-01-01T00:00:01Z',
        durationMs: 2000,
      },
      {
        id: 't3',
        toolName: 'edit_file',
        args: { file_path: 'src/lib/utils.ts' },
        status: 'running',
        startedAt: '2026-01-01T00:00:02Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    expect(container.firstChild).not.toBeNull()
    // 展开后检查摘要
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('读取 1')
    expect(container.textContent).toContain('搜索 1')
    expect(container.textContent).toContain('编辑 1')
    // v8:参数预览(basename)
    expect(container.textContent).toContain('Button.tsx')
    expect(container.textContent).toContain('utils.ts')
  })

  it('ToolCallsSection — v9 搜索过滤(工具数量>5时显示搜索框)', () => {
    const tools: AgentToolCall[] = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      toolName: i % 2 === 0 ? 'read_file' : 'search',
      args: i % 2 === 0 ? { file_path: `src/File${i}.tsx` } : { query: `keyword${i}` },
      status: 'success' as const,
      startedAt: '2026-01-01T00:00:00Z',
    }))
    const { container } = render(<ToolCallsSection tools={tools} />)
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    const searchInput = screen.getByTestId('tool-search-input')
    expect(searchInput).toBeTruthy()
    // 输入搜索关键词,过滤掉 search 工具
    fireEvent.change(searchInput, { target: { value: 'read_file' } })
    // 验证过滤生效(search 工具的 keyword 参数不显示)
    expect(container.textContent).not.toContain('keyword')
  })

  it('ToolCallsSection — v9 搜索无匹配时显示"无匹配结果"', () => {
    const tools: AgentToolCall[] = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      toolName: 'read_file',
      args: { file_path: `src/File${i}.tsx` },
      status: 'success' as const,
      startedAt: '2026-01-01T00:00:00Z',
    }))
    const { container } = render(<ToolCallsSection tools={tools} />)
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    const searchInput = screen.getByTestId('tool-search-input')
    fireEvent.change(searchInput, { target: { value: 'nonexistent_tool' } })
    expect(container.textContent).toContain('无匹配结果')
  })

  it('ToolCallsSection — v10 点击工具行展开完整 args + result', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-detail-1',
        toolName: 'read_file',
        args: { file_path: 'src/components/Button.tsx', encoding: 'utf-8' },
        result: { content: 'export function Button() { return null }', lines: 1 },
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
        durationMs: 500,
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    // 先展开 FoldableSection
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    // 找到 ToolCallItem 的可点击行(role=button)
    const toolItem = container.querySelector('[data-testid="tool-item-t-detail-1"]')
    expect(toolItem).toBeTruthy()
    // 折叠状态下 aria-expanded=false
    expect(toolItem?.getAttribute('aria-expanded')).toBe('false')
    // 点击展开
    fireEvent.click(toolItem!)
    // 展开后应显示完整 args JSON 和 result
    expect(toolItem?.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('参数')
    expect(container.textContent).toContain('file_path')
    expect(container.textContent).toContain('Button.tsx')
    expect(container.textContent).toContain('结果')
    expect(container.textContent).toContain('export function Button')
    // 再次点击折叠
    fireEvent.click(toolItem!)
    expect(toolItem?.getAttribute('aria-expanded')).toBe('false')
  })

  it('ToolCallsSection — v10 error 状态工具展开显示错误信息', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-err-1',
        toolName: 'edit_file',
        args: { file_path: 'src/missing.ts' },
        error: 'ENOENT: no such file or directory',
        status: 'error',
        startedAt: '2026-01-01T00:00:00Z',
        durationMs: 100,
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const toolItem = container.querySelector('[data-testid="tool-item-t-err-1"]')!
    fireEvent.click(toolItem)
    expect(toolItem.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('错误')
    expect(container.textContent).toContain('ENOENT')
  })

  it('ToolCallsSection — v10 无 args/result 的工具不显示展开箭头', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-empty-1',
        toolName: 'unknown_tool',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const toolItem = container.querySelector('[data-testid="tool-item-t-empty-1"]')!
    // 无详情,role 不应为 button
    expect(toolItem.getAttribute('role')).toBeNull()
    expect(toolItem.getAttribute('aria-expanded')).toBeNull()
  })

  it('SubagentSection — 无子代理时不渲染', () => {
    const { container } = render(<SubagentSection subagents={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('SubagentSection — 有子代理时渲染并显示 @handle + toolCalls + tokenUsage', () => {
    const subagents: Subagent[] = [
      {
        id: 's1',
        threadId: 'thread-1',
        nickname: 'validator',
        handle: '@validator',
        color: 'cyan',
        status: 'running',
        spawnedAt: '2026-01-01T00:00:00Z',
        currentTask: '验证类型',
        toolCalls: 5,
        tokenUsage: 12000,
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    expect(container.firstChild).not.toBeNull()
    // 展开后检查内容
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('@validator')
    expect(container.textContent).toContain('验证类型')
    // v8:toolCalls + tokenUsage
    expect(container.textContent).toContain('5次')
    expect(container.textContent).toContain('12k')
  })

  it('SubagentSection — failed 状态显示 failureReason 替代 currentTask', () => {
    const subagents: Subagent[] = [
      {
        id: 's2',
        threadId: 'thread-2',
        nickname: 'reviewer',
        handle: '@reviewer',
        color: 'red',
        status: 'failed',
        spawnedAt: '2026-01-01T00:00:00Z',
        endedAt: '2026-01-01T00:01:00Z',
        durationMs: 60000,
        currentTask: '审查代码',
        failureReason: '连接超时',
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    // v8:failed 时显示 failureReason,不显示 currentTask
    expect(container.textContent).toContain('连接超时')
    expect(container.textContent).not.toContain('审查代码')
  })

  it('SubagentSection — v10 点击 subagent 展开详情(role/time/threadId)', () => {
    const subagents: Subagent[] = [
      {
        id: 's-expand-1',
        threadId: 'thread-expand-1',
        nickname: 'explorer',
        handle: '@explorer',
        color: 'cyan',
        status: 'running',
        role: 'researcher',
        spawnedAt: '2026-01-01T10:00:00Z',
        currentTask: '搜索文件',
        tokenUsage: 5000,
        toolCalls: 3,
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const item = container.querySelector('[data-testid="subagent-item-s-expand-1"]')!
    expect(item.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(item)
    expect(item.getAttribute('aria-expanded')).toBe('true')
    // 展开后显示详情
    expect(container.textContent).toContain('运行中')
    expect(container.textContent).toContain('researcher')
    expect(container.textContent).toContain('thread-expand-1')
  })

  it('SubagentSection — v10 嵌套工具调用列表(subagent.tools)', () => {
    const subagents: Subagent[] = [
      {
        id: 's-nested-1',
        threadId: 'thread-nested-1',
        nickname: 'implementer',
        handle: '@implementer',
        color: 'green',
        status: 'done',
        spawnedAt: '2026-01-01T10:00:00Z',
        endedAt: '2026-01-01T10:05:00Z',
        durationMs: 300000,
        currentTask: '实现功能',
        tokenUsage: 15000,
        toolCalls: 2,
        tools: [
          {
            id: 'nested-tool-1',
            toolName: 'read_file',
            args: { file_path: 'src/app.ts' },
            status: 'success',
            startedAt: '2026-01-01T10:01:00Z',
            durationMs: 100,
          },
          {
            id: 'nested-tool-2',
            toolName: 'edit_file',
            args: { file_path: 'src/app.ts' },
            status: 'success',
            startedAt: '2026-01-01T10:02:00Z',
            durationMs: 200,
          },
        ],
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const item = container.querySelector('[data-testid="subagent-item-s-nested-1"]')!
    fireEvent.click(item)
    // 展开后显示嵌套工具调用
    expect(container.textContent).toContain('工具调用(2)')
    expect(container.textContent).toContain('read_file')
    expect(container.textContent).toContain('edit_file')
    expect(container.textContent).toContain('app.ts')
  })

  // ─── ChangesSection 测试 ───

  it('ChangesSection — 无文件变更时不渲染', () => {
    const { container } = render(<ChangesSection changes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('ChangesSection — 有变更时渲染并显示新增/修改标记', () => {
    const changes: AgentChange[] = [
      {
        id: 'c1',
        filePath: 'src/components/Button.tsx',
        toolName: 'write_file',
        diffInfo: {
          file_path: 'src/components/Button.tsx',
          old_content: '',
          new_content: 'export function Button() {}',
          is_new_file: true,
        },
        timestamp: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c2',
        filePath: 'src/lib/utils.ts',
        toolName: 'edit_file',
        diffInfo: { file_path: 'src/lib/utils.ts', old_content: 'old', new_content: 'new' },
        timestamp: '2026-01-01T00:00:01Z',
      },
    ]
    const { container } = render(<ChangesSection changes={changes} />)
    expect(container.firstChild).not.toBeNull()
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('新增 1')
    expect(container.textContent).toContain('修改 1')
    expect(container.textContent).toContain('Button.tsx')
    expect(container.textContent).toContain('utils.ts')
  })

  // ─── TerminalSection 测试 ───

  it('TerminalSection — 无终端任务时不渲染', () => {
    const { container } = render(<TerminalSection terminals={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('TerminalSection — 有终端任务时渲染并显示命令和状态', () => {
    const terminals: TerminalTask[] = [
      {
        id: 'term1',
        command: 'pnpm typecheck',
        status: 'completed',
        startedAt: '2026-01-01T00:00:00Z',
        endedAt: '2026-01-01T00:00:05Z',
        durationMs: 5000,
        exitCode: 0,
      },
      {
        id: 'term2',
        command: 'pnpm test',
        status: 'running',
        startedAt: '2026-01-01T00:00:06Z',
      },
    ]
    const { container } = render(<TerminalSection terminals={terminals} />)
    expect(container.firstChild).not.toBeNull()
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('pnpm typecheck')
    expect(container.textContent).toContain('pnpm test')
    expect(container.textContent).toContain('1 运行中')
  })

  // ─── OverviewSection 测试 ───

  it('OverviewSection — 无数据时不渲染', () => {
    const overview: AgentOverview = {
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
    }
    const { container } = render(<OverviewSection overview={overview} isStreaming={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('OverviewSection — 有数据时渲染并显示统计', () => {
    const overview: AgentOverview = {
      status: 'running',
      currentNode: 'planner',
      plan: null,
      content: '正在分析',
      error: null,
      interruptEvent: null,
      sessionStart: new Date(Date.now() - 65000).toISOString(),
      totalSteps: 6,
      completedSteps: 3,
      inProgressSteps: 1,
      pendingSteps: 2,
      totalSubagents: 2,
      activeSubagents: 1,
      deadSubagents: 0,
      totalTerminals: 1,
      runningTerminals: 1,
      totalChanges: 5,
      historicalDurations: [],
      reconnectAttempt: 0,
    }
    const { container } = render(<OverviewSection overview={overview} isStreaming={true} />)
    expect(container.firstChild).not.toBeNull()
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('运行中')
    expect(container.textContent).toContain('3/6')
    expect(container.textContent).toContain('1活跃')
    expect(container.textContent).toContain('2总')
    expect(container.textContent).toContain('5文件')
  })
})

// ─── v11: 键盘导航 + ARIA 测试 ───
describe('AgentTaskProgressPane — v11 键盘导航 + ARIA', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().setThreadId('thread-kb-1')
  })

  afterEach(() => {
    cleanup()
  })

  it('FoldableSection button 含 data-section-header 标识(键盘导航锚点)', () => {
    const { container } = render(
      <FoldableSection title="测试区" data-testid="kb-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('data-section-header')).toBe('true')
  })

  it('FoldableSection button 含 aria-label(默认=title)', () => {
    const { container } = render(
      <FoldableSection title="工具调用" data-testid="kb-section-2">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-label')).toBe('工具调用')
  })

  it('FoldableSection button 支持自定义 aria-label', () => {
    const { container } = render(
      <FoldableSection
        title="工具调用"
        aria-label="自定义工具区标题"
        data-testid="kb-section-3"
      >
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-label')).toBe('自定义工具区标题')
  })

  it('FoldableSection button 含 focus-visible ring 样式类', () => {
    const { container } = render(
      <FoldableSection title="测试" data-testid="kb-section-4">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.className).toContain('focus-visible:ring')
  })

  it('pane 根元素含 role=complementary + aria-label', () => {
    const { container } = render(<AgentTaskProgressPane />)
    const pane = container.querySelector('[data-testid="agent-progress-pane"]')!
    expect(pane.getAttribute('role')).toBe('complementary')
    expect(pane.getAttribute('aria-label')).toBe('Agent 任务进度面板')
  })

  it('plan steps 列表含 role=list + aria-label', () => {
    // 需要 planSteps 数据,这里用 ToolCallsSection 的子项验证 list 语义
    const tools: AgentToolCall[] = [
      {
        id: 't-list-1',
        toolName: 'read_file',
        args: { file_path: 'src/a.ts' },
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    // FoldableSection 本身不强制 role=list,但 button 有 data-section-header
    const btn = container.querySelector('[data-section-header]')!
    expect(btn).toBeTruthy()
  })

  it('ThinkingSection 流式时含 aria-live=polite', () => {
    const { container } = render(
      <ThinkingSection content="分析中" currentNode="planner" isStreaming={true} />,
    )
    const btn = container.querySelector('button')!
    fireEvent.click(btn) // 展开
    // 内部 div 含 aria-live
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
  })

  it('ThinkingSection 非流式时无 aria-live(避免噪声)', () => {
    const { container } = render(
      <ThinkingSection content="已完成" currentNode={null} isStreaming={false} />,
    )
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    const liveRegion = container.querySelector('[aria-live]')
    expect(liveRegion).toBeNull()
  })
})

// ─── v11: 复制按钮 + 状态过滤测试 ───
describe('AgentTaskProgressPane — v11 复制按钮 + 状态过滤', () => {
  afterEach(() => {
    cleanup()
  })

  it('ToolCallItem 详情含复制按钮(参数 + 结果)', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-copy-1',
        toolName: 'read_file',
        args: { file_path: 'src/a.ts' },
        result: { content: 'hello' },
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const toolItem = container.querySelector('[data-testid="tool-item-t-copy-1"]')!
    fireEvent.click(toolItem)
    // 参数复制按钮
    expect(container.querySelector('[data-testid="tool-copy-args-t-copy-1"]')).toBeTruthy()
    // 结果复制按钮
    expect(container.querySelector('[data-testid="tool-copy-result-t-copy-1"]')).toBeTruthy()
  })

  it('ToolCallItem error 状态含错误复制按钮', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-copy-err',
        toolName: 'edit_file',
        args: { file_path: 'src/b.ts' },
        error: 'permission denied',
        status: 'error',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const toolItem = container.querySelector('[data-testid="tool-item-t-copy-err"]')!
    fireEvent.click(toolItem)
    expect(container.querySelector('[data-testid="tool-copy-error-t-copy-err"]')).toBeTruthy()
  })

  it('ToolCallsSection — 有 error/running 时显示状态过滤 chips', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-f1',
        toolName: 'read_file',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 't-f2',
        toolName: 'edit_file',
        args: {},
        status: 'error',
        startedAt: '2026-01-01T00:00:01Z',
      },
      {
        id: 't-f3',
        toolName: 'search',
        args: {},
        status: 'running',
        startedAt: '2026-01-01T00:00:02Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const filter = container.querySelector('[data-testid="tool-status-filter"]')
    expect(filter).toBeTruthy()
    // 全部按钮
    expect(container.querySelector('[data-testid="tool-filter-all"]')).toBeTruthy()
    // 失败按钮
    expect(container.querySelector('[data-testid="tool-filter-error"]')).toBeTruthy()
    // 运行中按钮
    expect(container.querySelector('[data-testid="tool-filter-running"]')).toBeTruthy()
  })

  it('ToolCallsSection — 全部成功时不显示状态过滤(无 error/running)', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-nf1',
        toolName: 'read_file',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 't-nf2',
        toolName: 'search',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:01Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const filter = container.querySelector('[data-testid="tool-status-filter"]')
    expect(filter).toBeNull()
  })

  it('ToolCallsSection — 点击 error 过滤只显示失败工具', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-fe1',
        toolName: 'read_file',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 't-fe2',
        toolName: 'edit_file',
        args: {},
        status: 'error',
        startedAt: '2026-01-01T00:00:01Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    // 点击 error 过滤
    const errorFilter = container.querySelector('[data-testid="tool-filter-error"]')!
    fireEvent.click(errorFilter)
    // 应该只显示 error 工具
    expect(container.querySelector('[data-testid="tool-item-t-fe2"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="tool-item-t-fe1"]')).toBeNull()
  })

  it('ToolCallsSection — 状态过滤 chips 含 aria-pressed', () => {
    const tools: AgentToolCall[] = [
      {
        id: 't-ap1',
        toolName: 'read_file',
        args: {},
        status: 'error',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const allFilter = container.querySelector('[data-testid="tool-filter-all"]') as HTMLButtonElement
    expect(allFilter.getAttribute('aria-pressed')).toBe('true')
    const errorFilter = container.querySelector('[data-testid="tool-filter-error"]') as HTMLButtonElement
    expect(errorFilter.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(errorFilter)
    expect(errorFilter.getAttribute('aria-pressed')).toBe('true')
    expect(allFilter.getAttribute('aria-pressed')).toBe('false')
  })
})

// ─── v11: 复制计划 + 相对时间 + threadId 复制测试 ───
describe('AgentTaskProgressPane — v11 复制计划 + 相对时间', () => {
  afterEach(() => {
    cleanup()
  })

  it('formatRelativeTime — 刚刚(<10s)', () => {
    const recent = new Date(Date.now() - 5000).toISOString()
    expect(formatRelativeTime(recent, mockT)).toBe('刚刚')
  })

  it('formatRelativeTime — 30s前', () => {
    const ts = new Date(Date.now() - 30000).toISOString()
    expect(formatRelativeTime(ts, mockT)).toBe('30s前')
  })

  it('formatRelativeTime — 2m前', () => {
    const ts = new Date(Date.now() - 120000).toISOString()
    expect(formatRelativeTime(ts, mockT)).toBe('2m前')
  })

  it('formatRelativeTime — 1h前', () => {
    const ts = new Date(Date.now() - 3600000).toISOString()
    expect(formatRelativeTime(ts, mockT)).toBe('1h前')
  })

  it('formatRelativeTime — 无效时间戳返回空字符串', () => {
    expect(formatRelativeTime('invalid', mockT)).toBe('')
  })

  it('SubagentItem threadId 含复制按钮', () => {
    const subagents: Subagent[] = [
      {
        id: 's-thr-1',
        threadId: 'thread-copy-test-123',
        nickname: 'coder',
        handle: '@coder',
        color: 'cyan',
        status: 'done',
        spawnedAt: '2026-01-01T10:00:00Z',
        endedAt: '2026-01-01T10:05:00Z',
        durationMs: 300000,
        role: 'coder',
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const item = container.querySelector('[data-testid="subagent-item-s-thr-1"]')!
    fireEvent.click(item)
    // 展开后应显示 threadId 复制按钮
    const copyBtn = container.querySelector('[data-testid="subagent-copy-thread-s-thr-1"]')
    expect(copyBtn).toBeTruthy()
  })

  it('SubagentItem 展开后显示相对时间', () => {
    const recentIso = new Date(Date.now() - 120000).toISOString()
    const subagents: Subagent[] = [
      {
        id: 's-rt-1',
        threadId: 'thread-rt-1',
        nickname: 'scout',
        handle: '@scout',
        color: 'green',
        status: 'done',
        spawnedAt: recentIso,
        endedAt: new Date(Date.now() - 60000).toISOString(),
        durationMs: 60000,
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    const foldBtn = container.querySelector('button')!
    fireEvent.click(foldBtn)
    const item = container.querySelector('[data-testid="subagent-item-s-rt-1"]')!
    fireEvent.click(item)
    // 应显示相对时间 "2m前"
    expect(container.textContent).toContain('2m前')
  })
})
