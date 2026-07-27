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

describe('AgentProgressPane Store — v4 Codex 流式简化', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / verbose=false / autoScroll=true / paneHeight=240', () => {
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.verbose).toBe(false)
    expect(s.autoScroll).toBe(true)
    expect(s.paneHeight).toBe(240)
    expect(s.expandedIds.size).toBe(0)
  })

  it('openPane(threadId) — 打开并设置 threadId', () => {
    useAgentProgressPaneStore.getState().openPane('thread-xyz')
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-xyz')
    expect(s.threadIdInput).toBe('thread-xyz')
  })

  it('closePane — 关闭但保留 threadId', () => {
    useAgentProgressPaneStore.getState().openPane('thread-abc')
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

  it('setThreadIdInput + submitThreadId — 提交 threadId', () => {
    useAgentProgressPaneStore.getState().setThreadIdInput('  thread-input-123  ')
    useAgentProgressPaneStore.getState().submitThreadId()
    expect(useAgentProgressPaneStore.getState().threadId).toBe('thread-input-123')
  })

  it('submitThreadId 空输入 — 不设置', () => {
    useAgentProgressPaneStore.getState().setThreadIdInput('   ')
    useAgentProgressPaneStore.getState().submitThreadId()
    expect(useAgentProgressPaneStore.getState().threadId).toBeNull()
  })

  it('toggleVerbose — 切换 verbose', () => {
    expect(useAgentProgressPaneStore.getState().verbose).toBe(false)
    useAgentProgressPaneStore.getState().toggleVerbose()
    expect(useAgentProgressPaneStore.getState().verbose).toBe(true)
  })

  it('setAutoScroll — 设置自动滚动', () => {
    expect(useAgentProgressPaneStore.getState().autoScroll).toBe(true)
    useAgentProgressPaneStore.getState().setAutoScroll(false)
    expect(useAgentProgressPaneStore.getState().autoScroll).toBe(false)
  })

  it('toggleExpanded + isExpanded — 展开/折叠事件详情', () => {
    expect(useAgentProgressPaneStore.getState().isExpanded('evt-1')).toBe(false)
    useAgentProgressPaneStore.getState().toggleExpanded('evt-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('evt-1')).toBe(true)
    useAgentProgressPaneStore.getState().toggleExpanded('evt-1')
    expect(useAgentProgressPaneStore.getState().isExpanded('evt-1')).toBe(false)
  })

  it('setPaneHeight — clamp 到 [160, 600]', () => {
    useAgentProgressPaneStore.getState().setPaneHeight(50)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(160)
    useAgentProgressPaneStore.getState().setPaneHeight(9999)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(600)
    useAgentProgressPaneStore.getState().setPaneHeight(300)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(300)
  })

  it('reset — 恢复默认状态', () => {
    useAgentProgressPaneStore.getState().openPane('thread-x')
    useAgentProgressPaneStore.getState().toggleVerbose()
    useAgentProgressPaneStore.getState().setAutoScroll(false)
    useAgentProgressPaneStore.getState().setPaneHeight(500)
    useAgentProgressPaneStore.getState().reset()
    const s = useAgentProgressPaneStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.verbose).toBe(false)
    expect(s.autoScroll).toBe(true)
    expect(s.paneHeight).toBe(240)
  })
})

describe('AgentProgressTrigger — v4 简化快捷键', () => {
  beforeEach(() => {
    useAgentProgressPaneStore.getState().reset()
  })

  it('未打开时渲染 ▲ 触发按钮', () => {
    render(<AgentProgressTrigger />)
    expect(screen.getByTestId('agent-progress-trigger')).toBeTruthy()
    expect(screen.getByLabelText('打开 Agent 任务进度')).toBeTruthy()
  })

  it('打开后隐藏触发按钮', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentProgressTrigger />)
    expect(screen.queryByTestId('agent-progress-trigger')).toBeNull()
  })

  it('Ctrl+Shift+J 切换面板', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'j', ctrlKey: true, shiftKey: true, bubbles: true,
      }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('ArrowDown 打开未打开的面板', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', bubbles: true,
      }))
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
        key: 'ArrowDown', bubbles: true,
      })
      Object.defineProperty(evt, 'target', { value: input })
      window.dispatchEvent(evt)
    })
    // 面板未打开(因为焦点在 input,快捷键被忽略)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })
})

describe('AgentTaskProgressPane — v4 流式渲染', () => {
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

  it('打开但无 threadId — 显示输入框 + enter threadId 占位', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(screen.getByTestId('agent-progress-pane')).toBeTruthy()
    expect(screen.getByTestId('thread-id-input')).toBeTruthy()
    expect(screen.getByTestId('thread-id-input').getAttribute('placeholder')).toBe('enter threadId...')
  })

  it('关闭按钮 ✕ 可见且可点击', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    const closeBtn = screen.getByTestId('pane-close')
    expect(closeBtn).toBeTruthy()
    expect(closeBtn.textContent).toBe('✕')
    fireEvent.click(closeBtn)
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('Esc 关闭面板', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('v 切换 verbose', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    expect(useAgentProgressPaneStore.getState().verbose).toBe(false)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }))
    })
    expect(useAgentProgressPaneStore.getState().verbose).toBe(true)
  })

  it('resize handle 双击重置高度', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().setPaneHeight(500)
    render(<AgentTaskProgressPane />)
    const handle = screen.getByTestId('resize-handle')
    fireEvent.doubleClick(handle)
    expect(useAgentProgressPaneStore.getState().paneHeight).toBe(240)
  })

  it('autoScroll 切换按钮存在', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentTaskProgressPane />)
    // 初始 autoScroll=true,按钮显示 ↓
    const autoBtn = screen.getByTitle('切换自动滚动')
    expect(autoBtn.textContent).toBe('↓')
    fireEvent.click(autoBtn)
    expect(useAgentProgressPaneStore.getState().autoScroll).toBe(false)
  })
})
