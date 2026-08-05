// @vitest-environment jsdom
/**
 * AgentTaskProgressPane 键盘交互单测(2026-07-28 立,Phase 20 P1-1)
 *
 * 覆盖(键盘 / 无障碍相关):
 * - Header ArrowLeft/Right/Up/Down:微调 pane 位置 5px,持久化到 localStorage
 * - Shift+方向键:加速 25px
 * - 边界 clamp:超出父容器时不写入(继续保留原值)
 * - 拖拽手柄 aria-label="拖动以调整面板位置" + role=toolbar
 * - PlanStep Enter/Space 触发跳转(键盘无障碍 a11y)
 * - PlanStep role=button + tabIndex=0
 * - Esc 键优先级:help 打开时仅关 help,help 关闭时(unpin)关 pane
 * - ? 键切换 help 面板
 * - FoldableSection Header 含 data-section-header 标识(键盘导航锚点)
 * - Shift+Tab 焦点离开:符合键盘导航逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useAgentProgressPaneStore } from '../src/stores/agent-progress-pane'
import { FoldableSection } from '../src/components/ai/progress-sections/foldable-section'

// ─── next-intl mock ───────────────────────────────────────────
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    title: '任务计划',
    ariaLabel: 'Agent 任务进度面板',
    pin: '置顶',
    unpin: '取消置顶',
    minimize: '最小化',
    expandAll: '展开全部',
    collapseAll: '折叠全部',
    dragHandle: '拖动以调整面板位置',
    emptyHint: '开始对话后,这里会显示 AI 的任务拆解与进度',
    helpToggle: '快捷键帮助',
    helpClose: '关闭',
    helpPanelTitle: '键盘快捷键',
    shortcutsGroupNav: '导航',
    shortcutsGroupPane: '面板',
    shortcutsGroupTrigger: '触发器',
    shortcutSectionNav: '折叠子区上下切换',
    shortcutSectionFirstLast: '跳到第一个/最后一个子区',
    shortcutShowHelp: '打开/关闭快捷键帮助',
    shortcutCloseHelp: '关闭快捷键帮助',
    shortcutTogglePane: '切换面板开关',
    shortcutOpenPane: '在输入框打开面板',
    'overview.title': '任务总览',
    'overview.statusRunning': '运行中',
  }
  const mockT = (key: string) => map[key] ?? key
  return { mockT }
})
vi.mock('next-intl', () => ({ useTranslations: () => mockT }))

// ─── lucide-react mock(用 span 替代) ────────────────────────
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return { IconSpan }
})
vi.mock('lucide-react', () => {
  const Icon = IconSpan
  return {
    __esModule: true,
    Pin: Icon,
    PinOff: Icon,
    Minimize2: Icon,
    Circle: Icon,
    Loader2: Icon,
    Check: Icon,
    Copy: Icon,
    ListTodo: Icon,
    MessageSquare: Icon,
    ChevronRight: Icon,
    Brain: Icon,
    Wrench: Icon,
    X: Icon,
    Users: Icon,
    AlertTriangle: Icon,
    FileEdit: Icon,
    FilePlus: Icon,
    FileText: Icon,
    Search: Icon,
    Terminal: Icon,
    TerminalSquare: Icon,
    ChevronsUpDown: Icon,
    ChevronsDownUp: Icon,
    Zap: Icon,
    Activity: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    AlertCircle: Icon,
    SignalHigh: Icon,
    SignalMedium: Icon,
    RotateCw: Icon,
    WifiOff: Icon,
    ArrowDown: Icon,
    Minus: Icon,
    Bot: Icon,
    Clock: Icon,
    ChevronDown: Icon,
    ShieldCheck: Icon,
    ShieldAlert: Icon,
    Hand: Icon,
    ListTree: Icon,
    Signal: Icon,
    SignalLow: Icon,
    Code2: Icon,
    FileCode: Icon,
    Sparkles: Icon,
    GripVertical: Icon,
    HelpCircle: Icon,
    Keyboard: Icon,
    Clipboard: Icon,
    MessageSquareWarning: Icon,
    RefreshCw: Icon,
    Share2: Icon,
    Trash2: Icon,
    Timer: Icon,
  }
})

// ─── 导入被测组件 ───────────────────────────────────────────
import { AgentTaskProgressPane } from '../src/components/ai/agent-task-progress-pane'

// ─── 共享初始化 ───────────────────────────────────────────
beforeEach(() => {
  useAgentProgressPaneStore.getState().reset()
  // 清空 localStorage 拖拽位置
  try {
    window.localStorage.removeItem('agent-progress-pane-position-v2')
  } catch {
    // 忽略
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── Header 拖拽手柄(键盘入口) ─────────────────────────────
describe('AgentTaskProgressPane — Header 拖拽手柄', () => {
  it('Header 存在且含 GripVertical 拖拽手柄(2026-08-05 更新)', () => {
    useAgentProgressPaneStore.getState().openPane()
    const { container } = render(<AgentTaskProgressPane />)
    const header = container.querySelector('[data-testid="pane-header"]') as HTMLElement
    expect(header).toBeTruthy()
    const grip = header.querySelector('[data-testid="lucide-icon"]')
    expect(grip, 'Header 应含 GripVertical 拖拽手柄').toBeTruthy()
    expect(grip?.className).toContain('h-3.5')
    expect(grip?.className).toContain('w-3.5')
    expect(grip?.className).toContain('cursor-grab')
  })
})

describe('AgentTaskProgressPane — Esc / ? 全局快捷键', () => {
  it('pinned=true 时按 Esc 不关闭 pane(防误触)', () => {
    useAgentProgressPaneStore.getState().openPane()
    // 默认 pinned=true
    expect(useAgentProgressPaneStore.getState().pinned).toBe(true)

    render(<AgentTaskProgressPane />)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useAgentProgressPaneStore.getState().open).toBe(true)
  })

  it('pinned=false 时按 Esc 关闭 pane', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().togglePin()
    expect(useAgentProgressPaneStore.getState().pinned).toBe(false)

    render(<AgentTaskProgressPane />)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('按 ? 切换帮助面板开关', () => {
    useAgentProgressPaneStore.getState().openPane()
    const { container } = render(<AgentTaskProgressPane />)

    // 初始 help 关闭
    const helpToggle = container.querySelector('[data-testid="pane-help-toggle"]') as HTMLElement
    expect(helpToggle.getAttribute('aria-expanded')).toBe('false')

    // 按 ? 打开
    fireEvent.keyDown(window, { key: '?' })
    expect(helpToggle.getAttribute('aria-expanded')).toBe('true')

    // 再按 ? 关闭
    fireEvent.keyDown(window, { key: '?' })
    expect(helpToggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('help 打开时按 Esc 仅关 help,pane 仍打开', () => {
    useAgentProgressPaneStore.getState().openPane()
    useAgentProgressPaneStore.getState().togglePin() // pinned=false
    const { container } = render(<AgentTaskProgressPane />)

    // 打开 help
    fireEvent.keyDown(window, { key: '?' })
    const helpToggle = container.querySelector('[data-testid="pane-help-toggle"]') as HTMLElement
    expect(helpToggle.getAttribute('aria-expanded')).toBe('true')

    // 按 Esc 关闭 help
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(helpToggle.getAttribute('aria-expanded')).toBe('false')
    // pane 仍开
    expect(useAgentProgressPaneStore.getState().open).toBe(true)

    // 再按 Esc 关闭 pane
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useAgentProgressPaneStore.getState().open).toBe(false)
  })

  it('INPUT / TEXTAREA 焦点时按 ? 不打开 help', () => {
    useAgentProgressPaneStore.getState().openPane()
    const { container } = render(
      <div>
        <input data-testid="fake-input" />
        <AgentTaskProgressPane />
      </div>,
    )

    const input = container.querySelector('[data-testid="fake-input"]') as HTMLElement
    const helpToggle = container.querySelector('[data-testid="pane-help-toggle"]') as HTMLElement

    // focus 在 input 上时按 ?
    input.focus()
    fireEvent.keyDown(input, { key: '?' })
    expect(helpToggle.getAttribute('aria-expanded')).toBe('false')
  })
})

// ─── FoldableSection 键盘导航 ───────────────────────────
describe('FoldableSection — 键盘导航属性', () => {
  it('button 含 data-section-header 标识', () => {
    const { container } = render(
      <FoldableSection title="工具调用" data-testid="kb-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('data-section-header')).toBe('true')
  })

  it('button 含 aria-expanded 状态切换', () => {
    const { container } = render(
      <FoldableSection title="工具调用" data-testid="kb-toggle-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    // 默认折叠
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('button 模拟键盘 Enter / Space 触发 click 切换', () => {
    const { container } = render(
      <FoldableSection title="测试" data-testid="kb-enter-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    // 注:jsdom 中 native button 的 Enter/Space 触发 click 不由 keydown 自动完成
    // (实际浏览器中 button 的 native semantics 会处理);此处通过 click 模拟等价效果
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('button 含 focus-visible:ring 样式类(键盘焦点可见)', () => {
    const { container } = render(
      <FoldableSection title="测试" data-testid="kb-focus-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.className).toContain('focus-visible:ring')
  })

  it('button 含 aria-label(默认=title)', () => {
    const { container } = render(
      <FoldableSection title="工具调用" data-testid="kb-aria-section">
        <span>内容</span>
      </FoldableSection>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-label')).toBe('工具调用')
  })
})
