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
    expect(s.progressCurrent).toBe(0)
    expect(s.progressTotal).toBe(0)
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

  it('setProgress — 设置当前进度', () => {
    useAgentProgressPaneStore.getState().setProgress(3, 8)
    expect(useAgentProgressPaneStore.getState().progressCurrent).toBe(3)
    expect(useAgentProgressPaneStore.getState().progressTotal).toBe(8)
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

  it('面板打开时 trigger 高亮(bg-accent)', () => {
    useAgentProgressPaneStore.getState().openPane()
    render(<AgentProgressTrigger />)
    const trigger = screen.getByTestId('agent-progress-trigger')
    expect(trigger.className).toContain('bg-accent')
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
    expect(screen.getByTestId('thread-id-input').getAttribute('placeholder')).toBe(
      'enter threadId...',
    )
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

  // v6 重构后已移除 verbose 切换 / resize handle / autoScroll 按钮(popover 化简化)
  // - 'v 切换 verbose' 删除(verbose 仅 v4 流式日志用,v6 popover 不需要)
  // - 'resize handle 双击重置高度' 删除(popover 固定 max-h,无 drag resize)
  // - 'autoScroll 切换按钮存在' 删除(popover 内容短,无自动滚动需求)
})
