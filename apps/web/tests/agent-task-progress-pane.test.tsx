// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock @ihui/api-client
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
}))

// Mock lucide-react 图标为简单 span(避免 jsdom 渲染 svg 复杂性)
vi.mock('lucide-react', () => ({
  Pin: () => <span data-testid="pin-icon">pin</span>,
  PinOff: () => <span data-testid="pinoff-icon">pinoff</span>,
  Minimize2: () => <span data-testid="minimize-icon">minimize</span>,
}))

// Mock useChatStore.conversationId(避免引入整个 chat store)
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: { conversationId: string | null }) => unknown) =>
    selector({ conversationId: null }),
}))

import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'
import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'
import { FoldableSection } from '../src/components/ai/progress-sections/foldable-section'
import { ThinkingSection } from '../src/components/ai/progress-sections/thinking-section'
import { ToolCallsSection } from '../src/components/ai/progress-sections/tool-calls-section'
import { SubagentSection } from '../src/components/ai/progress-sections/subagent-section'
import { ChangesSection } from '../src/components/ai/progress-sections/changes-section'
import { TerminalSection } from '../src/components/ai/progress-sections/terminal-section'
import { OverviewSection } from '../src/components/ai/progress-sections/overview-section'
import type { AgentToolCall, Subagent, AgentChange, TerminalTask, AgentOverview } from '../src/hooks/use-agent-progress'

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
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:00Z',
        durationMs: 1000,
      },
      {
        id: 't2',
        toolName: 'search',
        args: {},
        status: 'success',
        startedAt: '2026-01-01T00:00:01Z',
        durationMs: 2000,
      },
      {
        id: 't3',
        toolName: 'edit_file',
        args: {},
        status: 'running',
        startedAt: '2026-01-01T00:00:02Z',
      },
    ]
    const { container } = render(<ToolCallsSection tools={tools} />)
    expect(container.firstChild).not.toBeNull()
    // 展开后检查摘要
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('读取 1 文件')
    expect(container.textContent).toContain('搜索 1 次')
    expect(container.textContent).toContain('编辑 1 文件')
  })

  it('SubagentSection — 无子代理时不渲染', () => {
    const { container } = render(<SubagentSection subagents={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('SubagentSection — 有子代理时渲染并显示 @handle', () => {
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
      },
    ]
    const { container } = render(<SubagentSection subagents={subagents} />)
    expect(container.firstChild).not.toBeNull()
    // 展开后检查内容
    const btn = container.querySelector('button')
    fireEvent.click(btn!)
    expect(container.textContent).toContain('@validator')
    expect(container.textContent).toContain('验证类型')
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
        diffInfo: { file_path: 'src/components/Button.tsx', old_content: '', new_content: 'export function Button() {}', is_new_file: true },
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
    expect(container.textContent).toContain('1活跃/2总')
    expect(container.textContent).toContain('5文件')
  })
})
