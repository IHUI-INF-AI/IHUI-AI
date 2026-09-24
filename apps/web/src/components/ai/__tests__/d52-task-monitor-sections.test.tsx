// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D52 任务监控分区面板(2026-09-24)
// 覆盖:① 四区各有渲染断言(每区至少一个代表性 Tab 可达);② 展示方式切换 + persist 持久化;
// ③ 平铺模式旧 Tab 不回归(单一 tablist 收纳全部 26 个 tab + 点击切换内容区)。
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'

/** 与 ai-side-panel-tools.tsx TAB_KEYS 顺序一致(26 个平铺 Tab) */
const ALL_TABS = [
  'goal', 'memory', 'plan', 'tasks', 'progress', 'agents', 'background', 'swarm',
  'orchestration', 'routines', 'trace', 'checkpoints', 'tokens', 'spec', 'runtime',
  'bestof', 'memorygraph', 'atomicrollback', 'worlds', 'agenttasks', 'unified',
  'kanban', 'hooks', 'wiki', 'integrations', 'workspace',
]

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string) => key,
}))

// 重面板子组件全部桩化(分区视图只断言挂载可达,面板内部行为各有自己的测试)
function mockPanel(exportName: string, testid: string) {
  return async () => {
    const mod = await import('react')
    return { [exportName]: () => mod.createElement('div', { 'data-testid': testid }) }
  }
}
vi.mock('@/components/ai/plan-review-panel', () => mockPanel('PlanReviewPanel', 'stub-plan-review')())
vi.mock('@/components/ai/goal-card', () => mockPanel('GoalCard', 'stub-goal-card')())
vi.mock('@/components/ai/agent-pill', () => mockPanel('AgentPill', 'stub-agent-pill')())
vi.mock('@/components/ai/workspace-folder-selector', () =>
  mockPanel('WorkspaceFolderSelector', 'stub-workspace-folder-selector')(),
)
vi.mock('@/components/ai/dispatch-subagent-dialog', () =>
  mockPanel('DispatchSubagentDialog', 'stub-dispatch-dialog')(),
)

vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }
})

vi.mock('@/stores/chat', () => {
  const state = {
    messages: [],
    subAgentActivities: [],
    conversationId: null,
    isStreaming: false,
    currentModel: null,
    addMessage: vi.fn(),
  }
  const useChatStore = (sel: (s: typeof state) => unknown) => sel(state)
  return { useChatStore: Object.assign(useChatStore, { getState: () => state, setState: vi.fn() }) }
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
    getAgentTokenUsage: vi.fn(async () => ({ totalTokens: 0, promptTokens: 0, completionTokens: 0 })),
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

import { AiSidePanelTools } from '../ai-side-panel-tools'
import { useAiToolsPanelStore } from '@/stores/ai-tools-panel'
import { useTaskMonitorStore } from '@/stores/task-monitor'

beforeEach(() => {
  window.localStorage.clear()
  useTaskMonitorStore.setState({ displayMode: 'sections' })
  useAiToolsPanelStore.setState({ open: true })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('D52 任务监控分区面板', () => {
  it('默认分区视图:四区 + 展示方式切换器齐渲染', () => {
    render(<AiSidePanelTools />)
    for (const zone of ['progress', 'activity', 'results', 'auxiliary']) {
      expect(screen.getByTestId('task-monitor-zone-' + zone)).toBeTruthy()
      expect(screen.getByTestId('task-monitor-zone-toggle-' + zone)).toBeTruthy()
    }
    expect(screen.getByTestId('task-monitor-display-mode')).toBeTruthy()
    expect(screen.getByTestId('task-monitor-zones')).toBeTruthy()
  })

  it('四区各自代表性 Tab 可达并渲染内容面板', () => {
    render(<AiSidePanelTools />)
    const reps: Array<[string, string]> = [
      ['progress', 'goal'],
      ['activity', 'agents'],
      ['results', 'tokens'],
      ['auxiliary', 'workspace'],
    ]
    for (const [zone, tab] of reps) {
      const zoneEl = screen.getByTestId('task-monitor-zone-' + zone)
      fireEvent.click(within(zoneEl).getByTestId('ai-panel-tab-' + tab))
      expect(screen.getByTestId('ai-panel-content-' + tab)).toBeTruthy()
    }
  })

  it('区可折叠:不含激活 Tab 的区折叠后子导航收起,再点恢复', () => {
    render(<AiSidePanelTools />)
    // 默认激活 plan(属 progress 区),results 区可折叠
    const toggle = screen.getByTestId('task-monitor-zone-toggle-results')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('ai-panel-tab-tokens')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByTestId('ai-panel-tab-tokens')).toBeTruthy()
  })

  it('展示方式切换 + persist 持久化(localStorage)', () => {
    render(<AiSidePanelTools />)
    fireEvent.click(screen.getByTestId('task-monitor-mode-tabs'))
    expect(useTaskMonitorStore.getState().displayMode).toBe('tabs')
    expect(window.localStorage.getItem('ihui-task-monitor')).toContain('"tabs"')
    // 平铺模式:分区视图退场,26 个 tab 收纳在平铺导航条里
    expect(screen.queryByTestId('task-monitor-zones')).toBeNull()
    expect(screen.getAllByRole('tab').length).toBe(26)
    for (const key of ALL_TABS) expect(screen.getByTestId('ai-panel-tab-' + key)).toBeTruthy()
    // 切回分区视图,同样持久化
    fireEvent.click(screen.getByTestId('task-monitor-mode-sections'))
    expect(useTaskMonitorStore.getState().displayMode).toBe('sections')
    expect(window.localStorage.getItem('ihui-task-monitor')).toContain('"sections"')
    expect(screen.getByTestId('task-monitor-zones')).toBeTruthy()
  })

  it('平铺模式旧 Tab 不回归:单一 tablist + 点击切换内容区(旧行为原样)', () => {
    useTaskMonitorStore.setState({ displayMode: 'tabs' })
    render(<AiSidePanelTools />)
    expect(screen.queryByTestId('task-monitor-zones')).toBeNull()
    // 旧 DOM 结构等价:唯一 tablist
    expect(screen.getAllByRole('tablist').length).toBe(1)
    fireEvent.click(screen.getByTestId('ai-panel-tab-goal'))
    expect(screen.getByTestId('ai-panel-content-goal')).toBeTruthy()
    fireEvent.click(screen.getByTestId('ai-panel-tab-wiki'))
    expect(screen.getByTestId('ai-panel-content-wiki')).toBeTruthy()
  })
})
