// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片3(2026-10-21):工具面板的数据面按窗格读(8 处 useChatStore → usePaneChatStore)。
// 成对:① 正向 = 窗格 A 的 plan 只在 A 里可见、窗格 B 空,根单例那份也不外泄;
// ② 反证 = Provider 外(单窗格调用面)仍读根单例 —— 缺省形态逐字不变;
// ③ 正向 = 展开态按窗格分家(A 展开不点亮 B);④ 反证 = 全局单例的 open 点不亮窗格实例。

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 重面板子组件桩化:本文件只断言"数据来自哪一份 store",面板内部行为各有自己的测试
vi.mock('@/components/ai/plan-review-panel', () => ({
  PlanReviewPanel: () => <div data-testid="stub-plan-review" />,
}))
vi.mock('@/components/ai/task-list-panel', () => ({
  TaskListPanel: () => <div data-testid="stub-task-list" />,
}))
vi.mock('@/components/ai/dispatch-subagent-dialog', () => ({
  DispatchSubagentDialog: () => null,
}))
vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }
})
vi.mock('@/hooks/use-subagent-dispatch', () => ({
  useActiveDispatches: () => ({ data: [], isFetching: false, refetch: vi.fn() }),
  useCancelDispatch: () => ({ mutate: vi.fn() }),
  useSwarmTopology: () => ({ data: null, isFetching: false, refetch: vi.fn() }),
}))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAgentTokenUsage: vi.fn(async () => ({
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    })),
    getModelPriceCny: vi.fn(async () => null),
  }
})
vi.mock('@/api/checkpoint-api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    listCheckpoints: vi.fn(async () => ({ checkpoints: [] })),
    restoreCheckpoint: vi.fn(async () => ({})),
  }
})
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: (sel: (s: { fileTree: unknown[]; fetchFileTree: () => void }) => unknown) =>
    sel({ fileTree: [], fetchFileTree: vi.fn() }),
}))

import { AiSidePanelTools } from '@/components/ai/ai-side-panel-tools'
import { AgentTraceViewer } from '@/components/ai/AgentTraceViewer'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import {
  useAiToolsPanelStore,
  getAiToolsPanelStoreForPane,
  resetAiToolsPanelPaneStores,
} from '@/stores/ai-tools-panel'
import { useTaskMonitorStore } from '@/stores/task-monitor'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/stores/chat'

function messageWithPlan(stepTitle: string): ChatMessage {
  return {
    id: `plan-${stepTitle}`,
    role: 'assistant',
    content: '',
    createdAt: 1,
    planSteps: [{ id: 's1', step: stepTitle, status: 'in_progress' }],
  }
}

beforeEach(() => {
  window.localStorage.clear()
  resetChatPaneStores()
  resetAiToolsPanelPaneStores()
  // 平铺档:内容区直接是 ai-panel-content-<tab>,不经分区折叠
  useTaskMonitorStore.setState({ displayMode: 'tabs' })
  useAiToolsPanelStore.setState({ open: true })
  useChatStore.setState({ messages: [], conversationId: null, subAgentActivities: [] })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  resetChatPaneStores()
  resetAiToolsPanelPaneStores()
  useAiToolsPanelStore.setState({ open: false })
})

describe('AiSidePanelTools 数据面窗格化(片3)', () => {
  it('① 正向:plan 只在本窗格可见', () => {
    getChatStoreForPane('pane-plan-a').setState({
      conversationId: 'conv-a',
      messages: [messageWithPlan('A 的计划')],
    })
    getAiToolsPanelStoreForPane('pane-plan-a').setState({ open: true })
    render(
      <ChatPaneProvider paneId="pane-plan-a">
        <AiSidePanelTools />
      </ChatPaneProvider>,
    )
    expect(screen.getByTestId('ai-panel-content-plan')).toBeTruthy()
    expect(screen.getByTestId('stub-plan-review')).toBeTruthy()
  })

  it('① 正向:另一窗格没看过 plan ⇒ 同一时刻它的内容区是空的(不读别窗格/根单例)', () => {
    // 根单例故意放一条带 plan 的消息:若窗格 B 串到根那份,stub 就会出现
    useChatStore.setState({ conversationId: 'conv-root', messages: [messageWithPlan('根的计划')] })
    getChatStoreForPane('pane-plan-b').setState({ conversationId: 'conv-b', messages: [] })
    getAiToolsPanelStoreForPane('pane-plan-b').setState({ open: true })
    render(
      <ChatPaneProvider paneId="pane-plan-b">
        <AiSidePanelTools />
      </ChatPaneProvider>,
    )
    expect(screen.getByTestId('ai-panel-content-plan')).toBeTruthy()
    expect(screen.queryByTestId('stub-plan-review')).toBeNull()
  })

  it('② 反证:Provider 外仍读根单例(单窗格调用面零变化)', () => {
    useChatStore.setState({ conversationId: 'conv-root', messages: [messageWithPlan('根的计划')] })
    render(<AiSidePanelTools />)
    expect(screen.getByTestId('stub-plan-review')).toBeTruthy()
  })

  it('③ open 态按窗格分家:A 展开、B 收起 ⇒ 同一时刻只有一个窗格出内容区', () => {
    getChatStoreForPane('pane-open-a').setState({
      conversationId: 'conv-a',
      messages: [messageWithPlan('A 的计划')],
    })
    getChatStoreForPane('pane-open-b').setState({
      conversationId: 'conv-b',
      messages: [messageWithPlan('B 的计划')],
    })
    getAiToolsPanelStoreForPane('pane-open-a').setState({ open: true })
    getAiToolsPanelStoreForPane('pane-open-b').setState({ open: false })
    render(
      <>
        <ChatPaneProvider paneId="pane-open-a">
          <AiSidePanelTools />
        </ChatPaneProvider>
        <ChatPaneProvider paneId="pane-open-b">
          <AiSidePanelTools />
        </ChatPaneProvider>
      </>,
    )
    expect(screen.getAllByTestId('ai-panel-content-plan')).toHaveLength(1)
    expect(screen.getAllByTestId('stub-plan-review')).toHaveLength(1)
  })

  it('④ 反证:全局单例的 open 点不亮窗格实例(全局键那一型已被窗格维取代)', () => {
    getChatStoreForPane('pane-open-c').setState({
      conversationId: 'conv-c',
      messages: [messageWithPlan('C 的计划')],
    })
    getAiToolsPanelStoreForPane('pane-open-c').setState({ open: false })
    render(
      <ChatPaneProvider paneId="pane-open-c">
        <AiSidePanelTools />
      </ChatPaneProvider>,
    )
    useAiToolsPanelStore.setState({ open: true })
    expect(screen.queryByTestId('ai-panel-content-plan')).toBeNull()
    act(() => {
      getAiToolsPanelStoreForPane('pane-open-c').setState({ open: true })
    })
    expect(screen.getAllByTestId('ai-panel-content-plan').length).toBeGreaterThan(0)
  })
})

/**
 * 票C(2026-11-07):Trace 展开态按数组下标存。切到另一份 trace 时
 * `expanded` 里的 0/1 原样残留,新一轮的第 1/2 轮会被"隔空点亮";
 * 迭代顺序一变,展开态还会粘在位置上而不是轮次上。
 * 主修:用 iteration(轮次号,trace 内稳定唯一)做身份与 key;切 trace 再兜底清空。
 */
type TraceProp = React.ComponentProps<typeof AgentTraceViewer>['trace']

function traceIteration(n: number, reasoning: string) {
  return { iteration: n, reasoning, tool_calls: [], tool_results: [], duration_ms: n }
}

function makeTrace(sessionId: string, iterations: ReturnType<typeof traceIteration>[]): TraceProp {
  return {
    session_id: sessionId,
    success: true,
    final_response: '',
    iterations,
    total_duration_ms: 10,
    stop_reason: 'completed',
  }
}

describe('AgentTraceViewer 展开态身份(票C)', () => {
  it('① 切换到另一份 trace ⇒ 上一份的展开态不得残留', () => {
    const traceA = makeTrace('session-a', [traceIteration(1, 'A1'), traceIteration(2, 'A2')])
    const traceB = makeTrace('session-b', [traceIteration(1, 'B1'), traceIteration(2, 'B2')])
    const { rerender } = render(<AgentTraceViewer trace={traceA} />)
    // 展开第 1 轮
    fireEvent.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByText('A1')).toBeTruthy()

    rerender(<AgentTraceViewer trace={traceB} />)
    // 修复前:expanded 里的下标 0 残留,这里会显示 B1
    expect(screen.queryByText('B1')).toBeNull()
    expect(screen.queryByText('traceReasoning')).toBeNull()
  })

  it('② 迭代顺序变化 ⇒ 展开态跟随 iteration 号,不跟随数组下标', () => {
    const trace = makeTrace('session-c', [traceIteration(2, 'R2'), traceIteration(1, 'R1')])
    function Harness() {
      const [, force] = React.useReducer((x: number) => x + 1, 0)
      return (
        <>
          <button type="button" data-testid="force-rerender" onClick={force}>
            rerender
          </button>
          <AgentTraceViewer trace={trace} />
        </>
      )
    }
    render(<Harness />)
    // 第 1 个按钮是 trace 的第 2 轮
    const iterationButtons = screen.getAllByRole('button').slice(1)
    fireEvent.click(iterationButtons[0]!)
    expect(screen.getByText('R2')).toBeTruthy()
    expect(screen.queryByText('R1')).toBeNull()

    // 同一份 trace 对象,原地换序(模拟追平/补发把轮次排序打乱)
    trace.iterations = [traceIteration(1, 'R1'), traceIteration(2, 'R2')]
    act(() => {
      fireEvent.click(screen.getByTestId('force-rerender'))
    })
    // 修复前:展开态绑在下标 0,现在下标 0 是第 1 轮 ⇒ 错误显示 R1
    expect(screen.getByText('R2')).toBeTruthy()
    expect(screen.queryByText('R1')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
