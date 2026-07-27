// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Mock next-intl(部分子组件可能引用)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock @ihui/api-client(ToolCallCard 等子组件引用 useWorkPanelStore)
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
}))

import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'
import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'

describe('AgentProgressPane Store', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / activeColumn=tasks / verbose=false', () => {
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.threadIdInput).toBe('')
    expect(s.verbose).toBe(false)
    expect(s.showArchived).toBe(true)
    expect(s.sortMode).toBe('recent')
    expect(s.expandedIds.size).toBe(0)
  })

  it('openPane() — 默认打开,保留已有 threadId', () => {
    useAgentProgressPaneStore.getState().setThreadId('thread-abc')
    useAgentProgressPaneStore.getState().openPane()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-abc')
  })

  it('openPane(threadId) — 打开并设置 threadId', () => {
    useAgentProgressPaneStore.getState().openPane('thread-xyz')
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-xyz')
    expect(s.threadIdInput).toBe('thread-xyz')
  })

  it('toggle() — 切换 open 状态', () => {
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
    useAgentProgressPaneStore.getState().toggle()
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    useAgentProgressPaneStore.getState().toggle()
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('setActiveColumn() — 切换栏(Tasks/Subagents/Terminals)', () => {
    useAgentProgressPaneStore.getState().setActiveColumn('subagents')
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    useAgentProgressPaneStore.getState().setActiveColumn('terminals')
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('terminals')
  })

  it('submitThreadId() — 空输入 no-op', () => {
    useAgentProgressPaneStore.getState().submitThreadId()
    expect(useAgentProgressPaneStore.getState().threadId).toBeNull()
  })

  it('submitThreadId() — 提交输入值(trim)', () => {
    useAgentProgressPaneStore.getState().setThreadIdInput('  thread-input  ')
    useAgentProgressPaneStore.getState().submitThreadId()
    expect(useAgentProgressPaneStore.getState().threadId).toBe('thread-input')
  })

  it('toggleVerbose() — 切换 verbose', () => {
    expect(useAgentProgressPaneStore.getState().verbose).toBe(false)
    useAgentProgressPaneStore.getState().toggleVerbose()
    expect(useAgentProgressPaneStore.getState().verbose).toBe(true)
  })

  it('toggleShowArchived() — 切换 showArchived', () => {
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(true)
    useAgentProgressPaneStore.getState().toggleShowArchived()
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(false)
  })

  it('cycleSortMode() — 循环切换 recent → duration → status → recent', () => {
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('duration')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('status')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
  })

  it('toggleExpanded() — 切换条目展开状态', () => {
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(false)
    useAgentProgressPaneStore.getState().toggleExpanded('item-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(true)
    useAgentProgressPaneStore.getState().toggleExpanded('item-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(false)
  })

  it('reset() — 清空所有状态', () => {
    useAgentProgressPaneStore.getState().openPane('thread-1')
    useAgentProgressPaneStore.getState().setActiveColumn('subagents')
    useAgentProgressPaneStore.getState().toggleVerbose()
    useAgentProgressPaneStore.getState().toggleExpanded('item-1')
    useAgentProgressPaneStore.getState().reset()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.threadIdInput).toBe('')
    expect(s.verbose).toBe(false)
    expect(s.showArchived).toBe(true)
    expect(s.sortMode).toBe('recent')
    expect(s.expandedIds.size).toBe(0)
  })
})

describe('AgentProgressTrigger', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('渲染 — 浮动按钮存在,aria-label 默认为"打开"', () => {
    render(<AgentProgressTrigger />)
    const btn = screen.getByTestId('agent-progress-trigger')
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('aria-label')).toBe('打开 Agent 任务进度')
  })

  it('点击按钮 → Pane 打开,aria-label 变为"关闭"', () => {
    render(<AgentProgressTrigger />)
    const btn = screen.getByTestId('agent-progress-trigger')
    act(() => {
      fireEvent.click(btn)
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    expect(btn.getAttribute('aria-label')).toBe('关闭 Agent 任务进度')
  })

  it('Ctrl+Shift+J 快捷键 → 切换 Pane', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true }),
      )
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true }),
      )
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('ArrowDown 快捷键 → 打开 Pane(Codex 标准快捷键)', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('Pane 已打开时 Tab 快捷键 → 切换排序模式', () => {
    render(<AgentProgressTrigger />)
    // 先打开
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    })
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('duration')
  })

  it('Pane 已打开时 a 快捷键 → 切换 showArchived', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(true)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    })
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(false)
  })

  it('Pane 已打开时 v 快捷键 → 切换 verbose', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().verbose).toBe(false)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
    })
    expect(useAgentProgressPaneStore.getState().verbose).toBe(true)
  })

  it('焦点在 input 时不响应快捷键', () => {
    render(
      <>
        <AgentProgressTrigger />
        <input data-testid="test-input" />
      </>,
    )
    const input = screen.getByTestId('test-input')
    input.focus()
    act(() => {
      fireEvent.keyDown(input, { key: 'j', ctrlKey: true, shiftKey: true })
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })
})

describe('AgentTaskProgressPane', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('open=false → 不渲染 Pane 内容', () => {
    render(<AgentTaskProgressPane />)
    expect(screen.queryByTestId('agent-progress-pane')).toBeNull()
  })

  it('open=true → 渲染底部面板 + 三栏 tab + threadId 输入框', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByTestId('agent-progress-pane')).not.toBeNull()
    expect(screen.getByText('Agent 任务进度')).not.toBeNull()
    expect(screen.getByTestId('thread-id-input')).not.toBeNull()
    // 三栏 tab(role=tab)
    expect(screen.getByRole('tab', { name: /Tasks/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /Subagents/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /Terminals/ })).not.toBeNull()
  })

  it('role=region + role=tablist 存在(Codex 架构对齐)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByRole('region', { name: /Agent 任务进度底部面板/ })).not.toBeNull()
    expect(screen.getByRole('tablist', { name: /Agent 进度栏/ })).not.toBeNull()
  })

  it('空状态 — Tasks 栏显示提示文字', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByText('暂无计划步骤')).not.toBeNull()
  })

  it('输入 threadId + 回车 → store.threadId 更新 + 显示控制按钮', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const input = screen.getByTestId('thread-id-input') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'thread-test-123' } })
    })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', preventDefault: () => {} })
    })
    expect(useAgentProgressPaneStore.getState().threadId).toBe('thread-test-123')
    // 控制按钮出现(启动 + 清空)
    expect(screen.getByTestId('start-btn')).not.toBeNull()
    expect(screen.getByTestId('clear-btn')).not.toBeNull()
  })

  it('点击"查看"按钮 → 等同于回车提交', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const input = screen.getByTestId('thread-id-input') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'thread-via-button' } })
    })
    act(() => {
      fireEvent.click(screen.getByText('查看'))
    })
    expect(useAgentProgressPaneStore.getState().threadId).toBe('thread-via-button')
  })

  it('栏切换 — 点击 Subagents 栏 → activeColumn=subagents', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const subagentsTab = screen.getByTestId('column-subagents')
    act(() => {
      fireEvent.click(subagentsTab)
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    // 显示 Subagents 空状态
    expect(screen.getByText('暂无子代理')).not.toBeNull()
  })

  it('栏切换 — 点击 Terminals 栏 → activeColumn=terminals', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const terminalsTab = screen.getByTestId('column-terminals')
    act(() => {
      fireEvent.click(terminalsTab)
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('terminals')
    expect(screen.getByText('暂无终端任务')).not.toBeNull()
  })

  it('点击清空 → threadId 清空 + 输入框清空', () => {
    useAgentProgressPaneStore.getState().openPane('thread-to-clear')
    render(<AgentTaskProgressPane />)
    act(() => {
      fireEvent.click(screen.getByTestId('clear-btn'))
    })
    expect(useAgentProgressPaneStore.getState().threadId).toBeNull()
    expect(useAgentProgressPaneStore.getState().threadIdInput).toBe('')
  })

  it('Esc 键关闭 Pane', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('模式指示器存在(sort/verbose/archived)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByTestId('sort-indicator')).not.toBeNull()
    expect(screen.getByTestId('verbose-indicator')).not.toBeNull()
    expect(screen.getByTestId('archived-indicator')).not.toBeNull()
  })

  it('verbose 切换 → 指示器文本变化', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const verboseIndicator = screen.getByTestId('verbose-indicator')
    expect(verboseIndicator.textContent).toContain('off')
    act(() => {
      useAgentProgressPaneStore.getState().toggleVerbose()
    })
    expect(verboseIndicator.textContent).toContain('on')
  })

  it('showArchived 切换 → 指示器文本变化', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const archivedIndicator = screen.getByTestId('archived-indicator')
    expect(archivedIndicator.textContent).toContain('on')
    act(() => {
      useAgentProgressPaneStore.getState().toggleShowArchived()
    })
    expect(archivedIndicator.textContent).toContain('off')
  })

  it('sortMode 切换 → 指示器文本变化', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const sortIndicator = screen.getByTestId('sort-indicator')
    expect(sortIndicator.textContent).toContain('最近')
    act(() => {
      useAgentProgressPaneStore.getState().cycleSortMode()
    })
    expect(sortIndicator.textContent).toContain('耗时')
    act(() => {
      useAgentProgressPaneStore.getState().cycleSortMode()
    })
    expect(sortIndicator.textContent).toContain('状态')
  })

  it('Footer 快捷键提示存在(↓/Tab/a/v/Ctrl+Shift+J)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    // 检查 kbd 元素存在
    const kbds = document.querySelectorAll('kbd')
    expect(kbds.length).toBeGreaterThanOrEqual(5)
  })
})
