// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * TaskStatusBar 组件测试(2026-09-21 立)。
 *
 * 这条状态条是输入框上方唯一的实时信息位。这里钉住四件事:
 * ① 空闲必须整体不挂载(否则每次对话都多一条空壳);
 * ② 步骤/文件/增删行的数值与推导一致;
 * ③ 展开态与 aria 语义(无障碍与自动化都靠它);
 * ④ 会话中断时不得因步骤残留 in_progress 而永久转圈(共享层修过的真实缺陷)。
 *
 * 断言一律用原生 DOM API:本仓库未安装 @testing-library/jest-dom,
 * 自定义 matcher(toHaveAttribute / toBeInTheDocument 等)在这里会静默失效。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { PlanStep } from '@ihui/types/ai'

const { mockT, progress, chat } = vi.hoisted(() => {
  const map: Record<string, string> = {
    steps: '步骤 {current}/{total}',
    filesChanged: '{n} 个文件已修改',
    expandDetail: '展开任务明细',
    collapseDetail: '收起任务明细',
    waiting: '等待任务开始',
    idle: '空闲',
    activityTool: '调用 {tool}',
    activityMcp: '调用 {mcp} MCP',
    activityPlugin: '调用 {plugin} 插件',
    activitySubagent: '子代理 {name}',
    activityTerminal: '执行终端命令',
    activityPlanning: '规划进度',
    activityRunning: '执行中',
  }
  const t = (key: string, params?: Record<string, unknown>) => {
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) v = v.replace(`{${k}}`, String(val))
    }
    return v
  }
  return {
    mockT: t,
    progress: {
      planSteps: [] as PlanStep[],
      changes: [] as Array<{
        id: string
        filePath: string
        toolName: string
        timestamp: string
        diffInfo: { file_path: string; old_content: string; new_content: string }
      }>,
      currentTask: { kind: 'idle', label: '' } as Record<string, unknown>,
      isStreaming: false,
      overviewStatus: 'idle' as string,
    },
    // 普通对话路径:plan_updated 写在 assistant 消息上,而非会话级 progress
    chat: {
      isStreaming: false,
      messages: [] as Array<Record<string, unknown>>,
    },
  }
})

vi.mock('next-intl', () => ({ useTranslations: () => mockT }))

vi.mock('../src/hooks/use-agent-progress', () => ({
  useAgentProgress: () => ({
    overview: { status: progress.overviewStatus, completedSteps: 0 },
    planSteps: progress.planSteps,
    subagents: [],
    terminals: [],
    tools: [],
    changes: progress.changes,
    currentTask: progress.currentTask,
    events: [],
    isStreaming: progress.isStreaming,
    start: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
  }),
}))

vi.mock('../src/stores/chat', () => ({
  useChatStore: (
    selector: (s: {
      conversationId: string | null
      isStreaming: boolean
      messages: Array<Record<string, unknown>>
    }) => unknown,
  ) =>
    selector({
      conversationId: 'conv-test',
      isStreaming: chat.isStreaming,
      messages: chat.messages,
    }),
}))

import { TaskStatusBar } from '../src/components/ai/task-status-bar'

function step(over: Partial<PlanStep> & { step: string }): PlanStep {
  return { id: over.id ?? over.step, status: 'pending', ...over }
}

function resetProgress(): void {
  progress.planSteps = []
  progress.changes = []
  progress.currentTask = { kind: 'idle', label: '' }
  progress.isStreaming = false
  progress.overviewStatus = 'idle'
  chat.isStreaming = false
  chat.messages = []
}

const bar = (): HTMLElement => screen.getByTestId('task-status-bar')
const toggleButton = (): HTMLElement => screen.getByRole('button')
const spinningIcon = (): Element | null => document.querySelector('[class*="animate-spin"]')

describe('TaskStatusBar - 空态门槛', () => {
  beforeEach(resetProgress)
  afterEach(cleanup)

  it('空闲且无步骤无变更 → 完全不挂载', () => {
    const { container } = render(<TaskStatusBar />)
    expect(container.innerHTML).toBe('')
  })

  it('流式开始但还没有步骤 → 挂载并显示活动文案', () => {
    progress.isStreaming = true
    progress.currentTask = { kind: 'planning', label: '规划进度' }
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('running')
    expect(screen.getByText('规划进度')).toBeTruthy()
  })

  it('普通对话(非 agent 线程)流式 → 标题为"执行中",不得显示空闲态文案"等待任务开始"', () => {
    // 模拟普通对话:chat 流式开启,agent 线程完全空闲
    chat.isStreaming = true
    progress.isStreaming = false
    progress.currentTask = { kind: 'idle', label: '' }
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('running')
    expect(screen.getByText('执行中')).toBeTruthy()
    expect(screen.queryByText('等待任务开始')).toBeNull()
  })

  it('无步骤流式 → 不渲染步骤计数,不得出现"空闲"矛盾文案', () => {
    progress.isStreaming = true
    progress.currentTask = { kind: 'idle', label: '' }
    render(<TaskStatusBar />)
    expect(screen.queryByText('空闲')).toBeNull()
    expect(screen.queryByText(/步骤 \d+\/\d+/)).toBeNull()
  })
})

describe('TaskStatusBar - 数值与文案', () => {
  beforeEach(resetProgress)
  afterEach(cleanup)

  it('渲染步骤计数与文件增删行', () => {
    progress.isStreaming = true
    progress.currentTask = { kind: 'tool', label: '调用 edit_file', toolName: 'edit_file' }
    progress.planSteps = [
      step({ step: '读代码', status: 'completed' }),
      step({ step: '改代码', status: 'in_progress' }),
      step({ step: '跑测试', status: 'pending' }),
    ]
    progress.changes = [
      {
        id: 'c1',
        filePath: 'apps/web/src/a.ts',
        toolName: 'edit_file',
        timestamp: '2026-09-21T00:00:00Z',
        diffInfo: {
          file_path: 'apps/web/src/a.ts',
          old_content: 'l1\nl2',
          new_content: 'l1\nl2\nl3',
        },
      },
    ]
    render(<TaskStatusBar />)
    expect(screen.getByText('调用 edit_file')).toBeTruthy()
    expect(screen.getByText('步骤 2/3')).toBeTruthy()
    expect(screen.getByText('1 个文件已修改')).toBeTruthy()
    expect(screen.getByText('+3')).toBeTruthy()
    expect(screen.getByText('-2')).toBeTruthy()
  })

  it('拿不到 currentTask 文案时回落到步骤标题', () => {
    progress.isStreaming = true
    progress.planSteps = [step({ step: '唯一在跑的步骤', status: 'in_progress' })]
    render(<TaskStatusBar />)
    expect(screen.getByText('唯一在跑的步骤')).toBeTruthy()
  })

  it('MCP / 插件活动各自走专属文案', () => {
    progress.isStreaming = true
    progress.currentTask = { kind: 'tool', label: 'x', mcpName: 'context7' }
    const { unmount } = render(<TaskStatusBar />)
    expect(screen.getByText('调用 context7 MCP')).toBeTruthy()
    unmount()
    progress.currentTask = { kind: 'tool', label: 'x', pluginName: 'browser' }
    render(<TaskStatusBar />)
    expect(screen.getByText('调用 browser 插件')).toBeTruthy()
  })
})

describe('TaskStatusBar - 展开与无障碍', () => {
  beforeEach(resetProgress)
  afterEach(cleanup)

  it('流式中默认展开,可手动收起', () => {
    progress.isStreaming = true
    progress.planSteps = [step({ step: '第一步', status: 'in_progress' })]
    render(<TaskStatusBar />)
    const toggle = toggleButton()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('第一步')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('第一步')).toBeNull()
  })

  it('非流式默认收起,点击展开后列出全部步骤并切换 aria', () => {
    progress.planSteps = [
      step({ step: '甲', status: 'completed' }),
      step({ step: '乙', status: 'pending' }),
    ]
    render(<TaskStatusBar />)
    const toggle = toggleButton()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('展开任务明细')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('收起任务明细')
    // 明细列表按步骤顺序渲染(标题区可能重复展示待执行步骤,故只断言 li 集合)
    const titles = Array.from(bar().querySelectorAll('li span')).map((el) => el.textContent)
    expect(titles).toEqual(['甲', '乙'])
  })
})

describe('TaskStatusBar - 普通对话路径(回归,2026-09-21 双数据源修复)', () => {
  beforeEach(resetProgress)
  afterEach(cleanup)

  it('agent 线程无数据时,取消息级 planSteps 并由工具调用折叠文件变更', () => {
    chat.isStreaming = true
    chat.messages = [
      { id: 'u1', role: 'user', content: 'hi' },
      {
        id: 'a1',
        role: 'assistant',
        planSteps: [
          step({ step: '读代码', status: 'completed' }),
          step({ step: '改代码', status: 'in_progress' }),
        ],
        toolCalls: [
          {
            id: 't1',
            toolName: 'write_file',
            status: 'success',
            args: { path: 'apps/web/src/a.ts', content: 'l1\nl2\nl3' },
          },
        ],
      },
    ]
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('running')
    expect(screen.getByText('步骤 2/2')).toBeTruthy()
    expect(screen.getByText('1 个文件已修改')).toBeTruthy()
    expect(screen.getByText('+3')).toBeTruthy()
  })

  it('agent 线程有数据时优先生效,不被消息级旧数据压住', () => {
    progress.planSteps = [step({ step: '会话级步骤', status: 'in_progress' })]
    progress.isStreaming = true
    chat.messages = [
      {
        id: 'a0',
        role: 'assistant',
        planSteps: [step({ step: '旧消息步骤', status: 'completed' })],
      },
    ]
    render(<TaskStatusBar />)
    expect(screen.getByText('会话级步骤')).toBeTruthy()
    expect(screen.queryByText('旧消息步骤')).toBeNull()
  })

  it('消息级 planSteps 存在但流式已结束 → 显示已完成(变更需被看到)', () => {
    chat.messages = [
      { id: 'a1', role: 'assistant', planSteps: [step({ step: '甲', status: 'completed' })] },
    ]
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('completed')
  })
})

describe('TaskStatusBar - 终态优先级(回归)', () => {
  beforeEach(resetProgress)
  afterEach(cleanup)

  it('会话已中断而步骤残留 in_progress → 不得显示运行中、不得转圈', () => {
    progress.overviewStatus = 'interrupted'
    progress.planSteps = [step({ step: '卡住的步骤', status: 'in_progress' })]
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('interrupted')
    expect(spinningIcon()).toBeNull()
  })

  it('全部完成 → completed 态且计数收口', () => {
    progress.planSteps = [
      step({ step: '甲', status: 'completed' }),
      step({ step: '乙', status: 'completed' }),
    ]
    render(<TaskStatusBar />)
    expect(bar().getAttribute('data-kind')).toBe('completed')
    expect(screen.getByText('步骤 2/2')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
