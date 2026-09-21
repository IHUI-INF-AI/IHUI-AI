// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * PlanStepsCard 单元测试(2026-09-22 接入 stream-ui 基元后同步改版)
 *
 * 覆盖:
 * - 空 steps 不渲染
 * - 有 steps 时渲染 FoldableSection + 完成度 "doneCount/count"
 * - 展开/折叠交互(aria-expanded 切换)
 * - 每步渲染为一条 StreamRow(状态图标 + leading 序号 + 步骤全文主体 + trailing 状态词 + 耗时)
 * - 五态 → StreamStatus 收敛(pending→CircleDashed / in_progress→Loader2 /
 *   completed→Check / skipped→Minus / failed|error→X),行上带 data-stream-status
 * - 分段进度条(每步一段)+ 百分比徽章 + Tooltip 富文本(@/components/feedback)
 * - 总耗时徽章(workedFor 措辞,流式实时 tick / 终态权威值)
 * - 折叠态摘要("{n} 个步骤 · 状态词 · 当前步骤")
 * - 点击步骤跳转消息 / hover 联动 / 组间 mt-1.5 分隔
 * - 长 reasoning 展开为 StreamDetail + MarkdownViewer + 复制按钮
 * - 可访问性(ol + aria-live + aria-label)+ streaming 自动展开
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanStepsCard } from '../src/components/ai/progress-sections/plan-steps-card'
import type { PlanStep } from '../src/hooks/use-agent-progress'

// ─── lucide-react mock:每个图标用独立 testid(便于断言"正确图标渲染") ──
// 用 vi.importActual 透传真实 lucide-react 模块(保证 Alert 等被透传引用的图标 Info/CheckCircle 等可用),
// 再覆盖测试用例关注的图标为带 testid 的 span。StreamStatusIcon 用到 Loader2/Check/X/Minus/CircleDashed。
vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
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
    CircleDashed: make('CircleDashed'),
    Minus: make('Minus'),
    X: make('X'),
    AlertCircle: make('AlertCircle'),
    Copy: make('Copy'),
    SkipForward: make('SkipForward'),
  }
})

// ─── next-intl mock:useTranslations 返回 t 函数,支持 key 查表 + 参数插值 ──
// 命名空间无关(chat.* 与 taskStatus.* 同表查),与组件内 useTranslations('chat'|'taskStatus') 对应
const I18N_MAP: Record<string, string> = {
  'plan.title': '执行计划',
  'plan.ariaLabel': '执行计划步骤',
  'plan.stepThinking': '思考',
  'plan.stepAnswer': '回答',
  'plan.statusInProgress': '正在',
  'plan.statusCompleted': '已完成',
  'plan.statusPending': '待开始',
  'plan.statusSkipped': '已跳过',
  'plan.statusFailed': '失败',
  'plan.stepError': '失败',
  'plan.progressPercent': '{percent}%',
  'plan.summaryAllDone': '全部完成',
  'plan.summaryErrorCount': '错误 {count}',
  'plan.totalDuration': '总 {duration}',
  'plan.copyReasoning': '复制推理过程',
  'plan.reasoningCopied': '推理过程已复制',
  'plan.reasoningCopyFailed': '复制失败',
  copied: '已复制',
  // taskStatus 命名空间(stream-ui 基元 + 状态词收敛口径)
  statusSuccess: '已完成',
  statusRunning: '执行中',
  statusFailed: '执行失败',
  statusSkipped: '已跳过',
  stepPending: '待开始',
  stepCount: '{n} 个步骤',
  workedFor: '用时 {time}',
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

  it('五态 → StreamStatus 图标收敛(pending→CircleDashed / in_progress→Loader2 / completed→Check)', () => {
    const steps = [
      makeStep({ id: 's1', step: '已完成', status: 'completed' }),
      makeStep({ id: 's2', step: '进行中', status: 'in_progress' }),
      makeStep({ id: 's3', step: '待开始', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 每步渲染为一条 StreamRow(基元统一 testId 口径 plan-steps-card-row-{id}),
    // 图标断言限定在行内(分段进度条的 Tooltip 里也有同一枚状态图标)
    const expectRowIcon = (id: string, status: string, icon: string) => {
      const row = screen.getByTestId(`plan-steps-card-row-${id}`)
      expect(row.getAttribute('data-stream-status')).toBe(status)
      expect(row.querySelector(`[data-testid="icon-${icon}"]`)).toBeTruthy()
    }
    expectRowIcon('s1', 'success', 'Check')
    expectRowIcon('s2', 'running', 'Loader2')
    expectRowIcon('s3', 'pending', 'CircleDashed')
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

  it('completed 步骤图标用基元统一口径(14px 图标 + muted 色,不再自配 emerald)', () => {
    const { container } = render(
      <PlanStepsCard steps={[makeStep({ id: 's1', status: 'completed' })]} />,
    )
    const icon = container.querySelector('[data-status="completed"] [data-testid="icon-Check"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('h-3.5')
    expect(icon?.className).toContain('text-muted-foreground/50')
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

  it('错误状态收敛到基元 error 态:error=true → data-stream-status="error" + X 红色 + data-error="true"', () => {
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
    expect(li?.getAttribute('data-stream-status')).toBe('error')
    // 错误状态用基元的 X 图标(红色),不再自配 AlertCircle
    const icon = li?.querySelector('[data-testid="icon-X"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-red-500')
    // 状态词收敛为 taskStatus.statusFailed(执行失败)
    expect(li?.textContent).toContain('执行失败')
    // data-status 仍为 completed(类型不破坏)
    expect(li?.getAttribute('data-status')).toBe('completed')
  })

  // ─── 五态渲染(2026-09-19 v2:skipped/failed 独立状态;2026-09-22 收敛到 StreamStatus) ────

  it('skipped 状态:Minus 图标 + data-stream-status="skipped" + 步骤全文完整可读', () => {
    const { container } = render(
      <PlanStepsCard steps={[makeStep({ id: 's1', step: '跳过的步骤', status: 'skipped' })]} />,
    )
    const li = container.querySelector('[data-status="skipped"]')
    expect(li).toBeTruthy()
    expect(li?.getAttribute('data-stream-status')).toBe('skipped')
    const icon = li?.querySelector('[data-testid="icon-Minus"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-muted-foreground/40')
    // 2026-09-22 收尾接线:步骤全文是行主体(titleMode="primary"),序号走 leading 槽
    // → 两个独立 span,textContent 里不再有"1. "的空格,故分别断言序号与全文
    expect(li?.textContent).toContain('1.')
    expect(li?.textContent).toContain('跳过的步骤')
    expect(li?.textContent).toContain('已跳过')
    // skipped 不带 error 标记
    expect(li?.getAttribute('data-error')).toBe(null)
  })

  it('failed 状态(显式):X 图标 + 红色 + data-stream-status="error"', () => {
    const { container } = render(
      <PlanStepsCard steps={[makeStep({ id: 's1', step: '失败的步骤', status: 'failed' })]} />,
    )
    const li = container.querySelector('[data-status="failed"]')
    expect(li).toBeTruthy()
    // isFailed 统一视觉:显式 failed 与 error=true 收敛为同一 error 态
    expect(li?.getAttribute('data-stream-status')).toBe('error')
    const icon = li?.querySelector('[data-testid="icon-X"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-red-500')
    expect(li?.textContent).toContain('执行失败')
    // 无 error 标记时 data-error 属性不渲染
    expect(li?.getAttribute('data-error')).toBe(null)
  })

  it('failed 统一视觉:completed+error=true(旧协议)与显式 failed(新协议)均为 error 态 X 图标', () => {
    const { container } = render(
      <PlanStepsCard
        steps={[
          makeStep({ id: 's1', step: '旧协议失败', status: 'completed', error: true }),
          makeStep({ id: 's2', step: '新协议失败', status: 'failed' }),
        ]}
      />,
    )
    // 两种来源(isFailed 归一化)均渲染基元 error 态 X 红色图标(限定在步骤列表内,
    // 分段进度条 Tooltip 里另有同枚图标,不计入)
    const list = container.querySelector('[data-testid="plan-steps-card-list"]')!
    const icons = list.querySelectorAll('[data-testid="icon-X"]')
    expect(icons).toHaveLength(2)
    icons.forEach((icon) => expect(icon.className).toContain('text-red-500'))
    // s1 旧协议带 data-error 标记;s2 新协议无(仅显式 failed)
    const item1 = container.querySelector('[data-testid="plan-steps-card-item-s1"]')
    const item2 = container.querySelector('[data-testid="plan-steps-card-item-s2"]')
    expect(item1?.getAttribute('data-error')).toBe('true')
    expect(item2?.getAttribute('data-error')).toBe(null)
  })

  it('五态并存:pending/in_progress/completed/skipped/failed 各自图标渲染', () => {
    const steps = [
      makeStep({ id: 's1', step: '待开始', status: 'pending' }),
      makeStep({ id: 's2', step: '进行中', status: 'in_progress' }),
      makeStep({ id: 's3', step: '已完成', status: 'completed' }),
      makeStep({ id: 's4', step: '已跳过', status: 'skipped' }),
      makeStep({ id: 's5', step: '已失败', status: 'failed' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 图标断言限定在各自行内(分段进度条的 Tooltip 里另有同枚状态图标)
    const rowIcon = (id: string) =>
      screen
        .getByTestId(`plan-steps-card-row-${id}`)
        .querySelector('[data-testid^="icon-"]')
        ?.getAttribute('data-testid')
    expect(rowIcon('s1')).toBe('icon-CircleDashed')
    expect(rowIcon('s2')).toBe('icon-Loader2')
    expect(rowIcon('s3')).toBe('icon-Check')
    expect(rowIcon('s4')).toBe('icon-Minus')
    expect(rowIcon('s5')).toBe('icon-X')
    // 五态各自映射到独立 StreamStatus(行的 data 属性即状态真相)
    expect(
      ['s1', 's2', 's3', 's4', 's5'].map((id) =>
        screen.getByTestId(`plan-steps-card-row-${id}`).getAttribute('data-stream-status'),
      ),
    ).toEqual(['pending', 'running', 'success', 'skipped', 'error'])
  })

  it('分段进度条五态:skipped/failed 段颜色独立 + Tooltip 状态文案(feedback Tooltip)', () => {
    const steps = [
      makeStep({ id: 's1', step: '跳过段', status: 'skipped' }),
      makeStep({ id: 's2', step: '失败段', status: 'failed' }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // skipped 段弱化灰,failed 段红色
    const seg1 = container.querySelector('[data-testid="plan-steps-card-segment-s1"]')
    const seg2 = container.querySelector('[data-testid="plan-steps-card-segment-s2"]')
    expect(seg1?.className).toContain('bg-muted-foreground/40')
    expect(seg2?.className).toContain('bg-red-500/70')
    // Tooltip 走 @/components/feedback(Radix),文案收敛到 taskStatus 口径。
    // 取 [role=tooltip] 而非 getByRole:Portal 在测试环境被 mock 成内联渲染,浮层落在
    // 装饰性进度条容器(role=img + aria-hidden)子树内,可访问性查询会把它过滤掉。
    const contents = [...container.querySelectorAll('[role="tooltip"]')]
    expect(contents).toHaveLength(2)
    expect(contents[0]!.textContent).toContain('已跳过')
    expect(contents[1]!.textContent).toContain('执行失败')
    // Tooltip 内状态指示用基元图标(替代原 rounded-full 装饰点)
    expect(contents[0]!.querySelector('[data-testid="icon-Minus"]')).toBeTruthy()
    expect(contents[1]!.querySelector('[data-testid="icon-X"]')).toBeTruthy()
  })

  it('折叠态摘要:显式 failed 状态计入错误计数(与 error=true 归一化)', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '步骤一' }),
      makeStep({ id: 's2', status: 'failed', step: '步骤二' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('2 个步骤')
    expect(summary.textContent).toContain('错误')
    expect(summary.textContent).toContain('1')
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
    // 百分比:1/3 = 33%(确定性居中徽章 + plan.progressPercent 文案)
    const pct = screen.getByTestId('plan-steps-card-progress-percent')
    expect(pct.textContent).toBe('33%')
    expect(pct.className).toContain('tabular-nums')
  })

  it('总耗时徽章:有 durationMs 时显示 workedFor 措辞 "用时 Xs"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', durationMs: 1500 }),
      makeStep({ id: 's2', status: 'completed', durationMs: 2500 }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // 总耗时 = 1500 + 2500 = 4000ms = 4.0s
    const totalBadge = screen.getByTestId('plan-steps-card-total-duration')
    expect(totalBadge.textContent).toContain('用时')
    expect(totalBadge.textContent).toContain('4.0s')
  })

  it('折叠态摘要:有 in_progress 步骤时显示 步数 + 执行中 + 当前步骤', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '已完成步骤' }),
      makeStep({ id: 's2', status: 'in_progress', step: '执行中步骤' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('2 个步骤')
    expect(summary.textContent).toContain('执行中')
    expect(summary.textContent).toContain('执行中步骤')
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

  it('折叠态摘要:有错误时显示错误计数,完成度由 header 的 doneCount/count 承载', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', step: '步骤一' }),
      makeStep({ id: 's2', status: 'completed', step: '步骤二', error: true }),
    ]
    render(<PlanStepsCard steps={steps} />)
    const summary = screen.getByTestId('plan-steps-card-summary')
    expect(summary.textContent).toContain('错误')
    expect(summary.textContent).toContain('1')
    // 完成度不再重复出现在摘要里(header 已有 2/2)
    expect(summary.textContent).not.toContain('2/2')
    expect(screen.getByTestId('plan-steps-card-progress-text').textContent).toBe('2/2')
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

  it('步骤分组:不同 groupIndex 的步骤间有 mt-1.5 类(组间空隙分隔,非分割线)', () => {
    const steps = [
      makeStep({ id: 's1', step: '组1步骤', groupIndex: 0 }),
      makeStep({ id: 's2', step: '组2步骤', groupIndex: 1 }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // 第2个步骤是组边界,应有 mt-1.5 类(改造前的 pt-1.5 + 时间线连接线一并移除)
    const li2 = container.querySelector(`[data-testid="plan-steps-card-item-s2"]`)
    expect(li2).toBeTruthy()
    expect(li2?.className).toContain('mt-1.5')
    expect(li2?.className).not.toContain('pt-1.5')
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

  it('长 reasoning 展开为 StreamDetail + MarkdownViewer(>120 字符,收起态不占位)', () => {
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
    // 收起态不渲染明细(取代改造前的 line-clamp-2 两行截断)
    expect(screen.queryByTestId('markdown-viewer')).toBeNull()
    // 行本身即展开按钮(StreamRow 交互态)
    const row = screen.getByTestId('plan-steps-card-row-s1')
    expect(row.tagName).toBe('BUTTON')
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('plan-steps-card-detail-s1')).toBeTruthy()
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
    render(<PlanStepsCard steps={steps} />)
    // 先展开步骤(点击 StreamRow 行按钮)
    fireEvent.click(screen.getByTestId('plan-steps-card-row-s1'))
    // 复制按钮应出现
    const copyBtn = screen.getByTestId('plan-steps-card-copy-reasoning-s1')
    expect(copyBtn).toBeTruthy()
    // 提示走 Tooltip 组件而非 title 属性
    expect(copyBtn.getAttribute('title')).toBe(null)
  })

  // ─── Tooltip 富文本浮层(@/components/feedback,禁用原生 title) ──
  // 说明:浮层节点用 [role=tooltip] 取,不用 getByRole —— Portal 在测试环境被 mock 成
  // 内联渲染,浮层落在装饰性进度条容器(role=img + aria-hidden)子树内,可访问性查询会过滤掉。

  const getTooltips = (container: HTMLElement) => [
    ...container.querySelectorAll('[role="tooltip"]'),
  ]

  it('分段进度条段落显示 Tooltip 富文本(基元状态图标 + 步骤名 + 状态 + 耗时)', () => {
    const steps = [makeStep({ id: 's1', step: '分析需求', status: 'completed', durationMs: 1500 })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const [tooltipContent] = getTooltips(container)
    expect(tooltipContent?.textContent).toContain('分析需求')
    expect(tooltipContent?.textContent).toContain('已完成')
    expect(tooltipContent?.textContent).toContain('1.5s')
    // 段落本身不使用原生 title 属性(改用 Tooltip 组件)
    expect(
      container.querySelector('[data-testid="plan-steps-card-segment-s1"]')?.getAttribute('title'),
    ).toBe(null)
  })

  it('段落 Tooltip 状态文案与 StreamStatus 同一口径(stepPending/statusRunning/statusSuccess)', () => {
    const steps = [
      makeStep({ id: 's1', step: '步骤一', status: 'pending' }),
      makeStep({ id: 's2', step: '步骤二', status: 'in_progress' }),
      makeStep({ id: 's3', step: '步骤三', status: 'completed' }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const contents = getTooltips(container)
    expect(contents).toHaveLength(3)
    expect(contents[0]!.textContent).toContain('待开始')
    expect(contents[1]!.textContent).toContain('执行中')
    expect(contents[2]!.textContent).toContain('已完成')
  })

  it('段落 Tooltip 在 error=true 时显示错误状态文案', () => {
    const steps = [makeStep({ id: 's1', step: '连接数据库', status: 'completed', error: true })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const [tooltipContent] = getTooltips(container)
    expect(tooltipContent?.textContent).toContain('失败')
    expect(tooltipContent?.textContent).toContain('连接数据库')
  })

  it('段落 Tooltip 在有 durationMs 时显示耗时', () => {
    const steps = [
      makeStep({ id: 's1', step: '执行中步骤', status: 'in_progress', durationMs: 65000 }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const [tooltipContent] = getTooltips(container)
    expect(tooltipContent?.textContent).toContain('1m5s')
  })

  it('段落 Tooltip 在无 durationMs 时不显示耗时', () => {
    const steps = [makeStep({ id: 's1', step: '分析需求', status: 'pending' })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    const [tooltipContent] = getTooltips(container)
    expect(tooltipContent?.textContent).toContain('待开始')
    expect(tooltipContent?.textContent).not.toContain('·')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
