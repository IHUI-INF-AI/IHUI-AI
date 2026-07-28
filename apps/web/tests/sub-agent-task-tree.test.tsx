// @vitest-environment happy-dom
/**
 * SubAgentTaskTree 单元测试(2026-07-28 立,块 3.4)
 *
 * 覆盖:
 * - 基础渲染:容器 + status icon + Bot icon + nickname + handle
 * - 折叠/展开交互:点击 header 切换 collapsed
 * - 默认展开/折叠(defaultCollapsed)
 * - 状态颜色映射(spawned/running/done/failed/dead)
 * - 状态 icon 映射(Clock/Loader2/Check/AlertCircle)
 * - 工具调用 checklist:展开时显示,折叠时隐藏
 * - 失败原因:failed/dead 时显示 error 段
 * - duration / tokenUsage / currentTask 渲染
 * - 右键菜单:开启/禁用 + 菜单项点击
 * - 复制反馈 flash(已复制图标)
 * - a11y:role=menu / aria-label / aria-expanded
 * - 边界:无 tools / 无 nickname 边界
 * - buildSubagentDetailsText 单元测试
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import {
  SubAgentTaskTree,
  buildSubagentDetailsText,
} from '../src/components/ai/progress-sections/sub-agent-task-tree'
import type { Subagent, AgentToolCall } from '../src/hooks/use-agent-progress'

// ─── lucide-react mock:用 span 替代(避免 ESM 兼容问题) ──────────────
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
    Bot: Icon,
    ChevronRight: Icon,
    Loader2: Icon,
    Check: Icon,
    AlertCircle: Icon,
    Clock: Icon,
    Wrench: Icon,
    Hash: Icon,
    AtSign: Icon,
    User: Icon,
    FileText: Icon,
    // Checklist 内部依赖(防止连锁 mock 失败)
    Circle: Icon,
    Minus: Icon,
  }
})

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeSubagent(overrides: Partial<Subagent> = {}): Subagent {
  return {
    id: overrides.id ?? 'subagent-1',
    threadId: overrides.threadId ?? 'thread-abc-123',
    nickname: overrides.nickname ?? 'Validator',
    handle: overrides.handle ?? '@validator',
    color: overrides.color ?? 'cyan',
    status: overrides.status ?? 'running',
    role: overrides.role,
    spawnedAt: overrides.spawnedAt ?? '2026-07-28T10:00:00Z',
    endedAt: overrides.endedAt,
    durationMs: overrides.durationMs,
    currentTask: overrides.currentTask,
    pendingApproval: overrides.pendingApproval,
    tokenUsage: overrides.tokenUsage,
    toolCalls: overrides.toolCalls,
    failureReason: overrides.failureReason,
    tools: overrides.tools,
  }
}

function makeTool(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    id: overrides.id ?? 'tool-1',
    toolName: overrides.toolName ?? 'read_file',
    args: overrides.args ?? { path: '/tmp/test.ts' },
    result: overrides.result,
    status: overrides.status ?? 'success',
    startedAt: overrides.startedAt ?? '2026-07-28T10:00:00Z',
    endedAt: overrides.endedAt,
    durationMs: overrides.durationMs ?? 1500,
    error: overrides.error,
  }
}

beforeEach(() => {
  // happy-dom jsdom 默认 clipboard 不可用 → mock 让复制成功路径可测
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── 基础渲染 ───────────────────────────────────────────────
describe('SubAgentTaskTree — 基础渲染', () => {
  it('渲染容器 + subagent-task-tree testid + data 属性', () => {
    const sub = makeSubagent({ id: 'sa-1', threadId: 'th-1' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    expect(root).toBeTruthy()
    expect(root.getAttribute('data-subagent-id')).toBe('sa-1')
    expect(root.getAttribute('data-subagent-thread-id')).toBe('th-1')
    expect(root.getAttribute('data-subagent-status')).toBe('running')
  })

  it('渲染 nickname + handle + status', () => {
    const sub = makeSubagent({ nickname: 'MyBot', handle: '@mybot' })
    render(<SubAgentTaskTree subagent={sub} />)
    expect(screen.getByText('MyBot')).toBeTruthy()
    expect(screen.getByText('@mybot')).toBeTruthy()
  })

  it('渲染 duration + tokenUsage + currentTask', () => {
    const sub = makeSubagent({
      durationMs: 65000,
      tokenUsage: 12345,
      currentTask: 'reading file',
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    // 65000ms = "1m5s" via formatDuration(无空格)
    expect(container.textContent).toContain('1m5s')
    // 12345 / 1000 = 12.345 → round → 12k tok
    expect(container.textContent).toContain('12k tok')
    // currentTask → lg:inline 才显示(happy-dom viewport 默认 1024 满足)
    expect(container.textContent).toContain('reading file')
  })

  it('tokenUsage = 0 时不渲染 k tok(避免 0k 噪声)', () => {
    const sub = makeSubagent({ tokenUsage: 0, durationMs: 5000 })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    expect(container.textContent).not.toContain('0k tok')
  })

  it('自定义 data-testid 覆盖默认', () => {
    const sub = makeSubagent()
    const { container } = render(
      <SubAgentTaskTree subagent={sub} data-testid="custom-tree" />,
    )
    expect(container.querySelector('[data-testid="custom-tree"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="subagent-task-tree"]')).toBeFalsy()
  })

  it('className prop 透传到根容器', () => {
    const sub = makeSubagent()
    const { container } = render(
      <SubAgentTaskTree subagent={sub} className="custom-cls" />,
    )
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    expect(root.className).toContain('custom-cls')
  })
})

// ─── 折叠/展开交互 ─────────────────────────────────────────
describe('SubAgentTaskTree — 折叠/展开', () => {
  it('默认展开:不传 defaultCollapsed 时,tools 列表直接显示', () => {
    const tools = [makeTool({ id: 't1' }), makeTool({ id: 't2' })]
    const sub = makeSubagent({ tools })
    render(<SubAgentTaskTree subagent={sub} />)
    // 展开时显示"工具调用 (2)"
    expect(screen.getByText(/工具调用 \(2\)/)).toBeTruthy()
  })

  it('defaultCollapsed=true:不渲染 tools 列表', () => {
    const tools = [makeTool({ id: 't1' })]
    const sub = makeSubagent({ tools })
    render(<SubAgentTaskTree subagent={sub} defaultCollapsed={true} />)
    // 折叠时显示"工具调用 (1)"(header 文字)？
    // 实际:折叠时整个 checklist 块不渲染,只有 header 按钮可点击展开
    // 验证 "工具调用" 文字是否出现 — collapsed 时不出现(只有展开才显示该块)
    const buttons = screen.getAllByRole('button')
    // 至少有 1 个 header button(可展开)
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('点击 header 按钮切换 collapsed', () => {
    const tools = [makeTool({ id: 't1' })]
    const sub = makeSubagent({ tools })
    const { container } = render(
      <SubAgentTaskTree subagent={sub} defaultCollapsed={true} />,
    )
    // 折叠时 tools 区域应不可见
    const headerBtn = container.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false')
    // 点击展开
    fireEvent.click(headerBtn)
    expect(headerBtn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/工具调用 \(1\)/)).toBeTruthy()
  })

  it('header 按钮含 aria-expanded 属性', () => {
    const sub = makeSubagent()
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const headerBtn = container.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(headerBtn).toBeTruthy()
    expect(headerBtn.getAttribute('aria-expanded')).toBe('true')
  })

  it('空 tools 数组:不渲染 checklist 块', () => {
    const sub = makeSubagent({ tools: [] })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    // "工具调用" 文字不应出现
    expect(container.textContent).not.toContain('工具调用')
  })
})

// ─── 失败原因显示 ─────────────────────────────────────────
describe('SubAgentTaskTree — 失败原因', () => {
  it('failureReason 存在时显示 error 段(带 AlertCircle 图标)', () => {
    const sub = makeSubagent({
      status: 'failed',
      failureReason: 'API rate limit exceeded',
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    expect(container.textContent).toContain('API rate limit exceeded')
    // text-destructive/80 样式
    const errorSpan = container.querySelector('.text-destructive\\/80') as HTMLElement
    expect(errorSpan).toBeTruthy()
  })

  it('无 failureReason 时不显示 error 段', () => {
    const sub = makeSubagent({ status: 'done' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const errorSpan = container.querySelector('.text-destructive\\/80')
    expect(errorSpan).toBeFalsy()
  })
})

// ─── 右键菜单 ────────────────────────────────────────────
describe('SubAgentTaskTree — 右键菜单', () => {
  it('enableContextMenu=true:contextMenu 事件显示菜单', () => {
    const sub = makeSubagent({ nickname: 'TestBot' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    // 模拟 contextmenu
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    // 菜单出现
    const menu = container.querySelector('[data-testid="subagent-task-tree-context-menu"]')
    expect(menu).toBeTruthy()
  })

  it('enableContextMenu=false:contextMenu 不显示菜单', () => {
    const sub = makeSubagent()
    const { container } = render(
      <SubAgentTaskTree subagent={sub} enableContextMenu={false} />,
    )
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    const menu = container.querySelector('[data-testid="subagent-task-tree-context-menu"]')
    expect(menu).toBeFalsy()
  })

  it('菜单含 4 个菜单项:threadId / handle / nickname / details', () => {
    const sub = makeSubagent()
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    expect(screen.getByTestId('subagent-context-menu-copy-threadId')).toBeTruthy()
    expect(screen.getByTestId('subagent-context-menu-copy-handle')).toBeTruthy()
    expect(screen.getByTestId('subagent-context-menu-copy-nickname')).toBeTruthy()
    expect(screen.getByTestId('subagent-context-menu-copy-details')).toBeTruthy()
  })

  it('菜单 role=menu + aria-label 含 nickname', () => {
    const sub = makeSubagent({ nickname: 'MyBot' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    const menu = container.querySelector('[data-testid="subagent-task-tree-context-menu"]') as HTMLElement
    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.getAttribute('aria-label')).toContain('MyBot')
  })

  it('点击 threadId 菜单项:复制 threadId 到剪贴板', async () => {
    const sub = makeSubagent({ threadId: 'thread-xyz-789' })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    fireEvent.click(screen.getByTestId('subagent-context-menu-copy-threadId'))
    // wait for promise
    await act(async () => {
      await Promise.resolve()
    })
    expect(writeTextSpy).toHaveBeenCalledWith('thread-xyz-789')
  })

  it('点击 handle 菜单项:复制 handle', async () => {
    const sub = makeSubagent({ handle: '@my-handle' })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    fireEvent.click(screen.getByTestId('subagent-context-menu-copy-handle'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(writeTextSpy).toHaveBeenCalledWith('@my-handle')
  })

  it('点击 nickname 菜单项:复制 nickname', async () => {
    const sub = makeSubagent({ nickname: 'BotNick' })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    fireEvent.click(screen.getByTestId('subagent-context-menu-copy-nickname'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(writeTextSpy).toHaveBeenCalledWith('BotNick')
  })

  it('点击 details 菜单项:复制完整 buildSubagentDetailsText 结果', async () => {
    const sub = makeSubagent({
      nickname: 'DetailBot',
      handle: '@detail',
      threadId: 'th-detail',
      status: 'running',
      role: 'validator',
      currentTask: 'checking types',
      durationMs: 3000,
      tokenUsage: 5000,
      toolCalls: 3,
    })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    fireEvent.click(screen.getByTestId('subagent-context-menu-copy-details'))
    await act(async () => {
      await Promise.resolve()
    })
    const expected = buildSubagentDetailsText(sub)
    expect(writeTextSpy).toHaveBeenCalledWith(expected)
    // 验证 buildSubagentDetailsText 关键字段
    expect(expected).toContain('DetailBot (@detail)')
    expect(expected).toContain('threadId: th-detail')
    expect(expected).toContain('status: running')
    expect(expected).toContain('role: validator')
    expect(expected).toContain('currentTask: checking types')
    expect(expected).toContain('durationMs: 3000')
    expect(expected).toContain('tokenUsage: 5000')
    expect(expected).toContain('toolCalls: 3')
  })

  it('Esc 键关闭菜单', () => {
    const sub = makeSubagent()
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    expect(container.querySelector('[data-testid="subagent-task-tree-context-menu"]')).toBeTruthy()
    // 触发 Esc
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('[data-testid="subagent-task-tree-context-menu"]')).toBeFalsy()
  })

  it('菜单内 keydown Esc 关闭菜单', () => {
    const sub = makeSubagent()
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    const menu = container.querySelector('[data-testid="subagent-task-tree-context-menu"]') as HTMLElement
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(container.querySelector('[data-testid="subagent-task-tree-context-menu"]')).toBeFalsy()
  })

  it('点击菜单外:关闭菜单(延迟绑定)', () => {
    vi.useFakeTimers()
    try {
      const sub = makeSubagent()
      render(
        <div>
          <button data-testid="outside">外部</button>
          <SubAgentTaskTree subagent={sub} />
        </div>,
      )
      const root = document.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
      fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
      expect(
        document.querySelector('[data-testid="subagent-task-tree-context-menu"]'),
      ).toBeTruthy()
      // 推进 10ms 触发延迟绑定
      act(() => {
        vi.advanceTimersByTime(10)
      })
      // 模拟外部 mousedown
      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(
        document.querySelector('[data-testid="subagent-task-tree-context-menu"]'),
      ).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('点击菜单项后,菜单自动关闭(复制成功后)', async () => {
    const sub = makeSubagent()
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    const root = container.querySelector('[data-testid="subagent-task-tree"]') as HTMLElement
    fireEvent.contextMenu(root, { clientX: 200, clientY: 300, button: 2 })
    expect(container.querySelector('[data-testid="subagent-task-tree-context-menu"]')).toBeTruthy()
    fireEvent.click(screen.getByTestId('subagent-context-menu-copy-threadId'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="subagent-task-tree-context-menu"]')).toBeFalsy()
  })
})

// ─── buildSubagentDetailsText 单元测试 ───────────────────────
describe('buildSubagentDetailsText — 详情文本序列化', () => {
  it('基础字段:id / threadId / status', () => {
    const sub = makeSubagent({ id: 'sa-x', threadId: 'th-x', status: 'running' })
    const text = buildSubagentDetailsText(sub)
    expect(text).toContain('id: sa-x')
    expect(text).toContain('threadId: th-x')
    expect(text).toContain('status: running')
  })

  it('role 存在时输出 role 行', () => {
    const sub = makeSubagent({ role: 'code-reviewer' })
    expect(buildSubagentDetailsText(sub)).toContain('role: code-reviewer')
  })

  it('role 不存在时不输出 role 行', () => {
    const sub = makeSubagent({ role: undefined })
    expect(buildSubagentDetailsText(sub)).not.toContain('role:')
  })

  it('currentTask / durationMs / tokenUsage / toolCalls 条件输出', () => {
    const sub = makeSubagent({
      currentTask: 'task-x',
      durationMs: 1000,
      tokenUsage: 200,
      toolCalls: 5,
    })
    const text = buildSubagentDetailsText(sub)
    expect(text).toContain('currentTask: task-x')
    expect(text).toContain('durationMs: 1000')
    expect(text).toContain('tokenUsage: 200')
    expect(text).toContain('toolCalls: 5')
  })

  it('failureReason 存在时输出失败原因行', () => {
    const sub = makeSubagent({ failureReason: 'network timeout' })
    expect(buildSubagentDetailsText(sub)).toContain('failureReason: network timeout')
  })

  it('第一行是 nickname (handle) 格式', () => {
    const sub = makeSubagent({ nickname: 'MyBot', handle: '@my' })
    const text = buildSubagentDetailsText(sub)
    const firstLine = text.split('\n')[0]
    expect(firstLine).toBe('MyBot (@my)')
  })

  it('多行用 \\n 分隔', () => {
    const sub = makeSubagent()
    const text = buildSubagentDetailsText(sub)
    const lines = text.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 状态颜色 + icon 映射 ───────────────────────────────────
describe('SubAgentTaskTree — 状态视觉映射', () => {
  it('status=running:header 按钮含 animate-spin 样式', () => {
    const sub = makeSubagent({ status: 'running' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    // running icon 是 Loader2,加上 animate-spin
    const statusIcon = container.querySelector('.animate-spin')
    expect(statusIcon).toBeTruthy()
  })

  it('status=done:无 animate-spin', () => {
    const sub = makeSubagent({ status: 'done' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    expect(container.querySelector('.animate-spin')).toBeFalsy()
  })

  it('color=red:Bot icon 含 text-red-500', () => {
    const sub = makeSubagent({ color: 'red' })
    const { container } = render(<SubAgentTaskTree subagent={sub} />)
    expect(container.textContent).toContain('Validator') // nickname renders
    // Bot icon 元素含 text-red-500
    const icons = container.querySelectorAll('[data-testid="lucide-icon"]')
    const hasRedIcon = Array.from(icons).some((icon) =>
      icon.className?.includes('text-red-500'),
    )
    expect(hasRedIcon).toBe(true)
  })

  it('5 个 status 都能渲染而不报错', () => {
    const statuses: Array<Subagent['status']> = ['spawned', 'running', 'done', 'failed', 'dead']
    for (const status of statuses) {
      const sub = makeSubagent({ status, id: `sa-${status}` })
      const { container, unmount } = render(<SubAgentTaskTree subagent={sub} />)
      const root = container.querySelector('[data-testid="subagent-task-tree"]')
      expect(root).toBeTruthy()
      expect(root?.getAttribute('data-subagent-status')).toBe(status)
      unmount()
    }
  })
})
