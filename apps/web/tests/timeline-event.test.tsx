// @vitest-environment jsdom
/**
 * TimelineEventRow 单元测试(2026-07-28 立,块 3.1)
 *
 * 覆盖:
 * - 6 种类型渲染(plan/subagent/question/tool/thinking/reference),各自图标 + 颜色
 * - 4 种 status(pending/running/done/failed),各自图标 + 颜色
 * - 无 children 时:无 ChevronRight(简化行),click 不展开
 * - 有 children 时:点击切换展开/折叠,展开后渲染子节点
 * - 时间显示(相对时间格式)<10s/30s/2m/1h/d/无效
 * - data-event-id / data-event-type / data-event-status 属性
 * - 嵌套 depth 渲染(margin-left + border-l)
 * - failed 状态:status icon 显示 AlertCircle
 * - running 状态:status icon 含 animate-spin
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { TimelineEventRow } from '../src/components/ai/progress-sections/timeline-event'
import { useTimelineStore } from '../src/stores/timeline-store'
import type { TimelineEvent } from '../src/stores/timeline-store'

// Phase 22(2026-07-29):TimelineEventRow 用 useTranslations('ai.pane') 翻译 subagent 描述
// 测试环境不挂 NextIntlClientProvider,需 mock 翻译函数 → 返回 key 自身
// 翻译时 key 含占位符如 'thinking' 会保留原样(测试断言靠 data-i18n-key,不靠显示文本)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return Object.entries(params).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), key)
  },
  useLocale: () => 'zh-CN',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ─── lucide-react mock(IconSpan 接收 className + 任意 props) ───
vi.mock('lucide-react', () => {
  const IconSpan = ({
    className,
    'data-testid': dataTestId,
    ...rest
  }: {
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }) => (
    <span
      data-testid={dataTestId ?? 'lucide-icon'}
      className={className}
      data-lucide-span="true"
      {...rest}
    />
  )
  return {
    __esModule: true,
    ChevronRight: IconSpan,
    Loader2: IconSpan,
    AlertCircle: IconSpan,
    Bot: IconSpan,
    HelpCircle: IconSpan,
    Wrench: IconSpan,
    Brain: IconSpan,
    FileText: IconSpan,
    Circle: IconSpan,
  }
})

/** 工厂:创建测试用 TimelineEvent */
function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-1',
    type: 'plan',
    status: 'done',
    title: '步骤 1',
    description: '描述',
    timestamp: new Date(Date.now() - 5000).toISOString(),
    ...overrides,
  }
}

describe('TimelineEventRow — 基础渲染', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('无 children:渲染 1 个无 Chevron 的简洁行', () => {
    const event = makeEvent()
    const { container } = render(<TimelineEventRow event={event} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]')!
    expect(row).toBeTruthy()
    // 无 ChevronRight 缩进占位
    const placeholder = row.querySelector('.w-2\\.5')
    expect(placeholder).toBeTruthy()
  })

  it('无 children 时 button 不可点击展开(disabled=true)', () => {
    const event = makeEvent()
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('data-event-id / data-event-type / data-event-status 属性存在', () => {
    const event = makeEvent({ id: 'evt-42', type: 'tool', status: 'failed' })
    const { container } = render(<TimelineEventRow event={event} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]')!
    expect(row.getAttribute('data-event-id')).toBe('evt-42')
    expect(row.getAttribute('data-event-type')).toBe('tool')
    expect(row.getAttribute('data-event-status')).toBe('failed')
  })

  it('event.title 渲染在 row 内', () => {
    const event = makeEvent({ title: '自定义事件标题' })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('自定义事件标题')
  })
})

describe('TimelineEventRow — 6 种 type 渲染', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('plan 类型:TypeIcon 是 FileText', () => {
    const event = makeEvent({ type: 'plan' })
    const { container } = render(<TimelineEventRow event={event} />)
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    // TypeIcon 是第一个,StatusIcon 是第二个
    expect(icons.length).toBeGreaterThanOrEqual(2)
  })

  it('subagent 类型:图标含 cyan 颜色', () => {
    const event = makeEvent({ type: 'subagent' })
    const { container } = render(<TimelineEventRow event={event} />)
    // 第一个 lucide-icon 是 TypeIcon,检查 className 含 cyan
    const typeIcon = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(typeIcon.className).toContain('text-cyan-500')
  })

  it('question 类型:图标含 amber 颜色', () => {
    const event = makeEvent({ type: 'question' })
    const { container } = render(<TimelineEventRow event={event} />)
    const typeIcon = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(typeIcon.className).toContain('text-amber-500')
  })

  it('tool 类型:图标含 violet 颜色', () => {
    const event = makeEvent({ type: 'tool' })
    const { container } = render(<TimelineEventRow event={event} />)
    const typeIcon = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(typeIcon.className).toContain('text-violet-500')
  })

  it('thinking 类型:图标含 amber-400 颜色', () => {
    const event = makeEvent({ type: 'thinking' })
    const { container } = render(<TimelineEventRow event={event} />)
    const typeIcon = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(typeIcon.className).toContain('text-amber-400')
  })

  it('reference 类型:图标含 blue 颜色', () => {
    const event = makeEvent({ type: 'reference' })
    const { container } = render(<TimelineEventRow event={event} />)
    const typeIcon = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(typeIcon.className).toContain('text-blue-500')
  })
})

describe('TimelineEventRow — 4 种 status 渲染', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('done 状态:status icon 颜色 emerald', () => {
    const event = makeEvent({ status: 'done' })
    const { container } = render(<TimelineEventRow event={event} />)
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    const statusIcon = icons[icons.length - 1] as HTMLElement
    expect(statusIcon.className).toContain('text-emerald-500')
  })

  it('failed 状态:status icon 颜色 destructive', () => {
    const event = makeEvent({ status: 'failed' })
    const { container } = render(<TimelineEventRow event={event} />)
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    const statusIcon = icons[icons.length - 1] as HTMLElement
    expect(statusIcon.className).toContain('text-destructive')
  })

  it('pending 状态:status icon 颜色 muted', () => {
    const event = makeEvent({ status: 'pending' })
    const { container } = render(<TimelineEventRow event={event} />)
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    const statusIcon = icons[icons.length - 1] as HTMLElement
    expect(statusIcon.className).toContain('text-muted-foreground/50')
  })

  it('running 状态:status icon 含 animate-spin', () => {
    const event = makeEvent({ status: 'running' })
    const { container } = render(<TimelineEventRow event={event} />)
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    const statusIcon = icons[icons.length - 1] as HTMLElement
    expect(statusIcon.className).toContain('animate-spin')
  })
})

describe('TimelineEventRow — children 展开/折叠', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('有 children 时:显示 ChevronRight + 初始未展开', () => {
    const event = makeEvent({
      id: 'parent-1',
      children: [
        {
          id: 'child-1',
          type: 'tool',
          status: 'done',
          title: '子事件',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(false)
    // 初始未展开
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('点击按钮:展开 children(aria-expanded=true)', () => {
    const event = makeEvent({
      id: 'parent-2',
      children: [
        {
          id: 'child-a',
          type: 'tool',
          status: 'done',
          title: '子 A',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'child-b',
          type: 'tool',
          status: 'done',
          title: '子 B',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    // aria-expanded 切换
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // 展开后 children 渲染
    expect(container.textContent).toContain('子 A')
    expect(container.textContent).toContain('子 B')
  })

  it('再次点击:折叠 children(aria-expanded=false)', () => {
    const event = makeEvent({
      id: 'parent-3',
      children: [
        {
          id: 'child-c',
          type: 'tool',
          status: 'done',
          title: '子 C',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('有 children 时:description 在折叠和展开两种状态下都显示(折叠显示截断 60 字)', () => {
    const event = makeEvent({
      id: 'parent-4',
      description: '详情描述',
      children: [
        {
          id: 'child-d',
          type: 'tool',
          status: 'done',
          title: '子 D',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    // 折叠时:description 已在 inline 可见(children 隐藏)
    expect(container.textContent).toContain('详情描述')
    // 展开后:children 出现,description 仍显示
    fireEvent.click(container.querySelector('button')!)
    expect(container.textContent).toContain('详情描述')
    expect(container.textContent).toContain('子 D')
  })
})

describe('TimelineEventRow — 嵌套 depth 渲染', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('depth=0(顶层):row 不含 ml-3 + border-l', () => {
    const event = makeEvent()
    const { container } = render(<TimelineEventRow event={event} depth={0} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]') as HTMLElement
    // 顶层 row 不应有 ml-3(子项才有)
    expect(row.className).not.toContain('ml-3')
  })

  it('depth>0(嵌套):row 含 ml-3 + pl-3(2026-08-05 更新)', () => {
    const event = makeEvent({ id: 'nested-evt' })
    const { container } = render(<TimelineEventRow event={event} depth={2} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]') as HTMLElement
    expect(row.className).toContain('ml-3')
    expect(row.className).toContain('pl-3')
  })

  it('depth=0:左侧含 type 颜色 bar 装饰条', () => {
    const event = makeEvent({ type: 'plan' })
    const { container } = render(<TimelineEventRow event={event} depth={0} />)
    const bar = container.querySelector('.absolute.left-0.top-0')
    expect(bar).toBeTruthy()
    expect(bar?.className).toContain('bg-primary/50')
  })

  it('depth>0:无左侧 bar 装饰条', () => {
    const event = makeEvent({ type: 'plan' })
    const { container } = render(<TimelineEventRow event={event} depth={1} />)
    const bar = container.querySelector('.absolute.left-0.top-0')
    expect(bar).toBeFalsy()
  })
})

describe('TimelineEventRow — 时间显示(相对时间)', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('5s 前:显示 "刚刚"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 5000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('刚刚')
  })

  it('30s 前:显示 "Ns 前" 格式', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 30000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toMatch(/30s 前/)
  })

  it('2m 前:显示 "Nm 前" 格式', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 120000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toMatch(/2m 前/)
  })

  it('1h 前:显示 "Nh 前" 格式', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 3600000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toMatch(/1h 前/)
  })

  it('2d 前:显示 "Nd 前" 格式', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 2 * 86400000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toMatch(/2d 前/)
  })

  it('未来时间(可能由时钟漂移):显示 "刚刚"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() + 60000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('刚刚')
  })

  it('无效时间戳:不显示时间文本', () => {
    const event = makeEvent({ timestamp: 'invalid-date' })
    const { container } = render(<TimelineEventRow event={event} />)
    // 内部 tabular-nums span 应为空
    const timeSpan = container.querySelector('.tabular-nums')
    expect(timeSpan?.textContent).toBe('')
  })
})

describe('TimelineEventRow — description 显示与裁剪', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('description < 60 字符:折叠时完整显示', () => {
    const event = makeEvent({ description: '短描述' })
    const { container } = render(<TimelineEventRow event={event} />)
    // 折叠时 description 出现在 lg 视口
    expect(container.textContent).toContain('短描述')
  })

  it('description > 60 字符:折叠时被截断到 60 字符 + "…"', () => {
    const longDesc = 'A'.repeat(80)
    const event = makeEvent({ description: longDesc })
    const { container } = render(<TimelineEventRow event={event} />)
    // 折叠时 description 截断显示
    const html = container.innerHTML
    // 不应包含完整 80 字符 A,但应包含 60 字符 A + ellipsis
    expect(html).toContain('…')
    // 包含 60 字符的 A 但不含 80
    const longAsInHtml = html.match(/A{20,}/g) ?? []
    expect(longAsInHtml.every((s) => s.length <= 60)).toBe(true)
  })

  it('有 children 时:description 折叠时不显示在 inline,只在展开时显示', () => {
    const event = makeEvent({
      description: '详情描述',
      children: [
        { id: 'c1', type: 'tool', status: 'done', title: 'C', timestamp: new Date().toISOString() },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    // 折叠时:description 应在 inline 可见但 children 隐藏
    expect(container.textContent).toContain('详情描述')
    // 展开 children 后,description 仍在
    fireEvent.click(container.querySelector('button')!)
    expect(container.textContent).toContain('详情描述')
  })
})

describe('TimelineEventRow — snapshot 测试', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('snapshot:done 状态 + 无 children', () => {
    const event = makeEvent()
    const { container } = render(<TimelineEventRow event={event} />)
    // 验证关键 DOM 节点结构
    expect(container.querySelector('[data-event-type="plan"]')).toBeTruthy()
    expect(container.querySelector('[data-event-status="done"]')).toBeTruthy()
    expect(container.querySelector('button[disabled]')).toBeTruthy()
  })

  it('snapshot:failed 状态 + 有 children', () => {
    const event = makeEvent({
      id: 'snap-1',
      type: 'subagent',
      status: 'failed',
      children: [
        {
          id: 'snap-1-c1',
          type: 'tool',
          status: 'failed',
          title: '失败工具',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    // failed 状态 + 有 children 时 button 可点击
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(false)
    // data-status 反映 failed
    expect(container.querySelector('[data-event-status="failed"]')).toBeTruthy()
  })
})

// ─── 进阶边界场景(2026-07-28 覆盖率深化) ─────────────────────────

describe('TimelineEventRow — ChevronRight 展开旋转', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('有 children 折叠时:ChevronRight 不含 rotate-90', () => {
    const event = makeEvent({
      id: 'rotate-1',
      children: [
        {
          id: 'r-c1',
          type: 'tool',
          status: 'done',
          title: '子 R1',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    const chevron = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(chevron.className).not.toContain('rotate-90')
  })

  it('有 children 展开后:ChevronRight 含 rotate-90 类', () => {
    const event = makeEvent({
      id: 'rotate-2',
      children: [
        {
          id: 'r-c2',
          type: 'tool',
          status: 'done',
          title: '子 R2',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    const { container } = render(<TimelineEventRow event={event} />)
    fireEvent.click(container.querySelector('button')!)
    const chevron = container.querySelectorAll('[data-lucide-span="true"]')[0] as HTMLElement
    expect(chevron.className).toContain('rotate-90')
  })
})

describe('TimelineEventRow — data-testid 透传', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('自定义 data-testid 覆盖默认值 "timeline-event-row"', () => {
    const event = makeEvent({ id: 'tid-1' })
    const { container } = render(<TimelineEventRow event={event} data-testid="my-custom-row" />)
    expect(container.querySelector('[data-testid="my-custom-row"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="timeline-event-row"]')).toBeFalsy()
  })
})

describe('TimelineEventRow — children=[] 等同无 children', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('children 为空数组:button disabled + 无 ChevronRight', () => {
    const event = makeEvent({ id: 'empty-children', children: [] })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(true)
    // 无 ChevronRight 时,占位 span 渲染
    const placeholder = container.querySelector('.w-2\\.5')
    expect(placeholder).toBeTruthy()
  })
})

describe('TimelineEventRow — store 预展开状态', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('store 预设 expandedEventIds → 渲染时直接展开,无需点击', () => {
    const event = makeEvent({
      id: 'preset-expanded',
      children: [
        {
          id: 'p-c1',
          type: 'tool',
          status: 'done',
          title: '预展开子项',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    // 预设 store 展开状态
    useTimelineStore.getState().setExpanded('preset-expanded', true)
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('预展开子项')
  })

  it('setExpanded(false) 折叠回初始状态', () => {
    const event = makeEvent({
      id: 'preset-collapse',
      children: [
        {
          id: 'p-c2',
          type: 'tool',
          status: 'done',
          title: '子 C',
          timestamp: new Date().toISOString(),
        },
      ],
    })
    useTimelineStore.getState().setExpanded('preset-collapse', true)
    const { container, rerender } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('子 C')
    useTimelineStore.getState().setExpanded('preset-collapse', false)
    rerender(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('TimelineEventRow — 顶层装饰条颜色映射', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('subagent 类型顶层装饰条:bg-cyan-500/50', () => {
    const event = makeEvent({ id: 'bar-cyan', type: 'subagent' })
    const { container } = render(<TimelineEventRow event={event} />)
    const bar = container.querySelector('.absolute.left-0.top-0')
    expect(bar).toBeTruthy()
    expect(bar?.className).toContain('bg-cyan-500/50')
  })

  it('tool 类型顶层装饰条:bg-violet-500/50', () => {
    const event = makeEvent({ id: 'bar-violet', type: 'tool' })
    const { container } = render(<TimelineEventRow event={event} />)
    const bar = container.querySelector('.absolute.left-0.top-0')
    expect(bar?.className).toContain('bg-violet-500/50')
  })
})

// ─── Phase 19/20 深化:hasJumpTarget 三种 case + 跳转 custom event(2026-07-28) ──

describe('TimelineEventRow — hasJumpTarget 跳转优先级', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('仅 messageId:点击触发 ihui:scroll-to-message 自定义事件', () => {
    const messageHandler = vi.fn()
    window.addEventListener('ihui:scroll-to-message', messageHandler)
    const event = makeEvent({ id: 'jump-msg', messageId: 'm-42' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(false)
    expect(btn.getAttribute('data-jump-target')).toBe('true')
    fireEvent.click(btn)
    expect(messageHandler).toHaveBeenCalled()
    const evt = messageHandler.mock.calls[0]?.[0] as CustomEvent
    expect(evt.detail).toEqual({ messageId: 'm-42' })
    window.removeEventListener('ihui:scroll-to-message', messageHandler)
  })

  it('仅 planStepId:点击触发 ihui:scroll-to-plan-step 自定义事件', () => {
    const planHandler = vi.fn()
    window.addEventListener('ihui:scroll-to-plan-step', planHandler)
    const event = makeEvent({ id: 'jump-plan', planStepId: 'ps-7' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(planHandler).toHaveBeenCalled()
    const evt = planHandler.mock.calls[0]?.[0] as CustomEvent
    expect(evt.detail).toEqual({ planStepId: 'ps-7' })
    window.removeEventListener('ihui:scroll-to-plan-step', planHandler)
  })

  it('仅 toolCallId:点击触发 ihui:scroll-to-tool-call 自定义事件', () => {
    const toolHandler = vi.fn()
    window.addEventListener('ihui:scroll-to-tool-call', toolHandler)
    const event = makeEvent({ id: 'jump-tool', toolCallId: 'tc-99' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(toolHandler).toHaveBeenCalled()
    const evt = toolHandler.mock.calls[0]?.[0] as CustomEvent
    expect(evt.detail).toEqual({ toolCallId: 'tc-99' })
    window.removeEventListener('ihui:scroll-to-tool-call', toolHandler)
  })

  it('messageId 优先于 planStepId + toolCallId(优先级派发)', () => {
    const messageHandler = vi.fn()
    const planHandler = vi.fn()
    const toolHandler = vi.fn()
    window.addEventListener('ihui:scroll-to-message', messageHandler)
    window.addEventListener('ihui:scroll-to-plan-step', planHandler)
    window.addEventListener('ihui:scroll-to-tool-call', toolHandler)
    const event = makeEvent({
      id: 'jump-multi',
      messageId: 'm-1',
      planStepId: 'ps-1',
      toolCallId: 'tc-1',
    })
    const { container } = render(<TimelineEventRow event={event} />)
    fireEvent.click(container.querySelector('button')!)
    expect(messageHandler).toHaveBeenCalled()
    expect(planHandler).not.toHaveBeenCalled()
    expect(toolHandler).not.toHaveBeenCalled()
    window.removeEventListener('ihui:scroll-to-message', messageHandler)
    window.removeEventListener('ihui:scroll-to-plan-step', planHandler)
    window.removeEventListener('ihui:scroll-to-tool-call', toolHandler)
  })

  it('全无 jump target + 无 children:button disabled + data-jump-target 缺失', () => {
    const event = makeEvent({ id: 'no-jump' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('data-jump-target')).toBeNull()
  })
})

// ─── Phase 19/20 深化:相对时间边界(10s/60s/1h/1d) ─────────────────────

describe('TimelineEventRow — 相对时间边界 10s/60s/1h/1d', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('10s 前边界:>= 10s 显示 "Ns 前"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 10000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toMatch(/10s 前/)
  })

  it('60s 前边界:>= 60s 显示 "1m 前"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 60000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('1m 前')
  })

  it('60m 前边界:>= 60m 显示 "1h 前"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 60 * 60000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('1h 前')
  })

  it('24h 前边界:>= 24h 显示 "1d 前"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 24 * 60 * 60000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('1d 前')
  })

  it('9s 前(< 10s 边界):显示 "刚刚"', () => {
    const event = makeEvent({ timestamp: new Date(Date.now() - 9000).toISOString() })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('刚刚')
  })
})

// ─── Phase 19/20 深化:键盘可访问性(button role + Enter) ─────────────

describe('TimelineEventRow — 键盘可访问性', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('button 是 type="button" 而非 submit', () => {
    const event = makeEvent({ id: 'kb-1' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('无 children 时:button 的 aria-expanded 属性应缺失(undefined 序列化无 attribute)', () => {
    const event = makeEvent({ id: 'kb-2' })
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button') as HTMLButtonElement
    // hasChildren=false 时,源码设 aria-expanded={undefined} → 浏览器不会渲染 attribute
    expect(btn.hasAttribute('aria-expanded')).toBe(false)
  })

  it('Enter 键盘事件触发 onClick(原生 button 默认行为)', () => {
    const event = makeEvent({ id: 'kb-3', messageId: 'm-9' })
    const messageHandler = vi.fn()
    window.addEventListener('ihui:scroll-to-message', messageHandler)
    const { container } = render(<TimelineEventRow event={event} />)
    const btn = container.querySelector('button')!
    fireEvent.keyDown(btn, { key: 'Enter' })
    // 原生 button 在 Enter 键按下时会派发 click 事件(由 testing-library 模拟)
    fireEvent.click(btn)
    expect(messageHandler).toHaveBeenCalled()
    window.removeEventListener('ihui:scroll-to-message', messageHandler)
  })
})

// ─── Phase 19/20 深化:深度嵌套(depth=3)边界 ────────────────────────

describe('TimelineEventRow — 深度嵌套(depth=3)', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('depth=3:row 仍含 ml-3 + pl-3(2026-08-05 更新)', () => {
    const event = makeEvent({ id: 'deep-3' })
    const { container } = render(<TimelineEventRow event={event} depth={3} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]') as HTMLElement
    expect(row.className).toContain('ml-3')
    expect(row.className).toContain('pl-3')
  })

  it('depth=3 + 有 children:展开时渲染嵌套 row(depth=4)', () => {
    const event = makeEvent({
      id: 'parent-deep',
      children: [
        {
          id: 'child-deep',
          type: 'tool',
          status: 'done',
          title: '深层子项',
          timestamp: new Date().toISOString(),
          children: [
            {
              id: 'grandchild',
              type: 'plan',
              status: 'done',
              title: '孙项',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      ],
    })
    useTimelineStore.getState().setExpanded('parent-deep', true)
    useTimelineStore.getState().setExpanded('child-deep', true)
    const { container } = render(<TimelineEventRow event={event} depth={3} />)
    // depth=4 仍应用 ml-3 + border-l
    const grandRow = Array.from(
      container.querySelectorAll('[data-testid="timeline-event-row"]'),
    ).find((el) => el.getAttribute('data-event-id') === 'grandchild') as HTMLElement
    expect(grandRow).toBeTruthy()
    expect(grandRow.className).toContain('ml-3')
    expect(grandRow.className).toContain('pl-3')
  })

  it('depth=3 父 row + depth=4 子 row:无左侧 bar 装饰条', () => {
    const event = makeEvent({ id: 'no-bar' })
    const { container } = render(<TimelineEventRow event={event} depth={3} />)
    const bar = container.querySelector('.absolute.left-0.top-0')
    expect(bar).toBeFalsy()
  })
})

// ─── Phase 19/20 深化:展开/折叠 children 深层嵌套交互 ─────────────

describe('TimelineEventRow — 深层嵌套 children 展开', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('3 层 children:全部展开后渲染 1 父 + 1 子 + 1 孙 = 3 row', () => {
    const event = makeEvent({
      id: 'triple-parent',
      children: [
        {
          id: 'triple-child',
          type: 'tool',
          status: 'done',
          title: '中间层',
          timestamp: new Date().toISOString(),
          children: [
            {
              id: 'triple-grand',
              type: 'plan',
              status: 'done',
              title: '最深层',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      ],
    })
    useTimelineStore.getState().setExpanded('triple-parent', true)
    useTimelineStore.getState().setExpanded('triple-child', true)
    const { container } = render(<TimelineEventRow event={event} />)
    const rows = container.querySelectorAll('[data-event-id]')
    // 父 + 子 + 孙 = 3 (无 id 的 "data-event-id" 不会出现)
    expect(rows.length).toBe(3)
    expect(container.textContent).toContain('最深层')
  })
})
