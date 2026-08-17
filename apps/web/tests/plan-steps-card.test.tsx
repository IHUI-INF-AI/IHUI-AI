// @vitest-environment happy-dom
/**
 * PlanStepsCard 单元测试(深度对标 OpenAI Codex /plan + Trae Thinking Process)
 *
 * 覆盖(2026-07-31 深度优化):
 * - 空 steps 不渲染
 * - 有 steps 时渲染 FoldableSection + 完成度 "doneCount/count"
 * - 展开/折叠交互(aria-expanded 切换)
 * - 每步标题渲染
 * - 状态图标映射(pending→Clock / in_progress→Loader2 / completed→Check)
 * - 状态颜色 + animate-spin(in_progress)
 * - 耗时显示(有 durationMs 时)
 * - explanation 渲染
 * - 错误状态独立视觉(error=true → AlertCircle + 红色 + data-error)
 * - 分段进度条(每个步骤一段)
 * - 进度百分比显示
 * - 总耗时徽章(headerExtra)
 * - 折叠态摘要(正在: / 已完成 / 全部完成 / 错误计数)
 * - 点击步骤跳转消息(ProgressJumpStore)
 * - hover 联动(setHoveredPlanStep)
 * - 步骤分组(groupIndex 不同组间分隔)
 * - 可访问性(role=list + aria-live + aria-label)
 * - streaming 自动展开
 * - 长 reasoning 用 MarkdownViewer
 * - 复制 reasoning 按钮
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanStepsCard } from '../src/components/ai/progress-sections/plan-steps-card'
import type { PlanStep } from '../src/hooks/use-agent-progress'

// ─── lucide-react mock:每个图标用独立 testid(便于断言"正确图标渲染") ──
// 用 vi.importActual 透传真实 lucide-react 模块(保证 Alert 等被透传引用的图标 Info/CheckCircle 等可用),
// 再覆盖测试用例关注的图标为带 testid 的 span。
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const make = (name: string) => {
    const Comp = ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className} aria-hidden />
    )
    Comp.displayName = name
    return Comp
  }
  return {
    __esModule: true,
    ...actual,
    ListTodo: make('ListTodo'),
    Check: make('Check'),
    Clock: make('Clock'),
    Loader2: make('Loader2'),
    ChevronRight: make('ChevronRight'),
    ChevronDown: make('ChevronDown'),
    AlertCircle: make('AlertCircle'),
    Copy: make('Copy'),
  }
})

// ─── next-intl mock:useTranslations 返回 t 函数,支持 key 查表 + 参数插值 ──
const I18N_MAP: Record<string, string> = {
  'plan.title': '执行计划',
  'plan.ariaLabel': '执行计划步骤',
  'plan.stepThinking': '思考',
  'plan.stepAnswer': '回答',
  'plan.statusInProgress': '正在',
  'plan.statusCompleted': '已完成',
  'plan.statusPending': '待开始',
  'plan.stepError': '失败',
  'plan.progressPercent': '{percent}%',
  'plan.summaryAllDone': '全部完成',
  'plan.summaryErrorCount': '错误 {count}',
  'plan.totalDuration': '总 {duration}',
  'plan.copyReasoning': '复制推理过程',
  'plan.reasoningCopied': '推理过程已复制',
  'plan.reasoningCopyFailed': '复制失败',
  copied: '已复制',
}
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const tmpl = I18N_MAP[key] ?? key
    if (!params) return tmpl
    return tmpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
  },
}))

// ─── MarkdownViewer mock:测试环境避免加载 react-markdown/syntax-highlighter 重依赖 ──
vi.mock('@/components/media/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}))

// ─── @ihui/ui-react mock:渲染 TooltipContent 内容(不依赖 Radix Portal) ──
vi.mock('@ihui/ui-react', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children, ...props }: { children: React.ReactNode; side?: string }) => (
    <div data-testid="tooltip-content" data-side={props.side ?? 'top'}>
      {children}
    </div>
  ),
}))

// ─── @radix-ui/react-tooltip mock:为 @/components/feedback/Tooltip 提供 Provider/Portal 替身 ──
// (PlanStepsCard 中 `<Tooltip>` from '@/components/feedback' 直接用 Radix,需 Provider 包裹才不抛 'must be used within TooltipProvider')
vi.mock('@radix-ui/react-tooltip', () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    __esModule: true,
    Provider: passthrough,
    Root: passthrough,
    Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Content: ({ children, ...rest }: { children: React.ReactNode; side?: string }) => (
      <div role="tooltip" data-side={rest.side ?? 'top'}>
        {children}
      </div>
    ),
    Arrow: () => null,
  }
})

// ─── toast mock:避免实际渲染 toast 组件 ──
vi.mock('@/components/common', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// ─── ProgressJumpStore mock:点击跳转 + hover 联动 ──
const mockRequestJumpToMessage = vi.fn()
const mockSetHoveredPlanStep = vi.fn()
vi.mock('@/stores/progress-jump-store', () => ({
  useProgressJumpStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      requestJumpToMessage: mockRequestJumpToMessage,
      setHoveredPlanStep: mockSetHoveredPlanStep,
      hoveredMessageId: null,
    }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mockRequestJumpToMessage.mockClear()
  mockSetHoveredPlanStep.mockClear()
})

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: overrides.id ?? 'step-1',
    step: overrides.step ?? '分析需求',
    status: overrides.status ?? 'pending',
    explanation: overrides.explanation,
    durationMs: overrides.durationMs,
    error: overrides.error,
    sourceMessageId: overrides.sourceMessageId,
    groupIndex: overrides.groupIndex,
  }
}

describe('PlanStepsCard', () => {
  it('空 steps 不渲染(返回 null)', () => {
    const { container } = render(<PlanStepsCard steps={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('有 steps 时渲染卡片 + 标题图标 ListTodo', () => {
    const steps = [
      makeStep({ id: 's1', step: '步骤一', status: 'completed' }),
      makeStep({ id: 's2', step: '步骤二', status: 'in_progress' }),
      makeStep({ id: 's3', step: '步骤三', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getByTestId('plan-steps-card')).toBeTruthy()
    // FoldableSection header 图标
    expect(screen.getAllByTestId('icon-ListTodo')).toHaveLength(1)
  })

  it('折叠态显示完成度 "doneCount/count"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed' }),
      makeStep({ id: 's2', status: 'in_progress' }),
      makeStep({ id: 's3', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // doneCount=1, count=3 → "1/3"
    const progressText = screen.getByTestId('plan-steps-card-progress-text')
    expect(progressText.textContent).toBe('1/3')
  })

  it('渲染所有步骤标题', () => {
    const steps = [
      makeStep({ id: 's1', step: '分析需求' }),
      makeStep({ id: 's2', step: '编写代码' }),
      makeStep({ id: 's3', step: '运行测试' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 步骤名同时出现在 Tooltip 浮层 + 步骤列表中,用 getAllByText
    expect(screen.getAllByText('分析需求').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('编写代码').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('运行测试').length).toBeGreaterThanOrEqual(1)
  })

  it('点击 header 切换展开/折叠(aria-expanded)', () => {
    const steps = [makeStep({ id: 's1' })]
    render(<PlanStepsCard steps={steps} />)
    const header = screen.getByRole('button', { name: '执行计划' })
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })

  it('状态图标映射正确(pending→Clock / in_progress→Loader2 / completed→Check)', () => {
    const steps = [
      makeStep({ id: 's1', step: '已完成', status: 'completed' }),
      makeStep({ id: 's2', step: '进行中', status: 'in_progress' }),
      makeStep({ id: 's3', step: '待开始', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getAllByTestId('icon-Check')).toHaveLength(1)
    expect(screen.getAllByTestId('icon-Loader2')).toHaveLength(1)
    expect(screen.getAllByTestId('icon-Clock')).toHaveLength(1)
  })

  it('in_progress 步骤图标带 animate-spin 类', () => {
    const { container } = render(
      <PlanStepsCard steps={[makeStep({ id: 's1', status: 'in_progress' })]} />,
    )
    const li = container.querySelector('[data-status="in_progress"]')
    expect(li).toBeTruthy()
    const icon = li?.querySelector('[data-testid="icon-Loader2"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('animate-spin')
    expect(icon?.className).toContain('text-primary')
  })

  it('completed 步骤图标为 emerald 色', () => {
    const { container } = render(
      <PlanStepsCard steps={[makeStep({ id: 's1', status: 'completed' })]} />,
    )
    const icon = container.querySelector('[data-status="completed"] [data-testid="icon-Check"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-emerald-500')
  })

  it('有 durationMs 时显示耗时(formatDuration)', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', durationMs: 1500 }),
      makeStep({ id: 's2', status: 'completed', durationMs: 65000 }),
      makeStep({ id: 's3', status: 'completed', durationMs: 800 }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // 1500ms → "1.5s" / 65000ms → "1m5s" / 800ms → "800ms"
    expect(container.textContent).toContain('1.5s')
    expect(container.textContent).toContain('1m5s')
    expect(container.textContent).toContain('800ms')
  })

  it('无 durationMs 时不渲染耗时', () => {
    const steps = [makeStep({ id: 's1', status: 'pending' })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // pending 步骤无 durationMs,不应出现 ms/s 单位耗时
    // 注意:pending 状态图标是 Clock,但耗时徽章不应出现
    expect(container.textContent).not.toMatch(/\d+ms/)
    expect(container.textContent).not.toMatch(/\d+\.\d+s/)
  })

  it('有 explanation 时渲染说明文本(短文本直接显示)', () => {
    const steps = [makeStep({ id: 's1', step: '分析需求', explanation: '这是详细说明' })]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getByText('这是详细说明')).toBeTruthy()
  })

  it('自定义 data-testid 透传到根节点 + 子 testid 派生', () => {
    const steps = [makeStep({ id: 's1' })]
    render(<PlanStepsCard steps={steps} data-testid="msg-plan" />)
    expect(screen.getByTestId('msg-plan')).toBeTruthy()
    expect(screen.getByTestId('msg-plan-progress-text')).toBeTruthy()
    expect(screen.getByTestId('msg-plan-list')).toBeTruthy()
  })

  // ─── 深度优化(2026-07-31)新增测试 ──────────────────────────────

  it('错误状态独立视觉:error=true 时用 AlertCircle 图标 + 红色 + data-error="true"', () => {
    const { container } = render(
      <PlanStepsCard
        steps={[
          makeStep({
            id: 's1',
            step: '失败的工具',
            status: 'completed',
            error: true,
            explanation: '连接超时',
          }),
        ]}
      />,
    )
    const li = container.querySelector('[data-error="true"]')
    expect(li).toBeTruthy()
    // 错误状态用 AlertCircle 图标(非 Check)
    const icon = li?.querySelector('[data-testid="icon-AlertCircle"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-red-500')
    // data-status 仍为 completed(类型不破坏)
    expect(li?.getAttribute('data-status')).toBe('completed')
  })

  it('分段进度条渲染:每个步骤一段 + 百分比文字', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed' }),
      makeStep({ id: 's2', status: 'in_progress' }),
      makeStep({ id: 's3', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 分段进度条容器存在
    const segBar = screen.getByTestId('plan-steps-card-segmented-progress')
    expect(segBar).toBeTruthy()
    // 3 个步骤 → 3 段(用 flex-1 类标识)
    const segments = segBar.querySelectorAll('.h-full.flex-1')
    expect(segments).toHaveLength(3)
    // 百分比:1/3 = 33%
    const pct = screen.getByTestId('plan-steps-card-progress-percent')
    expect(pct.textContent).toBe('33%')
  })

  it('总耗时徽章:有 durationMs 时显示 "总 Xs"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', durationMs: 1500 }),
      makeStep({ id: 's2', status: 'completed', durationMs: 2500 }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 总耗时 = 1500 + 2500 = 4000ms = 4.0s
    const totalBadge = screen.getByTestId('plan-steps-card-total-duration')
    expect(totalBadge.textContent).toContain('总')
    expect(totalBadge.textContent).toContain('4.0s')
  })

  it('折叠态摘要:有 in_progress 步骤时显示 "正在:step"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '已完成步骤' }),
      makeStep({ id: 's2', status: 'in_progress', step: '执行中步骤' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('正在:执行中步骤')
  })

  it('折叠态摘要:全完成时显示 "全部完成"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '步骤一' }),
      makeStep({ id: 's2', status: 'completed', step: '步骤二' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('全部完成')
  })

  it('折叠态摘要:有错误时显示错误计数 + 完成度', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '步骤一' }),
      makeStep({ id: 's2', status: 'completed', step: '步骤二', error: true }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('错误')
    expect(summary.textContent).toContain('1')
    expect(summary.textContent).toContain('2/2')
  })

  it('点击步骤跳转消息:有 sourceMessageId 时调用 requestJumpToMessage', () => {
    const steps = [makeStep({ id: 's1', step: '可跳转步骤', sourceMessageId: 'msg-123' })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const li = container.querySelector(`[data-testid="plan-steps-card-item-s1"]`)
    expect(li).toBeTruthy()
    fireEvent.click(li!)
    expect(mockRequestJumpToMessage).toHaveBeenCalledWith('msg-123')
  })

  it('hover 步骤联动:setHoveredPlanStep 被调用', () => {
    const steps = [makeStep({ id: 's1', step: '可联动步骤', sourceMessageId: 'msg-456' })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const li = container.querySelector(`[data-testid="plan-steps-card-item-s1"]`)!
    fireEvent.mouseEnter(li)
    expect(mockSetHoveredPlanStep).toHaveBeenCalledWith('s1')
    fireEvent.mouseLeave(li)
    expect(mockSetHoveredPlanStep).toHaveBeenCalledWith(null)
  })

  it('步骤分组:不同 groupIndex 的步骤间有 pt-1.5 类(组间分隔)', () => {
    const steps = [
      makeStep({ id: 's1', step: '组1步骤', groupIndex: 0 }),
      makeStep({ id: 's2', step: '组2步骤', groupIndex: 1 }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // 第2个步骤是组边界,应有 pt-1.5 类
    const li2 = container.querySelector(`[data-testid="plan-steps-card-item-s2"]`)
    expect(li2).toBeTruthy()
    expect(li2?.className).toContain('pt-1.5')
  })

  it('可访问性:步骤列表为 ol 元素 + aria-live=polite + aria-label', () => {
    const steps = [makeStep({ id: 's1' })]
    render(<PlanStepsCard steps={steps} />)
    const list = screen.getByTestId('plan-steps-card-list')
    // ol 元素隐式 role=list(无需显式声明,jsx-a11y/no-redundant-roles)
    expect(list.tagName).toBe('OL')
    expect(list.getAttribute('aria-live')).toBe('polite')
    expect(list.getAttribute('aria-label')).toBe('执行计划步骤')
  })

  it('streaming 自动展开:isStreaming=true 且有 in_progress 步骤时 defaultOpen=true', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed' }),
      makeStep({ id: 's2', status: 'in_progress' }),
    ]
    render(<PlanStepsCard steps={steps} isStreaming />)
    const header = screen.getByRole('button', { name: '执行计划' })
    // streaming + in_progress → 自动展开
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })

  it('长 reasoning 用 MarkdownViewer 渲染(>120 字符)', () => {
    const longReasoning = '这是一段很长的思考过程'.repeat(20) // >120 字符
    const steps = [
      makeStep({
        id: 's1',
        step: '思考',
        status: 'completed',
        explanation: longReasoning,
      }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 长 explanation 用 MarkdownViewer 渲染
    expect(screen.getByTestId('markdown-viewer')).toBeTruthy()
  })

  it('复制 reasoning 按钮:思考步骤展开后显示复制按钮', () => {
    const longReasoning = '这是一段很长的思考过程'.repeat(20)
    const steps = [
      makeStep({
        id: 's1',
        step: '思考',
        status: 'completed',
        explanation: longReasoning,
      }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // 先展开步骤(点击可点击区域)
    const li = container.querySelector(`[data-testid="plan-steps-card-item-s1"]`)!
    const clickableArea = li.querySelector('[role="button"]')!
    fireEvent.click(clickableArea)
    // 复制按钮应出现
    const copyBtn = screen.getByTestId('plan-steps-card-copy-reasoning-s1')
    expect(copyBtn).toBeTruthy()
  })

  // ─── Tooltip 富文本浮层(2026-07-31 升级 native title → shadcn Tooltip) ──

  it('分段进度条段落 hover 显示 Tooltip 富文本(步骤名 + 状态 + 耗时)', () => {
    const steps = [makeStep({ id: 's1', step: '分析需求', status: 'completed', durationMs: 1500 })]
    render(<PlanStepsCard steps={steps} />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('分析需求')
    expect(tooltipContent.textContent).toContain('已完成')
    expect(tooltipContent.textContent).toContain('1.5s')
  })

  it('段落 Tooltip 内容使用 i18n 状态文案(stepError / statusInProgress / statusCompleted / statusPending)', () => {
    const steps = [
      makeStep({ id: 's1', step: '步骤一', status: 'pending' }),
      makeStep({ id: 's2', step: '步骤二', status: 'in_progress' }),
      makeStep({ id: 's3', step: '步骤三', status: 'completed' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const contents = screen.getAllByTestId('tooltip-content')
    expect(contents).toHaveLength(3)
    expect(contents[0]!.textContent).toContain('待开始')
    expect(contents[1]!.textContent).toContain('正在')
    expect(contents[2]!.textContent).toContain('已完成')
  })

  it('段落 Tooltip 在 error=true 时显示错误状态文案', () => {
    const steps = [makeStep({ id: 's1', step: '连接数据库', status: 'completed', error: true })]
    render(<PlanStepsCard steps={steps} />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('失败')
    expect(tooltipContent.textContent).toContain('连接数据库')
  })

  it('段落 Tooltip 在有 durationMs 时显示耗时', () => {
    const steps = [
      makeStep({ id: 's1', step: '执行中步骤', status: 'in_progress', durationMs: 65000 }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('1m5s')
  })

  it('段落 Tooltip 在无 durationMs 时不显示耗时', () => {
    const steps = [makeStep({ id: 's1', step: '分析需求', status: 'pending' })]
    render(<PlanStepsCard steps={steps} />)
    const tooltipContent = screen.getByTestId('tooltip-content')
    expect(tooltipContent.textContent).toContain('待开始')
    expect(tooltipContent.textContent).not.toContain('·')
  })
})
