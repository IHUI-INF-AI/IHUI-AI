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

describe('AgentProgressPane Store — Codex v3 cursor 智能保持 + search + help + height', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / activeColumn=tasks / cursorIndex=0 / searchMode=false / showHelp=false / paneHeight=360', () => {
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.cursorIndex).toBe(0)
    expect(s.verbose).toBe(false)
    expect(s.showArchived).toBe(true)
    expect(s.sortMode).toBe('recent')
    expect(s.expandedIds.size).toBe(0)
    expect(s.searchMode).toBe(false)
    expect(s.searchQuery).toBe('')
    expect(s.showHelp).toBe(false)
    expect(s.paneHeight).toBe(360)
  })

  it('openPane(threadId) — 打开并设置 threadId + cursor 重置 0', () => {
    useAgentProgressPaneStore.getState().setCursor(5)
    useAgentProgressPaneStore.getState().openPane('thread-xyz')
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-xyz')
    expect(s.cursorIndex).toBe(0)
  })

  it('setActiveColumn 不传 newColumnCount — 保持原 cursor(Codex 智能保持)', () => {
    useAgentProgressPaneStore.getState().setCursor(3)
    useAgentProgressPaneStore.getState().setActiveColumn('subagents')
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(3) // 保持
  })

  it('setActiveColumn 传 newColumnCount=5 且原 cursor=3 — clamp 到 3(在范围内)', () => {
    useAgentProgressPaneStore.getState().setCursor(3)
    useAgentProgressPaneStore.getState().setActiveColumn('subagents', 5)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(3)
  })

  it('setActiveColumn 传 newColumnCount=2 且原 cursor=5 — clamp 到 1(新栏 max-1)', () => {
    useAgentProgressPaneStore.getState().setCursor(5)
    useAgentProgressPaneStore.getState().setActiveColumn('subagents', 2)
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(1)
  })

  it('setActiveColumn 传 newColumnCount=0 — cursor 重置 0(空栏)', () => {
    useAgentProgressPaneStore.getState().setCursor(5)
    useAgentProgressPaneStore.getState().setActiveColumn('subagents', 0)
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

  it('cycleSortMode — 循环 recent → duration → status → recent(不重置 cursor)', () => {
    useAgentProgressPaneStore.getState().setCursor(2)
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('recent')
    useAgentProgressPaneStore.getState().cycleSortMode()
    expect(useAgentProgressPaneStore.getState().sortMode).toBe('duration')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(2) // 保持
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

  it('enterSearch / exitSearch / setSearchQuery — 搜索模式生命周期', () => {
    expect(useAgentProgressPaneStore.getState().searchMode).toBe(false)
    useAgentProgressPaneStore.getState().enterSearch()
    expect(useAgentProgressPaneStore.getState().searchMode).toBe(true)
    expect(useAgentProgressPaneStore.getState().searchQuery).toBe('')
    useAgentProgressPaneStore.getState().setSearchQuery('validator')
    expect(useAgentProgressPaneStore.getState().searchQuery).toBe('validator')
    useAgentProgressPaneStore.getState().exitSearch()
    expect(useAgentProgressPaneStore.getState().searchMode).toBe(false)
    expect(useAgentProgressPaneStore.getState().searchQuery).toBe('')
  })

  it('toggleHelp — 切换帮助面板', () => {
    expect(useAgentProgressPaneStore.getState().showHelp).toBe(false)
    useAgentProgressPaneStore.getState().toggleHelp()
    expect(useAgentProgressPaneStore.getState().showHelp).toBe(true)
    useAgentProgressPaneStore.getState().toggleHelp()
    expect(useAgentProgressPaneStore.getState().showHelp).toBe(false)
  })

  it('setPaneHeight — clamp 到 [200, 720]', () => {
    useAgentProgressPaneStore.getState().setPaneHeight(100)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(200) // min
    useAgentProgressPaneStore.getState().setPaneHeight(1000)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(720) // max
    useAgentProgressPaneStore.getState().setPaneHeight(450)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(450)
  })

  it('closePane — 关闭并清空 search/help 状态', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().enterSearch()
    useAgentProgressPaneStore.getState().setSearchQuery('test')
    useAgentProgressPaneStore.getState().toggleHelp()
    useAgentProgressPaneStore.getState().closePane()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.searchMode).toBe(false)
    expect(s.searchQuery).toBe('')
    expect(s.showHelp).toBe(false)
  })

  it('reset — 清空所有状态含 cursor/search/help/height', () => {
    useAgentProgressPaneStore.getState().openPane('t1')
    useAgentProgressPaneStore.getState().setActiveColumn('terminals')
    useAgentProgressPaneStore.getState().setCursor(4)
    useAgentProgressPaneStore.getState().enterSearch()
    useAgentProgressPaneStore.getState().toggleHelp()
    useAgentProgressPaneStore.getState().setPaneHeight(500)
    useAgentProgressPaneStore.getState().reset()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeColumn).toBe('tasks')
    expect(s.cursorIndex).toBe(0)
    expect(s.searchMode).toBe(false)
    expect(s.showHelp).toBe(false)
    expect(s.paneHeight).toBe(360)
  })
})

describe('AgentProgressTrigger — Codex v3 快捷键 + 打开时隐藏', () => {
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

  it('1/2/3 快捷键 → 切换 Tasks/Subagents/Terminals 栏(保持 cursor)', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      useAgentProgressPaneStore.getState().openPane()
      useAgentProgressPaneStore.getState().setCursor(2)
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('tasks')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    })
    expect(useAgentProgressPaneStore.getState().activeColumn).toBe('subagents')
    expect(useAgentProgressPaneStore.getState().cursorIndex).toBe(2) // 智能保持
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

  it('Pane 打开时 trigger 隐藏(Codex 视觉对齐)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentProgressTrigger />)
    // trigger 在 pane 打开时不渲染
    const trigger = document.querySelector('[data-testid="agent-progress-trigger"]')
    expect(trigger).toBeNull()
  })

  it('Pane 关闭时 trigger 显示 + 使用文本字符 ▲', () => {
    render(<AgentProgressTrigger />)
    const trigger = document.querySelector('[data-testid="agent-progress-trigger"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.textContent).toContain('▲')
  })
})

describe('AgentTaskProgressPane — Codex v3 渲染 + cursor + j/k/Enter + search + help', () => {
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

  it('open=true → 渲染 Codex 风格 header + 进度/计时/cursor 指示器 + 三栏 tab + footer', () => {
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
    // Codex v3 新增指示器
    expect(screen.getByTestId('sort-indicator').textContent).toContain('sort:')
    expect(screen.getByTestId('verbose-indicator').textContent).toContain('v:')
    expect(screen.getByTestId('archived-indicator').textContent).toContain('a:')
    expect(screen.getByTestId('cursor-indicator').textContent).toContain('/')
    // Resize 手柄
    expect(screen.getByTestId('resize-handle')).not.toBeNull()
  })

  it('Footer 含 Codex v3 快捷键提示:含 / search + ? help + q quit', () => {
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
    expect(text).toContain('/')
    expect(text).toContain('search')
    expect(text).toContain('?')
    expect(text).toContain('help')
    expect(text).toContain('q')
    expect(text).toContain('quit')
    expect(text).toContain('Esc')
    expect(text).toContain('close')
  })

  it('Header 含 currentNode 显示(当 overview.currentNode 存在时)', () => {
    useAgentProgressPaneStore.getState().openPane('thread-with-node')
    render(<AgentTaskProgressPane />)
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

  it('q 快捷键关闭 Pane(Codex 标准)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('/ 快捷键进入搜索模式 → 渲染 search-input', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.queryByTestId('search-input')).toBeNull()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    })
    expect(useAgentProgressPaneStore.getState().searchMode).toBe(true)
    expect(screen.getByTestId('search-input')).not.toBeNull()
  })

  it('? 快捷键切换帮助面板 → 渲染 help-panel', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.queryByTestId('help-panel')).toBeNull()
    act(() => {
      // ? 的 key 是 '?'(shift+/)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
    })
    expect(useAgentProgressPaneStore.getState().showHelp).toBe(true)
    expect(screen.getByTestId('help-panel')).not.toBeNull()
    // 帮助面板含 "Codex Shortcuts" 标题
    expect(screen.getByText('Codex Shortcuts')).not.toBeNull()
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

  it('Pane 高度通过 style 应用(默认 360px)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const pane = screen.getByTestId('agent-progress-pane') as HTMLElement
    expect(pane.style.height).toBe('360px')
  })

  it('setPaneHeight → pane 高度更新', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    act(() => {
      useAgentProgressPaneStore.getState().setPaneHeight(500)
    })
    const pane = screen.getByTestId('agent-progress-pane') as HTMLElement
    expect(pane.style.height).toBe('500px')
  })
})
