// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

// ─── next-intl mock:动态 key 缺失时返回 key 本身(模拟生产环境行为) ──
const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    // 已存在的 ai.pane.* key(沿用 agent-task-progress-pane.test.tsx 已有映射)
    title: '任务计划',
    ariaLabel: 'Agent 任务进度面板',
    pin: '置顶',
    unpin: '取消置顶',
    minimize: '最小化',
    expandAll: '展开全部',
    collapseAll: '折叠全部',
  }
  const mockT = (key: string, params?: Record<string, unknown>) => {
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(`{${k}}`, String(val))
      }
    }
    return v
  }
  return { mockT }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// ─── lucide-react mock:用 span 替代(沿用现有测试模式) ──────────────
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return { IconSpan }
})
vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const mocked: Record<string, unknown> = { __esModule: true }
  for (const key of Object.keys(actual)) {
    mocked[key] = IconSpan
  }
  return mocked
})

import {
  TimelineTab,
  flattenToTimelineEvents,
} from '../src/components/ai/progress-sections/timeline-tab'
import { useTimelineStore, type TimelineEvent } from '../src/stores/timeline-store'

// ─── 工具函数:构造测试事件 ──────────────────────────────────────
function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 9)}`,
    type: overrides.type ?? 'plan',
    timestamp: overrides.timestamp ?? '2026-07-28T10:00:00Z',
    title: overrides.title ?? 'test event',
    description: overrides.description,
    status: overrides.status ?? 'pending',
    messageId: overrides.messageId,
    planStepId: overrides.planStepId,
    toolCallId: overrides.toolCallId,
    children: overrides.children,
    meta: overrides.meta,
  }
}

const SAMPLE_EVENTS: TimelineEvent[] = [
  makeEvent({
    id: 'p1',
    type: 'plan',
    title: 'Plan step alpha',
    status: 'done',
    timestamp: '2026-07-28T10:00:00Z',
  }),
  makeEvent({
    id: 'p2',
    type: 'plan',
    title: 'Plan step beta',
    status: 'pending',
    timestamp: '2026-07-28T10:01:00Z',
  }),
  makeEvent({
    id: 's1',
    type: 'subagent',
    title: '@validator · 验证类型',
    status: 'running',
    timestamp: '2026-07-28T10:02:00Z',
  }),
  makeEvent({
    id: 's2',
    type: 'subagent',
    title: '@reviewer · 审查代码',
    status: 'done',
    timestamp: '2026-07-28T10:03:00Z',
  }),
  makeEvent({
    id: 't1',
    type: 'tool',
    title: 'read_file',
    description: 'src/components/Button.tsx',
    status: 'done',
    timestamp: '2026-07-28T10:04:00Z',
  }),
  makeEvent({
    id: 't2',
    type: 'tool',
    title: 'edit_file',
    description: 'src/lib/utils.ts',
    status: 'failed',
    timestamp: '2026-07-28T10:05:00Z',
  }),
  makeEvent({
    id: 'q1',
    type: 'question',
    title: '是否继续?',
    status: 'pending',
    timestamp: '2026-07-28T10:06:00Z',
  }),
]

// ─── 每个测试前后重置 store ──────────────────────────────────────
beforeEach(() => {
  useTimelineStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

// ─── showTabs=true 基础渲染 ──────────────────────────────────────
describe('TimelineTab — showTabs=true 基础渲染', () => {
  it('无事件时:只渲染 tab bar + empty text', () => {
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-tab')).toBeTruthy()
    expect(screen.getByTestId('timeline-tab-inline')).toBeTruthy()
    expect(screen.getByTestId('timeline-tab-timeline')).toBeTruthy()
    // 默认 activeTab=inline
    expect(screen.getByTestId('timeline-inline-hint')).toBeTruthy()
    // total count 不显示
    expect(screen.queryByTestId('timeline-total-count')).toBeNull()
    // filter row / search row 不显示
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
    expect(screen.queryByTestId('timeline-search-row')).toBeNull()
  })

  it('有事件但 activeTab=inline:不渲染 filter/search 也不渲染事件列表(只显示 inline hint)', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-inline-hint')).toBeTruthy()
    // filter row 显示(因为有 events)
    expect(screen.getByTestId('timeline-filter-row')).toBeTruthy()
    // 事件列表不显示(因为 active tab 是 inline)
    expect(screen.queryByTestId('timeline-events')).toBeNull()
  })

  it('有事件且 activeTab=timeline:渲染 filter row + search row + 事件列表', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-filter-row')).toBeTruthy()
    expect(screen.getByTestId('timeline-search-row')).toBeTruthy()
    expect(screen.getByTestId('timeline-events')).toBeTruthy()
  })

  it('tab bar 总数徽章显示 events.length', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    render(<TimelineTab />)
    const badge = screen.getByTestId('timeline-total-count')
    expect(badge.textContent).toBe('7')
  })

  it('tab 切换:点击 inline/timeline 切换 activeTab', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    render(<TimelineTab />)
    const inlineTab = screen.getByTestId('timeline-tab-inline')
    const timelineTab = screen.getByTestId('timeline-tab-timeline')
    // 默认 inline active
    expect(inlineTab.getAttribute('aria-selected')).toBe('true')
    // 切到 timeline
    fireEvent.click(timelineTab)
    expect(useTimelineStore.getState().activeTab).toBe('timeline')
    expect(timelineTab.getAttribute('aria-selected')).toBe('true')
    expect(inlineTab.getAttribute('aria-selected')).toBe('false')
    // 切回 inline
    fireEvent.click(inlineTab)
    expect(useTimelineStore.getState().activeTab).toBe('inline')
  })

  it('timeline tab 内容区 id 与 aria-controls 联动', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    const timelineTab = screen.getByTestId('timeline-tab-timeline')
    expect(timelineTab.getAttribute('aria-controls')).toBe('tab-panel-timeline')
  })
})

// ─── showTabs=false 向后兼容(agent-task-progress-pane 调用) ─────
describe('TimelineTab — showTabs=false 向后兼容', () => {
  it('无事件:渲染 empty text(默认 "暂无事件")', () => {
    render(<TimelineTab showTabs={false} />)
    expect(screen.getByText('暂无事件')).toBeTruthy()
  })

  it('有事件:只渲染事件列表,不渲染 tab bar / filter / search', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    render(<TimelineTab showTabs={false} />)
    // 事件列表显示
    expect(screen.getByTestId('timeline-events')).toBeTruthy()
    // tab bar / filter / search 都不显示
    expect(screen.queryByTestId('timeline-tab-inline')).toBeNull()
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
    expect(screen.queryByTestId('timeline-search-row')).toBeNull()
  })

  it('自定义 emptyText 生效', () => {
    render(<TimelineTab showTabs={false} emptyText="自定义空态" />)
    expect(screen.getByText('自定义空态')).toBeTruthy()
  })

  it('className 透传到根容器', () => {
    render(<TimelineTab showTabs={false} className="custom-cls" />)
    const events = screen.getByTestId('timeline-events')
    expect(events.className).toContain('custom-cls')
  })
})

// ─── 类型过滤 chips ────────────────────────────────────────────
describe('TimelineTab — 类型过滤 chips', () => {
  beforeEach(() => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
  })

  it('渲染 5 个 chips:all / plan / subagent / tool / thinking', () => {
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-filter-all')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-plan')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-subagent')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-tool')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-thinking')).toBeTruthy()
  })

  it('默认 all chip 为 active(aria-pressed=true)', () => {
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-filter-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-filter-plan').getAttribute('aria-pressed')).toBe('false')
  })

  it('chip count 反映该 type 的事件数(all=总数,plan=2,subagent=2,tool=2,thinking=0)', () => {
    render(<TimelineTab />)
    const all = screen.getByTestId('timeline-filter-all')
    const plan = screen.getByTestId('timeline-filter-plan')
    const subagent = screen.getByTestId('timeline-filter-subagent')
    const tool = screen.getByTestId('timeline-filter-tool')
    const thinking = screen.getByTestId('timeline-filter-thinking')
    // 7 = 2 plan + 2 subagent + 2 tool + 1 question;SAMPLE_EVENTS 无 thinking → 0
    expect(within(all).getByText('7')).toBeTruthy()
    expect(within(plan).getByText('2')).toBeTruthy()
    expect(within(subagent).getByText('2')).toBeTruthy()
    expect(within(tool).getByText('2')).toBeTruthy()
    expect(within(thinking).getByText('0')).toBeTruthy()
  })

  it('点击 plan chip 后只显示 plan 事件,且 aria-pressed 切换', () => {
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-plan'))
    expect(screen.getByTestId('timeline-filter-plan').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-filter-all').getAttribute('aria-pressed')).toBe('false')
    // 事件列表中只剩 p1, p2
    const eventRows = document.querySelectorAll('[data-event-type="plan"]')
    expect(eventRows.length).toBe(2)
    expect(document.querySelectorAll('[data-event-type="subagent"]').length).toBe(0)
  })

  it('点击 thinking chip 后显示空态', () => {
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-thinking'))
    expect(screen.getByTestId('timeline-no-match')).toBeTruthy()
  })

  it('点击 tool chip 后只显示 tool 事件', () => {
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-tool'))
    const eventRows = document.querySelectorAll('[data-event-type="tool"]')
    expect(eventRows.length).toBe(2)
  })

  it('无该 type 事件时,chip count=0 但仍渲染(用户可点击看到 0 匹配的空态)', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'p1', type: 'plan', status: 'done' })])
    render(<TimelineTab />)
    expect(within(screen.getByTestId('timeline-filter-thinking')).getByText('0')).toBeTruthy()
  })
})

// ─── 搜索 ────────────────────────────────────────────────────
describe('TimelineTab — 搜索', () => {
  beforeEach(() => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
  })

  it('search input 默认存在且空', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('')
  })

  it('输入关键词后按 title 过滤', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'alpha' } })
    // 只剩 p1(Plan step alpha)
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(1)
    const [first] = Array.from(eventRows)
    expect(first?.getAttribute('data-event-id')).toBe('p1')
  })

  it('搜索按 description 也匹配(edit_file 的 description 含 "utils.ts")', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'utils.ts' } })
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(1)
    const [first] = Array.from(eventRows)
    expect(first?.getAttribute('data-event-id')).toBe('t2')
  })

  it('搜索 case-insensitive', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'ALPHA' } })
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(1)
  })

  it('空查询 / 纯空白 不过滤', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: '   ' } })
    // 7 个事件全部显示
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(7)
  })

  it('搜索无匹配时显示 "no match" + clear filters 按钮', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'nonexistent_keyword_xyz' } })
    expect(screen.getByTestId('timeline-no-match')).toBeTruthy()
    expect(screen.getByTestId('timeline-clear-filters')).toBeTruthy()
  })

  it('清空按钮 (X) 出现条件:有 query 才显示', () => {
    render(<TimelineTab />)
    expect(screen.queryByTestId('timeline-search-clear')).toBeNull()
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'a' } })
    expect(screen.getByTestId('timeline-search-clear')).toBeTruthy()
  })

  it('点击清空按钮清空 query 并恢复事件列表', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input')
    fireEvent.change(input, { target: { value: 'alpha' } })
    fireEvent.click(screen.getByTestId('timeline-search-clear'))
    expect((input as HTMLInputElement).value).toBe('')
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(7)
  })

  it('搜索 + type 过滤叠加:点击 plan chip + 搜索 "alpha" → 只剩 p1', () => {
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-plan'))
    fireEvent.change(screen.getByTestId('timeline-search-input'), { target: { value: 'alpha' } })
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(1)
    const [first] = Array.from(eventRows)
    expect(first?.getAttribute('data-event-id')).toBe('p1')
  })
})

// ─── 状态计数 chips ────────────────────────────────────────────
describe('TimelineTab — 状态计数 chips', () => {
  beforeEach(() => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
  })

  it('done=3(p1/s2/t1) failed=1(t2) running=1(s1) pending=2(p2/q1)', () => {
    render(<TimelineTab />)
    // 检查每个计数 chip 的数字
    const doneCount = screen.getByTestId('timeline-count-done')
    const failedCount = screen.getByTestId('timeline-count-failed')
    const runningCount = screen.getByTestId('timeline-count-running')
    expect(within(doneCount).getByText('3')).toBeTruthy()
    expect(within(failedCount).getByText('1')).toBeTruthy()
    expect(within(runningCount).getByText('1')).toBeTruthy()
  })

  it('count=0 的 status 不渲染对应 chip', () => {
    // 全 done 场景:failed=0, running=0
    useTimelineStore
      .getState()
      .setEvents([
        makeEvent({ id: 'a', type: 'plan', status: 'done' }),
        makeEvent({ id: 'b', type: 'tool', status: 'done' }),
      ])
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-count-done')).toBeTruthy()
    expect(screen.queryByTestId('timeline-count-failed')).toBeNull()
    expect(screen.queryByTestId('timeline-count-running')).toBeNull()
  })

  it('只有 pending 时:done/failed/running chip 都不渲染', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'a', type: 'plan', status: 'pending' })])
    render(<TimelineTab />)
    expect(screen.queryByTestId('timeline-count-done')).toBeNull()
    expect(screen.queryByTestId('timeline-count-failed')).toBeNull()
    expect(screen.queryByTestId('timeline-count-running')).toBeNull()
  })

  it('状态计数 chip 含 tooltip(title 属性)', () => {
    render(<TimelineTab />)
    const done = screen.getByTestId('timeline-count-done')
    expect(done.getAttribute('title')).toBeTruthy()
    expect(done.getAttribute('title')!.length).toBeGreaterThan(0)
  })
})

// ─── 空态增强(filter 后无匹配) ─────────────────────────────────
describe('TimelineTab — 过滤后空态增强', () => {
  beforeEach(() => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
  })

  it('无任何事件:显示 emptyText(默认 "暂无事件")', () => {
    useTimelineStore.getState().setEvents([])
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-empty')).toBeTruthy()
    expect(screen.getByText('暂无事件')).toBeTruthy()
    // filter row / search row 都不显示
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
  })

  it('有事件但 typeFilter 过滤后无匹配:显示 "no match" + clear filters', () => {
    // 移除 thinking 事件,再点击 thinking chip
    useTimelineStore
      .getState()
      .setEvents([
        makeEvent({ id: 'p1', type: 'plan', status: 'done' }),
        makeEvent({ id: 'p2', type: 'plan', status: 'pending' }),
      ])
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-thinking'))
    expect(screen.getByTestId('timeline-no-match')).toBeTruthy()
    expect(screen.getByTestId('timeline-clear-filters')).toBeTruthy()
  })

  it('点击 clear filters 重置 typeFilter=all + searchQuery="" 并恢复事件', () => {
    useTimelineStore
      .getState()
      .setEvents([
        makeEvent({ id: 'p1', type: 'plan', title: 'alpha', status: 'done' }),
        makeEvent({ id: 'p2', type: 'plan', title: 'beta', status: 'pending' }),
        makeEvent({ id: 't1', type: 'tool', title: 'read_file', status: 'done' }),
      ])
    render(<TimelineTab />)
    // 触发过滤
    fireEvent.click(screen.getByTestId('timeline-filter-tool'))
    fireEvent.change(screen.getByTestId('timeline-search-input'), { target: { value: 'no_match' } })
    // 确认 no match 显示
    expect(screen.getByTestId('timeline-no-match')).toBeTruthy()
    // 点击 clear filters
    fireEvent.click(screen.getByTestId('timeline-clear-filters'))
    // 事件列表恢复
    const eventRows = document.querySelectorAll('[data-event-type]')
    expect(eventRows.length).toBe(3)
    // typeFilter 回到 all
    expect(screen.getByTestId('timeline-filter-all').getAttribute('aria-pressed')).toBe('true')
    // search input 清空
    expect((screen.getByTestId('timeline-search-input') as HTMLInputElement).value).toBe('')
  })

  it('filter all + 无 search:不显示 "no match"(永远有结果)', () => {
    render(<TimelineTab />)
    expect(screen.queryByTestId('timeline-no-match')).toBeNull()
  })
})

// ─── React.memo 优化保持 ───────────────────────────────────────
describe('TimelineTab — React.memo 优化', () => {
  it('同 props 二次渲染不重建(无 events 变化时,filter chip count 不重算)', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
    const { rerender } = render(<TimelineTab />)
    // 二次渲染同 props
    rerender(<TimelineTab />)
    // 事件列表仍正确
    expect(screen.getByTestId('timeline-events')).toBeTruthy()
  })

  it('events 变化时正确重渲染', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
    const { rerender } = render(<TimelineTab />)
    expect(document.querySelectorAll('[data-event-type]').length).toBe(7)
    // 修改 store events
    useTimelineStore.getState().setEvents([makeEvent({ id: 'a', type: 'plan', status: 'done' })])
    rerender(<TimelineTab />)
    expect(document.querySelectorAll('[data-event-type]').length).toBe(1)
  })
})

// ─── flattenToTimelineEvents 单测 ───────────────────────────────
describe('flattenToTimelineEvents', () => {
  it('空输入返回空数组', () => {
    expect(flattenToTimelineEvents({})).toEqual([])
  })

  it('plan status 映射:in_progress → running, completed → done, 其他 → pending', () => {
    const events = flattenToTimelineEvents({
      plans: [
        { id: 'p1', step: 'a', status: 'in_progress', timestamp: '2026-07-28T10:00:00Z' },
        { id: 'p2', step: 'b', status: 'completed', timestamp: '2026-07-28T10:01:00Z' },
        { id: 'p3', step: 'c', status: 'pending', timestamp: '2026-07-28T10:02:00Z' },
        { id: 'p4', step: 'd', status: 'unknown', timestamp: '2026-07-28T10:03:00Z' },
      ],
    })
    expect(events.map((e) => e.status)).toEqual(['running', 'done', 'pending', 'pending'])
  })

  it('subagent status 映射:spawned/running → running, done → done, failed/dead → failed', () => {
    const events = flattenToTimelineEvents({
      subagents: [
        {
          id: 's1',
          nickname: 'n1',
          handle: '@h1',
          status: 'spawned',
          spawnedAt: '2026-07-28T10:00:00Z',
        },
        {
          id: 's2',
          nickname: 'n2',
          handle: '@h2',
          status: 'running',
          spawnedAt: '2026-07-28T10:01:00Z',
        },
        {
          id: 's3',
          nickname: 'n3',
          handle: '@h3',
          status: 'done',
          spawnedAt: '2026-07-28T10:02:00Z',
        },
        {
          id: 's4',
          nickname: 'n4',
          handle: '@h4',
          status: 'failed',
          spawnedAt: '2026-07-28T10:03:00Z',
        },
        {
          id: 's5',
          nickname: 'n5',
          handle: '@h5',
          status: 'dead',
          spawnedAt: '2026-07-28T10:04:00Z',
        },
        {
          id: 's6',
          nickname: 'n6',
          handle: '@h6',
          status: 'idle',
          spawnedAt: '2026-07-28T10:05:00Z',
        },
      ],
    })
    expect(events.map((e) => e.status)).toEqual([
      'running',
      'running',
      'done',
      'failed',
      'failed',
      'pending',
    ])
  })

  it('tool status 映射:success → done, error → failed, 其他 → running', () => {
    const events = flattenToTimelineEvents({
      tools: [
        { id: 't1', toolName: 'a', status: 'success', startedAt: '2026-07-28T10:00:00Z' },
        { id: 't2', toolName: 'b', status: 'error', startedAt: '2026-07-28T10:01:00Z' },
        { id: 't3', toolName: 'c', status: 'running', startedAt: '2026-07-28T10:02:00Z' },
        { id: 't4', toolName: 'd', status: 'pending', startedAt: '2026-07-28T10:03:00Z' },
      ],
    })
    expect(events.map((e) => e.status)).toEqual(['done', 'failed', 'running', 'running'])
  })

  it('question status 映射:answered → done, !answered → pending', () => {
    const events = flattenToTimelineEvents({
      questions: [
        { id: 'q1', question: 'a', answered: true, timestamp: '2026-07-28T10:00:00Z' },
        { id: 'q2', question: 'b', answered: false, timestamp: '2026-07-28T10:01:00Z' },
        { id: 'q3', question: 'c', timestamp: '2026-07-28T10:02:00Z' }, // undefined
      ],
    })
    expect(events.map((e) => e.status)).toEqual(['done', 'pending', 'pending'])
  })

  it('4 个源同时存在,合并后按 timestamp 升序', () => {
    const events = flattenToTimelineEvents({
      plans: [
        { id: 'p1', step: 'plan-a', status: 'done', timestamp: '2026-07-28T10:02:00Z' },
        { id: 'p2', step: 'plan-b', status: 'done', timestamp: '2026-07-28T10:04:00Z' },
      ],
      subagents: [
        {
          id: 's1',
          nickname: 'n1',
          handle: '@h1',
          status: 'done',
          spawnedAt: '2026-07-28T10:01:00Z',
        },
      ],
      tools: [{ id: 't1', toolName: 'tool-a', status: 'done', startedAt: '2026-07-28T10:03:00Z' }],
      questions: [{ id: 'q1', question: 'q-a', answered: true, timestamp: '2026-07-28T10:00:00Z' }],
    })
    expect(events.map((e) => e.id)).toEqual(['q1', 's1', 'p1', 't1', 'p2'])
  })

  it('tool description 含 durationMs 数字', () => {
    const events = flattenToTimelineEvents({
      tools: [
        {
          id: 't1',
          toolName: 'read_file',
          status: 'success',
          startedAt: '2026-07-28T10:00:00Z',
          durationMs: 1234,
        },
        { id: 't2', toolName: 'edit_file', status: 'success', startedAt: '2026-07-28T10:01:00Z' },
      ],
    })
    const [first, second] = events
    expect(first?.description).toBe('1234ms')
    expect(second?.description).toBeUndefined()
  })

  it('subagent title:有 currentTask 时显示 "handle · currentTask",否则 "handle · nickname"', () => {
    const events = flattenToTimelineEvents({
      subagents: [
        {
          id: 's1',
          nickname: 'validator',
          handle: '@validator',
          status: 'done',
          spawnedAt: '2026-07-28T10:00:00Z',
          currentTask: '验证类型',
        },
        {
          id: 's2',
          nickname: 'reviewer',
          handle: '@reviewer',
          status: 'done',
          spawnedAt: '2026-07-28T10:01:00Z',
        },
      ],
    })
    const [first, second] = events
    expect(first?.title).toBe('@validator · 验证类型')
    expect(second?.title).toBe('@reviewer · reviewer')
  })

  it('可选字段(plan.explanation / tool.durationMs / question.answered)缺失时不报错', () => {
    expect(() =>
      flattenToTimelineEvents({
        plans: [{ id: 'p', step: 'a', status: 'done', timestamp: '2026-07-28T10:00:00Z' }],
        tools: [{ id: 't', toolName: 'a', status: 'done', startedAt: '2026-07-28T10:00:00Z' }],
        questions: [{ id: 'q', question: 'a', timestamp: '2026-07-28T10:00:00Z' }],
      }),
    ).not.toThrow()
  })

  it('无效 timestamp 不会抛错(用 0 兜底)', () => {
    const events = flattenToTimelineEvents({
      plans: [
        { id: 'p1', step: 'a', status: 'done', timestamp: 'invalid' },
        { id: 'p2', step: 'b', status: 'done', timestamp: '2026-07-28T10:00:00Z' },
      ],
    })
    expect(events.length).toBe(2)
    // invalid 视为 0,排在 2026-07-28 之前
    const [first] = events
    expect(first?.id).toBe('p1')
  })
})

// ─── 进阶边界场景(2026-07-28 覆盖率深化) ─────────────────────────

describe('TimelineTab — tabpanel id 与 aria 联动', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('activeTab=inline:tabpanel id="tab-panel-inline"', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    // activeTab 默认 inline
    const { container } = render(<TimelineTab />)
    const panel = container.querySelector('#tab-panel-inline')
    expect(panel).toBeTruthy()
    expect(panel?.getAttribute('role')).toBe('tabpanel')
  })

  it('activeTab=timeline:tabpanel id="tab-panel-timeline"', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
    const { container } = render(<TimelineTab />)
    const panel = container.querySelector('#tab-panel-timeline')
    expect(panel).toBeTruthy()
    expect(panel?.getAttribute('role')).toBe('tabpanel')
  })

  it('inline tab 按钮 aria-controls 指向 tab-panel-inline', () => {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    const { container } = render(<TimelineTab />)
    const inlineTab = container.querySelector('[data-testid="timeline-tab-inline"]') as HTMLElement
    expect(inlineTab.getAttribute('aria-controls')).toBe('tab-panel-inline')
  })
})

describe('TimelineTab — thinking/reference 类型事件渲染与过滤', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('thinking 类型事件:渲染在事件列表中', () => {
    useTimelineStore
      .getState()
      .setEvents([makeEvent({ id: 'th-1', type: 'thinking', status: 'done', title: '推理中' })])
    useTimelineStore.getState().setActiveTab('timeline')
    const { container } = render(<TimelineTab />)
    expect(container.querySelector('[data-event-type="thinking"]')).toBeTruthy()
    expect(container.textContent).toContain('推理中')
  })

  it('reference 类型事件:渲染在事件列表中', () => {
    useTimelineStore
      .getState()
      .setEvents([makeEvent({ id: 'ref-1', type: 'reference', status: 'done', title: '参考文档' })])
    useTimelineStore.getState().setActiveTab('timeline')
    const { container } = render(<TimelineTab />)
    expect(container.querySelector('[data-event-type="reference"]')).toBeTruthy()
  })

  it('thinking/reference 不在 filter chips 中(只 4 + all)', () => {
    useTimelineStore
      .getState()
      .setEvents([
        makeEvent({ id: 'th-1', type: 'thinking' }),
        makeEvent({ id: 'ref-1', type: 'reference' }),
      ])
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    // 4 + all 5 个 filter chip
    expect(screen.getByTestId('timeline-filter-all')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-plan')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-subagent')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-tool')).toBeTruthy()
    expect(screen.getByTestId('timeline-filter-thinking')).toBeTruthy()
    // reference 不在 filter chips 中
    expect(screen.queryByTestId('timeline-filter-reference')).toBeNull()
  })
})

describe('TimelineTab — hasFilterActive 状态隔离', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
  })
  afterEach(() => {
    cleanup()
  })

  it('仅设置 searchQuery:search clear 按钮显示 + all filter 仍为 active', () => {
    render(<TimelineTab />)
    fireEvent.change(screen.getByTestId('timeline-search-input'), { target: { value: 'alpha' } })
    // search clear 出现
    expect(screen.getByTestId('timeline-search-clear')).toBeTruthy()
    // type filter 仍 all
    expect(screen.getByTestId('timeline-filter-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-filter-plan').getAttribute('aria-pressed')).toBe('false')
  })

  it('typeFilter 改变不重置 searchQuery', () => {
    render(<TimelineTab />)
    const input = screen.getByTestId('timeline-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'step' } })
    // 切换到 plan
    fireEvent.click(screen.getByTestId('timeline-filter-plan'))
    // search query 仍保留
    expect(input.value).toBe('step')
  })
})

// ─── Phase 19/20 深化:tab 切换 data-active + 100+ events 性能 + 边界场景 ──

describe('TimelineTab — 100+ events 性能 + 大数据集边界', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('100 个 events 渲染耗时 < 200ms(jest happy-dom 基线)', () => {
    const bigEvents: TimelineEvent[] = Array.from({ length: 120 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        type: (i % 4 === 0
          ? 'plan'
          : i % 4 === 1
            ? 'subagent'
            : i % 4 === 2
              ? 'tool'
              : 'question') as TimelineEvent['type'],
        status: (i % 3 === 0
          ? 'done'
          : i % 3 === 1
            ? 'running'
            : 'pending') as TimelineEvent['status'],
        title: `Event ${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      }),
    )
    useTimelineStore.getState().setEvents(bigEvents)
    useTimelineStore.getState().setActiveTab('timeline')
    const t0 = performance.now()
    render(<TimelineTab />)
    const t1 = performance.now()
    const duration = t1 - t0
    expect(duration).toBeLessThan(200)
    // 验证 120 个事件全部渲染
    const rows = document.querySelectorAll('[data-event-type]')
    expect(rows.length).toBe(120)
  })

  it('1000 个 events:total count 徽章正确显示 1000', () => {
    const bigEvents: TimelineEvent[] = Array.from({ length: 1000 }, (_, i) =>
      makeEvent({ id: `evt-${i}`, title: `E${i}` }),
    )
    useTimelineStore.getState().setEvents(bigEvents)
    render(<TimelineTab />)
    const badge = screen.getByTestId('timeline-total-count')
    expect(badge.textContent).toBe('1000')
  })

  it('500 个 events + plan filter:filteredEvents 正确收敛到 plan 子集', () => {
    const events: TimelineEvent[] = Array.from({ length: 500 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        type: (i % 2 === 0 ? 'plan' : 'tool') as TimelineEvent['type'],
        status: 'done',
      }),
    )
    useTimelineStore.getState().setEvents(events)
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    fireEvent.click(screen.getByTestId('timeline-filter-plan'))
    // 250 个 plan (i=0,2,4,...,498)
    const planRows = document.querySelectorAll('[data-event-type="plan"]')
    expect(planRows.length).toBe(250)
  })
})

describe('TimelineTab — children 折叠交互 + 嵌套展示', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
    useTimelineStore.getState().setActiveTab('timeline')
  })
  afterEach(() => {
    cleanup()
  })

  it('有 children 的事件:默认未展开(aria-expanded=false)', () => {
    const eventWithChildren: TimelineEvent = makeEvent({
      id: 'parent-1',
      type: 'plan',
      status: 'running',
      children: [makeEvent({ id: 'c-1', type: 'tool', status: 'done', title: '子事件' })],
    })
    useTimelineStore.getState().setEvents([eventWithChildren])
    render(<TimelineTab />)
    const btn = document.querySelector('[data-event-id="parent-1"] button')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('有 children 的事件:点击展开 + 显示子节点', () => {
    const eventWithChildren: TimelineEvent = makeEvent({
      id: 'parent-2',
      type: 'plan',
      status: 'running',
      children: [
        makeEvent({ id: 'c-1', type: 'tool', status: 'done', title: '子事件 A' }),
        makeEvent({ id: 'c-2', type: 'tool', status: 'done', title: '子事件 B' }),
      ],
    })
    useTimelineStore.getState().setEvents([eventWithChildren])
    render(<TimelineTab />)
    const btn = document.querySelector('[data-event-id="parent-2"] button')!
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // 渲染 2 个子节点
    expect(document.querySelectorAll('[data-event-id="c-1"]').length).toBe(1)
    expect(document.querySelectorAll('[data-event-id="c-2"]').length).toBe(1)
  })
})

describe('TimelineTab — 空 events 边界', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })

  it('events=[] + activeTab=inline:只渲染 tab bar + inline hint', () => {
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-tab')).toBeTruthy()
    expect(screen.getByTestId('timeline-inline-hint')).toBeTruthy()
    // filter / search / count 都不渲染
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
    expect(screen.queryByTestId('timeline-search-row')).toBeNull()
    expect(screen.queryByTestId('timeline-total-count')).toBeNull()
  })

  it('events=[] + activeTab=timeline:渲染 timeline tab + empty text', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    expect(screen.getByTestId('timeline-empty')).toBeTruthy()
    expect(screen.getByText('暂无事件')).toBeTruthy()
  })

  it('events=[] 时设置 typeFilter=plan:filter 不显示(无 events 触发 filter row 渲染)', () => {
    useTimelineStore.getState().setActiveTab('timeline')
    render(<TimelineTab />)
    // events=[] 时 filter row 整体不渲染(typeFilter 状态保留但不展示 UI)
    expect(screen.queryByTestId('timeline-filter-row')).toBeNull()
  })
})

describe('TimelineTab — status 颜色映射视觉验证', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
    useTimelineStore.getState().setActiveTab('timeline')
  })
  afterEach(() => {
    cleanup()
  })

  it('done 状态 status icon:emerald 颜色(text-emerald-500)', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'd-1', status: 'done' })])
    const { container } = render(<TimelineTab />)
    // StatusIcon 是最后一个 lucide-icon
    const icons = container.querySelectorAll('[data-testid="lucide-icon"]')
    const lastIcon = icons[icons.length - 1] as HTMLElement
    expect(lastIcon.className).toContain('text-emerald-500')
  })

  it('failed 状态 status icon:destructive 颜色(text-destructive)', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'f-1', status: 'failed' })])
    const { container } = render(<TimelineTab />)
    const icons = container.querySelectorAll('[data-testid="lucide-icon"]')
    const lastIcon = icons[icons.length - 1] as HTMLElement
    expect(lastIcon.className).toContain('text-destructive')
  })

  it('running 状态 status icon:animate-spin 动画类', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'r-1', status: 'running' })])
    const { container } = render(<TimelineTab />)
    const icons = container.querySelectorAll('[data-testid="lucide-icon"]')
    const lastIcon = icons[icons.length - 1] as HTMLElement
    expect(lastIcon.className).toContain('animate-spin')
  })

  it('pending 状态 status icon:muted 颜色(text-muted-foreground/50)', () => {
    useTimelineStore.getState().setEvents([makeEvent({ id: 'p-1', status: 'pending' })])
    const { container } = render(<TimelineTab />)
    const icons = container.querySelectorAll('[data-testid="lucide-icon"]')
    const lastIcon = icons[icons.length - 1] as HTMLElement
    expect(lastIcon.className).toContain('text-muted-foreground/50')
  })
})
