// @vitest-environment happy-dom
/**
 * Timeline i18n 化 + 事件快捷筛选 单测(2026-07-29 立,Phase 22)
 *
 * 覆盖:
 * - i18n 化(12 用例):
 *   1. meta.i18nKey 存在 → 渲染用 t() 翻译
 *   2. meta.i18nKey 不存在 → fallback 到 description
 *   3. t() 抛错 → fallback 到 description
 *   4-8. 4 种 phase → i18nKey 映射(thinking/tool_call/tool_result±ok/output_ready)
 *   9. i18nParams 正确传递(iteration/tool)
 *   10. 切换语言后 description 文本变化(模拟 map 切换)
 *   11. data-i18n-key 属性暴露到 DOM(便于测试验证)
 *   12. tool_result ok=true/false 走不同 i18nKey(Success/Failed)
 *
 * - 筛选(10 用例):
 *   11-15. 5 种 filterType(all/plan/subagent/tool/thinking)各自过滤行为
 *   16. 切换 filterType → 事件列表更新
 *   17. 筛选按钮组渲染 5 个按钮
 *   18. 选中态按钮 data-active='true'
 *   19. 空结果 → 显示空状态(timeline-no-match)
 *   20. filteredEvents 响应式(store 更新 events 后自动更新)
 *
 * 注意:zustand getState() 返回快照,调用 action 后必须重新 getState()。
 * AGENTS.md §3:测试文件允许 any(mock 场景)。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'

// ─── next-intl mock:可变 map + throwKeys + setMessages(模拟语言切换) ──
const { mockT, setMessages, resetMessages, setThrowKeys, resetThrowKeys } = vi.hoisted(() => {
  const DEFAULT_MAP: Record<string, string> = {
    // timelineSubagent* key(带 ICU 占位符)
    timelineSubagentThinking: '思考中(第 {iteration} 轮)',
    timelineSubagentToolCall: '调用工具:{tool}(第 {iteration} 轮)',
    timelineSubagentToolResultSuccess: '工具返回:{tool} 成功',
    timelineSubagentToolResultFailed: '工具返回:{tool} 失败',
    timelineSubagentOutputReady: '输出就绪',
    // timeline filter key
    timelineFilterAll: '全部',
    timelineFilterPlan: '计划',
    timelineFilterSubagent: '子智能体',
    timelineFilterTool: '工具',
    timelineFilterThinking: '思考',
    // 其他必要 key(TimelineTab 渲染需要)
    timelineTabsAriaLabel: '时间线',
    timelineSearchPlaceholder: '搜索...',
    timelineSearchAriaLabel: '搜索',
    timelineSearchClear: '清空',
    timelineInlineHint: '内联展示',
    timelineNoMatch: '无匹配事件',
    timelineClearFilters: '清空过滤',
    timelineExport: '导出',
    timelineCountDone: '完成',
    timelineCountFailed: '失败',
    timelineCountRunning: '运行中',
    copied: '已复制',
  }
  let map: Record<string, string> = { ...DEFAULT_MAP }
  let throwKeys = new Set<string>()
  const mockT = (key: string, params?: Record<string, unknown>) => {
    if (throwKeys.has(key)) throw new Error(`mock throw: ${key}`)
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(`{${k}}`, String(val))
      }
    }
    return v
  }
  const setMessages = (m: Record<string, string>) => {
    map = { ...m }
  }
  const resetMessages = () => {
    map = { ...DEFAULT_MAP }
  }
  const setThrowKeys = (keys: string[]) => {
    throwKeys = new Set(keys)
  }
  const resetThrowKeys = () => {
    throwKeys = new Set()
  }
  return { mockT, setMessages, resetMessages, setThrowKeys, resetThrowKeys }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// ─── lucide-react mock:用 span 替代(沿用现有测试模式) ──────────────
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = (props: { className?: string; 'data-testid'?: string }) => (
    <span data-testid={props['data-testid'] ?? 'lucide-icon'} className={props.className} />
  )
  return { IconSpan }
})
vi.mock('lucide-react', () => {
  const Icon = IconSpan
  return {
    __esModule: true,
    MessageSquare: Icon,
    ListTree: Icon,
    Search: Icon,
    X: Icon,
    ChevronRight: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    Bot: Icon,
    HelpCircle: Icon,
    Wrench: Icon,
    Brain: Icon,
    FileText: Icon,
    Circle: Icon,
    Download: Icon,
    Check: Icon,
  }
})

import { TimelineEventRow } from '../src/components/ai/progress-sections/timeline-event'
import { TimelineTab } from '../src/components/ai/progress-sections/timeline-tab'
import {
  useTimelineStore,
  type TimelineEvent,
} from '../src/stores/timeline-store'
import { mapProgressToTimelineUpdate } from '../src/lib/subagent-timeline-mapper'
import type { SubagentProgressEvent } from '@ihui/api-client'

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 9)}`,
    type: overrides.type ?? 'plan',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:00Z',
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

function makeProgressEvent(
  overrides: Partial<SubagentProgressEvent> = {},
): SubagentProgressEvent {
  return {
    id: overrides.id ?? 'sub-1',
    phase: overrides.phase ?? 'thinking',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:01Z',
    iteration: overrides.iteration,
    tool: overrides.tool,
    ok: overrides.ok,
    outputPreview: overrides.outputPreview,
    agentName: overrides.agentName,
  }
}

// ─── 重置 store + mock 状态 ──────────────────────────────────────
beforeEach(() => {
  useTimelineStore.getState().reset()
  resetMessages()
  resetThrowKeys()
})
afterEach(() => {
  cleanup()
})

// ═══════════════════════════════════════════════════════════════════
// Part 1: Timeline i18n 化(12 用例)
// ═══════════════════════════════════════════════════════════════════
describe('Timeline i18n 化', () => {
  it('1. meta.i18nKey 存在时,渲染用 t() 翻译(非 description fallback)', () => {
    const event = makeEvent({
      description: '原始 fallback 描述',
      meta: {
        phase: 'thinking',
        iteration: 3,
        i18nKey: 'ai.pane.timelineSubagentThinking',
        i18nParams: { iteration: 3 },
      },
    })
    const { container } = render(<TimelineEventRow event={event} />)
    // 翻译值来自 mock map:思考中(第 3 轮)
    expect(container.textContent).toContain('思考中(第 3 轮)')
    // 不应显示 fallback
    expect(container.textContent).not.toContain('原始 fallback 描述')
  })

  it('2. meta.i18nKey 不存在时,fallback 到 description', () => {
    const event = makeEvent({
      description: '纯描述无 i18n',
      meta: { phase: 'spawn' },
    })
    const { container } = render(<TimelineEventRow event={event} />)
    expect(container.textContent).toContain('纯描述无 i18n')
    // data-i18n-key 属性不渲染(meta 无 i18nKey)
    const row = container.querySelector('[data-testid="timeline-event-row"]')!
    expect(row.getAttribute('data-i18n-key')).toBeNull()
  })

  it('3. t() 抛错时,fallback 到 description', () => {
    setThrowKeys(['timelineSubagentThinking'])
    const event = makeEvent({
      description: '异常 fallback',
      meta: {
        phase: 'thinking',
        i18nKey: 'ai.pane.timelineSubagentThinking',
        i18nParams: { iteration: 1 },
      },
    })
    const { container } = render(<TimelineEventRow event={event} />)
    // t() 抛错 → fallback
    expect(container.textContent).toContain('异常 fallback')
    expect(container.textContent).not.toContain('思考中')
  })

  it('4. thinking phase → i18nKey=ai.pane.timelineSubagentThinking', () => {
    const update = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'thinking', iteration: 5 }),
    )
    expect(update).not.toBeNull()
    const meta = update!.updates.meta as Record<string, unknown>
    expect(meta['i18nKey']).toBe('ai.pane.timelineSubagentThinking')
  })

  it('5. tool_call phase → i18nKey=ai.pane.timelineSubagentToolCall', () => {
    const update = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_call', tool: 'read_file', iteration: 2 }),
    )
    expect(update).not.toBeNull()
    const meta = update!.updates.meta as Record<string, unknown>
    expect(meta['i18nKey']).toBe('ai.pane.timelineSubagentToolCall')
  })

  it('6. tool_result phase + ok=true → i18nKey=ai.pane.timelineSubagentToolResultSuccess', () => {
    const update = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_result', tool: 'edit_file', ok: true }),
    )
    expect(update).not.toBeNull()
    const meta = update!.updates.meta as Record<string, unknown>
    expect(meta['i18nKey']).toBe('ai.pane.timelineSubagentToolResultSuccess')
  })

  it('7. tool_result phase + ok=false → i18nKey=ai.pane.timelineSubagentToolResultFailed', () => {
    const update = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_result', tool: 'edit_file', ok: false }),
    )
    expect(update).not.toBeNull()
    const meta = update!.updates.meta as Record<string, unknown>
    expect(meta['i18nKey']).toBe('ai.pane.timelineSubagentToolResultFailed')
  })

  it('8. output_ready phase → i18nKey=ai.pane.timelineSubagentOutputReady', () => {
    const update = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'output_ready', outputPreview: 'result text' }),
    )
    expect(update).not.toBeNull()
    const meta = update!.updates.meta as Record<string, unknown>
    expect(meta['i18nKey']).toBe('ai.pane.timelineSubagentOutputReady')
  })

  it('9. i18nParams 正确传递(iteration/tool)', () => {
    // thinking:iteration
    const tUpdate = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'thinking', iteration: 7 }),
    )!
    const tMeta = tUpdate.updates.meta as Record<string, unknown>
    expect(tMeta['i18nParams']).toEqual({ iteration: 7 })

    // tool_call:tool + iteration
    const tcUpdate = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_call', tool: 'bash', iteration: 4 }),
    )!
    const tcMeta = tcUpdate.updates.meta as Record<string, unknown>
    expect(tcMeta['i18nParams']).toEqual({ tool: 'bash', iteration: 4 })

    // tool_result:tool only
    const trUpdate = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_result', tool: 'grep', ok: true }),
    )!
    const trMeta = trUpdate.updates.meta as Record<string, unknown>
    expect(trMeta['i18nParams']).toEqual({ tool: 'grep' })

    // output_ready:无 params
    const oUpdate = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'output_ready' }),
    )!
    const oMeta = oUpdate.updates.meta as Record<string, unknown>
    expect(oMeta['i18nParams']).toBeUndefined()
  })

  it('10. 切换语言后 description 文本变化(模拟 map 切换)', () => {
    const event = makeEvent({
      description: 'fallback',
      meta: {
        phase: 'thinking',
        i18nKey: 'ai.pane.timelineSubagentThinking',
        i18nParams: { iteration: 3 },
      },
    })

    // 中文 map
    setMessages({ timelineSubagentThinking: '思考中(第 {iteration} 轮)' })
    const { container: c1, unmount } = render(<TimelineEventRow event={event} />)
    expect(c1.textContent).toContain('思考中(第 3 轮)')
    expect(c1.textContent).not.toContain('Thinking')
    unmount()

    // 英文 map(模拟语言切换)
    setMessages({ timelineSubagentThinking: 'Thinking (iteration {iteration})' })
    const { container: c2 } = render(<TimelineEventRow event={event} />)
    expect(c2.textContent).toContain('Thinking (iteration 3)')
    expect(c2.textContent).not.toContain('思考中')
  })

  it('11. data-i18n-key 属性暴露到 DOM(便于测试验证渲染来源)', () => {
    const event = makeEvent({
      meta: {
        phase: 'tool_call',
        i18nKey: 'ai.pane.timelineSubagentToolCall',
        i18nParams: { tool: 'grep', iteration: 1 },
      },
    })
    const { container } = render(<TimelineEventRow event={event} />)
    const row = container.querySelector('[data-testid="timeline-event-row"]')!
    expect(row.getAttribute('data-i18n-key')).toBe('ai.pane.timelineSubagentToolCall')
  })

  it('12. tool_result ok=true/false 走不同 i18nKey,渲染文本不同(Success/Failed)', () => {
    // ok=true → Success
    const okEvent = makeEvent({
      description: 'fallback-ok',
      meta: {
        phase: 'tool_result',
        tool: 'edit_file',
        ok: true,
        i18nKey: 'ai.pane.timelineSubagentToolResultSuccess',
        i18nParams: { tool: 'edit_file' },
      },
    })
    const { container: c1 } = render(<TimelineEventRow event={okEvent} />)
    expect(c1.textContent).toContain('工具返回:edit_file 成功')

    // ok=false → Failed
    const failEvent = makeEvent({
      description: 'fallback-fail',
      meta: {
        phase: 'tool_result',
        tool: 'edit_file',
        ok: false,
        i18nKey: 'ai.pane.timelineSubagentToolResultFailed',
        i18nParams: { tool: 'edit_file' },
      },
    })
    const { container: c2 } = render(<TimelineEventRow event={failEvent} />)
    expect(c2.textContent).toContain('工具返回:edit_file 失败')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Part 2: Timeline 事件快捷筛选(10 用例)
// ═══════════════════════════════════════════════════════════════════
describe('Timeline 事件快捷筛选', () => {
  // 样本事件:每种 type 各 1-2 个
  const SAMPLE_EVENTS: TimelineEvent[] = [
    makeEvent({ id: 'p1', type: 'plan', title: 'Plan alpha', status: 'done' }),
    makeEvent({ id: 'p2', type: 'plan', title: 'Plan beta', status: 'pending' }),
    makeEvent({ id: 's1', type: 'subagent', title: '@validator', status: 'running' }),
    makeEvent({ id: 't1', type: 'tool', title: 'read_file', status: 'done' }),
    makeEvent({ id: 't2', type: 'tool', title: 'edit_file', status: 'failed' }),
    makeEvent({ id: 'k1', type: 'thinking', title: '思考步骤', status: 'done' }),
  ]

  /** 渲染 TimelineTab 并切到 timeline tab(显示事件列表) */
  function renderTimelineTab() {
    useTimelineStore.getState().setEvents(SAMPLE_EVENTS)
    useTimelineStore.getState().setActiveTab('timeline')
    return render(<TimelineTab />)
  }

  /** 获取当前显示的事件行 id 列表 */
  function getVisibleEventIds(container: HTMLElement): string[] {
    const rows = container.querySelectorAll('[data-testid="timeline-event-row"]')
    return Array.from(rows).map((r) => r.getAttribute('data-event-id') ?? '')
  }

  it('11. filterType=all → 显示全部事件', () => {
    useTimelineStore.getState().setFilterType('all')
    const { container } = renderTimelineTab()
    const ids = getVisibleEventIds(container)
    expect(ids).toHaveLength(SAMPLE_EVENTS.length)
    expect(ids).toContain('p1')
    expect(ids).toContain('s1')
    expect(ids).toContain('t1')
    expect(ids).toContain('k1')
  })

  it('12. filterType=plan → 只显示 type=plan 事件', () => {
    useTimelineStore.getState().setFilterType('plan')
    const { container } = renderTimelineTab()
    const ids = getVisibleEventIds(container)
    expect(ids).toEqual(['p1', 'p2'])
  })

  it('13. filterType=subagent → 只显示 type=subagent 事件', () => {
    useTimelineStore.getState().setFilterType('subagent')
    const { container } = renderTimelineTab()
    const ids = getVisibleEventIds(container)
    expect(ids).toEqual(['s1'])
  })

  it('14. filterType=tool → 只显示 type=tool 事件', () => {
    useTimelineStore.getState().setFilterType('tool')
    const { container } = renderTimelineTab()
    const ids = getVisibleEventIds(container)
    expect(ids).toEqual(['t1', 't2'])
  })

  it('15. filterType=thinking → 只显示 type=thinking 事件', () => {
    useTimelineStore.getState().setFilterType('thinking')
    const { container } = renderTimelineTab()
    const ids = getVisibleEventIds(container)
    expect(ids).toEqual(['k1'])
  })

  it('16. 切换 filterType → 事件列表更新', () => {
    useTimelineStore.getState().setFilterType('all')
    const { container } = renderTimelineTab()
    // 初始:全部 6 个
    expect(getVisibleEventIds(container)).toHaveLength(6)

    // 切换到 plan
    act(() => {
      useTimelineStore.getState().setFilterType('plan')
    })
    expect(getVisibleEventIds(container)).toEqual(['p1', 'p2'])

    // 切换到 tool
    act(() => {
      useTimelineStore.getState().setFilterType('tool')
    })
    expect(getVisibleEventIds(container)).toEqual(['t1', 't2'])

    // 切换回 all
    act(() => {
      useTimelineStore.getState().setFilterType('all')
    })
    expect(getVisibleEventIds(container)).toHaveLength(6)
  })

  it('17. 筛选按钮组渲染 5 个按钮(all/plan/subagent/tool/thinking)', () => {
    const { container } = renderTimelineTab()
    const filterRow = container.querySelector('[data-testid="timeline-filter-row"]')!
    const buttons = filterRow.querySelectorAll('button[data-testid^="timeline-filter-"]')
    expect(buttons).toHaveLength(5)
    // 验证 5 个 filter id 都存在
    const ids = Array.from(buttons).map((b) => b.getAttribute('data-testid'))
    expect(ids).toContain('timeline-filter-all')
    expect(ids).toContain('timeline-filter-plan')
    expect(ids).toContain('timeline-filter-subagent')
    expect(ids).toContain('timeline-filter-tool')
    expect(ids).toContain('timeline-filter-thinking')
    // 不应再有 question(Phase 22 移除)
    expect(ids).not.toContain('timeline-filter-question')
  })

  it('18. 选中态按钮 data-active=true(非选中无该属性)', () => {
    useTimelineStore.getState().setFilterType('tool')
    const { container } = renderTimelineTab()
    const toolBtn = container.querySelector('[data-testid="timeline-filter-tool"]')!
    expect(toolBtn.getAttribute('data-active')).toBe('true')
    // all 按钮非选中
    const allBtn = container.querySelector('[data-testid="timeline-filter-all"]')!
    expect(allBtn.getAttribute('data-active')).toBeNull()
    // plan 按钮非选中
    const planBtn = container.querySelector('[data-testid="timeline-filter-plan"]')!
    expect(planBtn.getAttribute('data-active')).toBeNull()
  })

  it('19. 空结果(filterType=tool 但无 tool 事件)→ 显示空状态', () => {
    // 事件集中无 tool 类型
    const eventsWithoutTool: TimelineEvent[] = [
      makeEvent({ id: 'p1', type: 'plan', title: 'Plan', status: 'done' }),
      makeEvent({ id: 's1', type: 'subagent', title: '@v', status: 'running' }),
    ]
    useTimelineStore.getState().setEvents(eventsWithoutTool)
    useTimelineStore.getState().setActiveTab('timeline')
    useTimelineStore.getState().setFilterType('tool')
    const { container } = render(<TimelineTab />)
    // 显示 timeline-no-match 空状态
    expect(container.querySelector('[data-testid="timeline-no-match"]')).toBeTruthy()
    // 不显示事件列表
    expect(container.querySelector('[data-testid="timeline-events"]')).toBeNull()
  })

  it('20. filteredEvents 响应式(store 更新 events 后列表自动更新)', () => {
    useTimelineStore.getState().setFilterType('plan')
    useTimelineStore.getState().setEvents([
      makeEvent({ id: 'p1', type: 'plan', title: 'Plan 1', status: 'done' }),
    ])
    useTimelineStore.getState().setActiveTab('timeline')
    const { container } = render(<TimelineTab />)
    // 初始:1 个 plan
    expect(getVisibleEventIds(container)).toEqual(['p1'])

    // store 新增 events(2 个 plan + 1 个 tool)
    act(() => {
      useTimelineStore.getState().setEvents([
        makeEvent({ id: 'p1', type: 'plan', title: 'Plan 1', status: 'done' }),
        makeEvent({ id: 'p2', type: 'plan', title: 'Plan 2', status: 'pending' }),
        makeEvent({ id: 't1', type: 'tool', title: 'grep', status: 'done' }),
      ])
    })
    // 自动更新:仍只显示 plan(filterType=plan),现在是 2 个
    const ids = getVisibleEventIds(container)
    expect(ids).toEqual(['p1', 'p2'])
    expect(ids).not.toContain('t1')
  })
})
