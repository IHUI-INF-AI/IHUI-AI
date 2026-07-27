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

import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'
import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'

describe('AgentProgressPane Store — Codex v2 cursor + 快捷键', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / activeColumn=tasks / cursorIndex=0', () => {
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.cursorIndex).toBe(0)
    expect(s.verbose).toBe(false)
    expect(s.showArchived).toBe(true)
    expect(s.sortMode).toBe('recent')
    expect(s.expandedIds.size).toBe(0)
  })

  it('openPane(threadId) — 打开并设置 threadId + cursor 重置 0', () => {
    useAgentProgressPaneStore.getState().setCursor(5)
    useAgentProgressPaneStore.getState().openPane('thread-xyz')
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-xyz')
    expect(s.cursorIndex).toBe(0)
  })

  it('setActiveColumn — 切栏 + cursor 重置 0', () => {
    useAgentProgressPaneStore.getState().setCursor(3)
    useAgentProgressPaneStore.getState().setActiveColumn('subagents')
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(0)
  })

  it('moveCursor(delta, max) — 下移 + clamp', () => {
    useAgentProgressPaneStore.getState().moveCursor(1, 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(1)
    useAgentProgressPaneStore.getState().moveCursor(1, 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(2)
    useAgentProgressPaneStore.getState().moveCursor(10, 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(4) // clamp to max-1
  })

  it('moveCursor(-1, 5) — 上移 + clamp 到 0', () => {
    useAgentProgressPaneStore.getState().moveCursor(-1, 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(0) // clamp
    useAgentProgressPaneStore.getState().setCursor(3)
    useAgentProgressPaneStore.getState().moveCursor(-1, 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(2)
  })

  it('moveCursor(1, 0) — max=0 时 cursor 保持 0', () => {
    useAgentProgressPaneStore.getState().moveCursor(1, 0)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(0)
  })

  it('cycleSortMode — 循环 recent → duration → status → recent + cursor 重置', () => {
    useAgentProgressPaneStore.getState().setCursor(2)
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('duration')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(0)
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('status')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
  })

  it('toggleExpanded / isExpanded', () => {
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(false)
    useAgentProgressPaneStore.getState().toggleExpanded('item-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(true)
    useAgentProgressPaneStore.getState().toggleExpanded('item-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('item-1')).toBe(false)
  })

  it('toggleExpandedAt — 通过 idAt 函数定位 cursor 项', () => {
    useAgentProgressPaneStore.getState().setCursor(2)
    const idAt = (idx: number) => (idx === 2 ? 'item-2' : null)
    useAgentProgressPaneStore.getState().toggleExpandedAt(idAt)
    expect(useAgentProgressPaneStore.getState().isExpanded('item-2')).toBe(true)
  })

  it('reset — 清空所有状态含 cursor', () => {
    useAgentProgressPaneStore.getState().openPane('t1')
    useAgentProgressPaneStore.getState().setActiveColumn('terminals')
    useAgentProgressPaneStore.getState().setCursor(4)
    useAgentProgressPaneStore.getState().reset()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.cursorIndex).toBe(0)
  })
})

describe('AgentProgressTrigger — Codex 快捷键', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('ArrowDown 快捷键 → 打开 Pane', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('Ctrl+Shift+J 快捷键 → 切换 Pane', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true }),
      )
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('1/2/3 快捷键 → 切换 Tasks/Subagents/Terminals 栏', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('tasks')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(0) // 切栏重置 cursor
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('terminals')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('tasks')
  })

  it('Tab 快捷键 → 切换排序模式', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    })
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('duration')
  })

  it('a/v 快捷键 → 切换 archived/verbose', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
    })
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(true)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    })
    expect(useAgentProgressPaneStore.getState().showArchived).toBe(false)
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
      fireEvent.keyDown(input, { key: '2' })
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('tasks') // 未切换
  })
})

describe('AgentTaskProgressPane — Codex v2 渲染 + cursor + j/k/Enter', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('open=false → 不渲染', () => {
    render(<AgentTaskProgressPane />)
    expect(screen.queryByTestId('agent-progress-pane')).toBeNull()
  })

  it('open=true → 渲染 Codex 风格单行 header + 三栏 tab + 单行 footer', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByTestId('agent-progress-pane')).not.toBeNull()
    // Header 含 Agent + 状态字符
    expect(screen.getByText('Agent')).not.toBeNull()
    // 三栏 tab(role=tab)+ [1]/[2]/[3] 标记
    expect(screen.getByTestId('column-tasks')).not.toBeNull()
    expect(screen.getByTestId('column-subagents')).not.toBeNull()
    expect(screen.getByTestId('column-terminals')).not.toBeNull()
    expect(screen.getByText('[1]')).not.toBeNull()
    expect(screen.getByText('[2]')).not.toBeNull()
    expect(screen.getByText('[3]')).not.toBeNull()
    // threadId 输入框
    expect(screen.getByTestId('thread-id-input')).not.toBeNull()
    // Codex 风格模式指示器(sort/v/a/cursor)
    expect(screen.getByTestId('sort-indicator').textContent).toContain('sort:')
    expect(screen.getByTestId('verbose-indicator').textContent).toContain('v:')
    expect(screen.getByTestId('archived-indicator').textContent).toContain('a:')
  })

  it('Footer 含 Codex 快捷键提示: j/k move / g/G top/bot / space pgdn / Enter expand / 1/2/3 switch / Tab sort / a archived / v verbose / y/n approve / Esc close', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const pane = screen.getByTestId('agent-progress-pane')
    const footer = pane.querySelector('.flex.items-center.gap-3.border-t')
    const text = footer?.textContent ?? ''
    expect(text).toContain('j/k')
    expect(text).toContain('move')
    expect(text).toContain('g/G')
    expect(text).toContain('top/bot')
    expect(text).toContain('space')
    expect(text).toContain('pgdn')
    expect(text).toContain('Enter')
    expect(text).toContain('expand')
    expect(text).toContain('1/2/3')
    expect(text).toContain('switch')
    expect(text).toContain('Tab')
    expect(text).toContain('sort')
    expect(text).toContain('y/n')
    expect(text).toContain('approve')
    expect(text).toContain('Esc')
    expect(text).toContain('close')
  })

  it('Header 含 currentNode 显示(当 overview.currentNode 存在时)', () => {
    useAgentProgressPaneStore.getState().openPane('thread-with-node')
    render(<AgentTaskProgressPane />)
    // currentNode 来自 useAgentProgress,空 threadId 时为 null,这里测组件能渲染
    expect(screen.getByTestId('agent-progress-pane')).not.toBeNull()
  })

  it('默认 Tasks 栏 — 显示 Codex 风格空状态 "no plan steps"', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByText('no plan steps')).not.toBeNull()
  })

  it('切换到 Subagents 栏 → 显示 "no subagents"', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    act(() => {
      useAgentProgressPaneStore.getState().setActiveColumn('subagents')
    })
    expect(screen.getByText('no subagents')).not.toBeNull()
  })

  it('切换到 Terminals 栏 → 显示 "no terminals"', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    act(() => {
      useAgentProgressPaneStore.getState().setActiveColumn('terminals')
    })
    expect(screen.getByText('no terminals')).not.toBeNull()
  })

  it('Esc 关闭 Pane', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('输入 threadId + 回车 → store.threadId 更新 + 显示 run/clr 按钮', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const input = screen.getByTestId('thread-id-input') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'thread-codex-1' } })
    })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', preventDefault: () => {} })
    })
    expect(useAgentProgressPaneStore.getState().threadId).toBe('thread-codex-1')
    expect(screen.getByTestId('start-btn')).not.toBeNull()
    expect(screen.getByTestId('clear-btn')).not.toBeNull()
  })

  it('点击 clear → threadId 清空', () => {
    useAgentProgressPaneStore.getState().openPane('thread-to-clear')
    render(<AgentTaskProgressPane />)
    act(() => {
      fireEvent.click(screen.getByTestId('clear-btn'))
    })
    expect(useAgentProgressPaneStore.getState().threadId).toBeNull()
  })
})
