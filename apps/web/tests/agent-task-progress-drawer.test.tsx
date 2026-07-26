// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Mock next-intl:Drawer 内不使用 useTranslations,但 feedback/Drawer 用了 useTranslations('a11y')
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock @ihui/api-client:useAgentStream 内部 fetch 不走 api-client,但 ToolCallCard 引用了
// useWorkPanelStore,需 mock 避免拉起真实 store 副作用
vi.mock('@ihui/api-client', () => ({
  probeEmbed: vi.fn().mockResolvedValue({ success: true, data: { canEmbed: true } }),
  takeScreenshot: vi.fn().mockResolvedValue({ success: false, error: 'mock' }),
}))

import { AgentTaskProgressDrawer } from '../src/components/ai/agent-task-progress-drawer'
import { AgentProgressTrigger } from '../src/components/ai/agent-progress-trigger'
import { useAgentProgressDrawerStore } from '../src/stores/agent-progress-drawer'

describe('AgentProgressDrawer Store', () => {
  beforeEach(() => {
    useAgentProgressDrawerStore.getState().reset()
  })

  it('初始状态:open=false / threadId=null / activeTab=overview', () => {
    const s = useAgentProgressDrawerStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeTab).toBe('overview')
    expect(s.threadIdInput).toBe('')
  })

  it('openDrawer() — 默认打开,保留已有 threadId', () => {
    useAgentProgressDrawerStore.getState().setThreadId('thread-abc')
    useAgentProgressDrawerStore.getState().openDrawer()
    const s = useAgentProgressDrawerStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-abc')
  })

  it('openDrawer(threadId) — 打开并设置 threadId', () => {
    useAgentProgressDrawerStore.getState().openDrawer('thread-xyz')
    const s = useAgentProgressDrawerStore.getState()
    expect(s.open).toBe(true)
    expect(s.threadId).toBe('thread-xyz')
    expect(s.threadIdInput).toBe('thread-xyz')
  })

  it('toggle() — 切换 open 状态', () => {
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
    useAgentProgressDrawerStore.getState().toggle()
    expect(useAgentProgressDrawerStore.getState().open).toBe(true)
    useAgentProgressDrawerStore.getState().toggle()
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
  })

  it('setActiveTab() — 切换 tab', () => {
    useAgentProgressDrawerStore.getState().setActiveTab('tools')
    expect(useAgentProgressDrawerStore.getState().activeTab).toBe('tools')
  })

  it('submitThreadId() — 空输入 no-op', () => {
    useAgentProgressDrawerStore.getState().submitThreadId()
    expect(useAgentProgressDrawerStore.getState().threadId).toBeNull()
  })

  it('submitThreadId() — 提交输入值', () => {
    useAgentProgressDrawerStore.getState().setThreadIdInput('  thread-input  ')
    useAgentProgressDrawerStore.getState().submitThreadId()
    expect(useAgentProgressDrawerStore.getState().threadId).toBe('thread-input')
  })

  it('reset() — 清空所有状态', () => {
    useAgentProgressDrawerStore.getState().openDrawer('thread-1')
    useAgentProgressDrawerStore.getState().setActiveTab('changes')
    useAgentProgressDrawerStore.getState().reset()
    const s = useAgentProgressDrawerStore.getState()
    expect(s.open).toBe(false)
    expect(s.threadId).toBeNull()
    expect(s.activeTab).toBe('overview')
    expect(s.threadIdInput).toBe('')
  })
})

describe('AgentProgressTrigger', () => {
  beforeEach(() => {
    useAgentProgressDrawerStore.getState().reset()
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

  it('点击按钮 → Drawer 打开,aria-label 变为"关闭"', () => {
    render(<AgentProgressTrigger />)
    const btn = screen.getByTestId('agent-progress-trigger')
    act(() => {
      fireEvent.click(btn)
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(true)
    expect(btn.getAttribute('aria-label')).toBe('关闭 Agent 任务进度')
  })

  it('再次点击 → Drawer 关闭', () => {
    render(<AgentProgressTrigger />)
    const btn = screen.getByTestId('agent-progress-trigger')
    act(() => {
      fireEvent.click(btn)
    })
    act(() => {
      fireEvent.click(btn)
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
  })

  it('Ctrl+Shift+J 快捷键 → 切换 Drawer', () => {
    render(<AgentProgressTrigger />)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true }),
      )
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(true)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true }),
      )
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
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
    // 从 input 上派发 keydown(模拟真实用户在 input 中按键,事件 target=input)
    act(() => {
      fireEvent.keyDown(input, { key: 'j', ctrlKey: true, shiftKey: true })
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
  })
})

describe('AgentTaskProgressDrawer', () => {
  beforeEach(() => {
    useAgentProgressDrawerStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('open=false → 不渲染 Drawer 内容', () => {
    render(<AgentTaskProgressDrawer />)
    expect(screen.queryByText('Agent 任务进度')).toBeNull()
  })

  it('open=true → 渲染标题 + 4 tab + threadId 输入框', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    expect(screen.getByText('Agent 任务进度')).not.toBeNull()
    expect(screen.getByTestId('thread-id-input')).not.toBeNull()
    // 4 tab 通过 role=tab 精确匹配(CounterCard 也有"步骤"等文字)
    expect(screen.getByRole('tab', { name: /概览/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /步骤/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /工具/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /变更/ })).not.toBeNull()
  })

  it('空状态 — 显示提示文字', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    expect(screen.getByText('输入 threadId 后开始查看 Agent 任务进度')).not.toBeNull()
  })

  it('输入 threadId + 回车 → store.threadId 更新 + 显示控制按钮', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    const input = screen.getByTestId('thread-id-input') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'thread-test-123' } })
    })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', preventDefault: () => {} })
    })
    expect(useAgentProgressDrawerStore.getState().threadId).toBe('thread-test-123')
    // 控制按钮出现(启动 + 清空)
    expect(screen.getByTestId('start-btn')).not.toBeNull()
    expect(screen.getByTestId('clear-btn')).not.toBeNull()
  })

  it('点击"查看"按钮 → 等同于回车提交', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    const input = screen.getByTestId('thread-id-input') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'thread-via-button' } })
    })
    act(() => {
      fireEvent.click(screen.getByText('查看'))
    })
    expect(useAgentProgressDrawerStore.getState().threadId).toBe('thread-via-button')
  })

  it('tab 切换 — store.setActiveTab 直接调用生效(Radix Tabs 在 jsdom 中交互不稳定,改为测 store)', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    // 验证 4 个 tab 都渲染且可点击(role=tab + aria-selected 状态正确)
    const overviewTab = screen.getByRole('tab', { name: /概览/ })
    expect(overviewTab.getAttribute('aria-selected')).toBe('true')
    const stepsTab = screen.getByRole('tab', { name: /步骤/ })
    expect(stepsTab.getAttribute('aria-selected')).toBe('false')
    // 通过 store 直接切换(activeTab 是 store 状态,由 Tabs onValueChange 驱动)
    act(() => {
      useAgentProgressDrawerStore.getState().setActiveTab('steps')
    })
    expect(useAgentProgressDrawerStore.getState().activeTab).toBe('steps')
    act(() => {
      useAgentProgressDrawerStore.getState().setActiveTab('tools')
    })
    expect(useAgentProgressDrawerStore.getState().activeTab).toBe('tools')
    act(() => {
      useAgentProgressDrawerStore.getState().setActiveTab('changes')
    })
    expect(useAgentProgressDrawerStore.getState().activeTab).toBe('changes')
  })

  it('点击清空 → threadId 清空 + 输入框清空', () => {
    useAgentProgressDrawerStore.getState().openDrawer('thread-to-clear')
    render(<AgentTaskProgressDrawer />)
    act(() => {
      fireEvent.click(screen.getByTestId('clear-btn'))
    })
    expect(useAgentProgressDrawerStore.getState().threadId).toBeNull()
    expect(useAgentProgressDrawerStore.getState().threadIdInput).toBe('')
  })

  it('Esc 键关闭 Drawer(feedback/Drawer 内置行为)', () => {
    useAgentProgressDrawerStore.getState().openDrawer()
    render(<AgentTaskProgressDrawer />)
    // feedback/Drawer 在 document 上监听 keydown,需 dispatch 到 document 而非 window
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useAgentProgressDrawerStore.getState().open).toBe(false)
  })
})
