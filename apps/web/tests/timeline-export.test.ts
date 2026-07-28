/**
 * eventsToMarkdown 纯函数单元测试(2026-07-28 立,Phase 20 P1-3)
 *
 * 覆盖:
 * - eventsToMarkdown:空事件 / 满字段 / timestamp 缺省 / 多种 type 混合
 * - Type 映射 emoji 完整覆盖
 * - Status 映射 emoji 完整覆盖
 */

import { describe, it, expect } from 'vitest'
import { eventsToMarkdown } from '../src/components/ai/progress-sections/timeline-tab'
import type { TimelineEvent } from '../src/stores/timeline-store'

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 9)}`,
    type: overrides.type ?? 'plan',
    timestamp: overrides.timestamp ?? '2026-07-28T10:00:00Z',
    title: overrides.title ?? 'test event',
    description: overrides.description,
    status: overrides.status ?? 'done',
    messageId: overrides.messageId,
    planStepId: overrides.planStepId,
    toolCallId: overrides.toolCallId,
    children: overrides.children,
    meta: overrides.meta,
  }
}

describe('eventsToMarkdown', () => {
  it('空数组返回 # 时间线\\n\\n(空)\\n', () => {
    const md = eventsToMarkdown([])
    expect(md).toBe('# 时间线\n\n(空)\n')
  })

  it('单事件:必含标题 + 状态 emoji + type emoji + title', () => {
    const md = eventsToMarkdown([
      makeEvent({ id: 'p1', type: 'plan', title: 'Plan alpha', status: 'done' }),
    ])
    expect(md).toContain('# 时间线 (1 events)')
    expect(md).toContain('✅') // done
    expect(md).toContain('📋') // plan
    expect(md).toContain('Plan alpha')
  })

  it('含 timestamp 的事件渲染 [HH:MM:SS] 前缀', () => {
    const md = eventsToMarkdown([
      makeEvent({
        id: 't1',
        type: 'tool',
        title: 'read_file',
        status: 'done',
        timestamp: '2026-07-28T10:00:00Z',
      }),
    ])
    expect(md).toMatch(/\[2026-07-28T10:00:00Z\]/)
  })

  it('含 description 的事件追加 " — desc"', () => {
    const md = eventsToMarkdown([
      makeEvent({
        id: 't2',
        type: 'tool',
        title: 'edit_file',
        description: 'src/lib/utils.ts',
        status: 'done',
      }),
    ])
    expect(md).toContain('edit_file')
    expect(md).toContain('— src/lib/utils.ts')
  })

  it('无 description 的事件不追加 " — "', () => {
    const md = eventsToMarkdown([
      makeEvent({ id: 'q1', type: 'question', title: '是否继续?', status: 'pending' }),
    ])
    expect(md).not.toMatch(/—\s*$/)
  })

  it('多种 type emoji:plan / subagent / tool / question / thinking / reference', () => {
    const events = [
      makeEvent({ id: '1', type: 'plan' as const, title: 'p' }),
      makeEvent({ id: '2', type: 'subagent' as const, title: 's' }),
      makeEvent({ id: '3', type: 'tool' as const, title: 't' }),
      makeEvent({ id: '4', type: 'question' as const, title: 'q' }),
      makeEvent({ id: '5', type: 'thinking' as const, title: 'th' }),
      makeEvent({ id: '6', type: 'reference' as const, title: 'r' }),
    ]
    const md = eventsToMarkdown(events)
    expect(md).toContain('📋')
    expect(md).toContain('🤖')
    expect(md).toContain('🔧')
    expect(md).toContain('❓')
    expect(md).toContain('💭')
    expect(md).toContain('🔗')
  })

  it('多种 status emoji:done / failed / running / pending', () => {
    const events = [
      makeEvent({ id: '1', type: 'plan', status: 'done' as const, title: 'd' }),
      makeEvent({ id: '2', type: 'plan', status: 'failed' as const, title: 'f' }),
      makeEvent({ id: '3', type: 'plan', status: 'running' as const, title: 'r' }),
      makeEvent({ id: '4', type: 'plan', status: 'pending' as const, title: 'p' }),
    ]
    const md = eventsToMarkdown(events)
    expect(md).toContain('✅') // done
    expect(md).toContain('❌') // failed
    expect(md).toContain('▶️') // running
    expect(md).toContain('⏳') // pending
  })

  it('多事件按入参顺序逐行输出(不重新排序)', () => {
    const events = [
      makeEvent({ id: '1', type: 'plan', title: 'A', status: 'done' }),
      makeEvent({ id: '2', type: 'plan', title: 'B', status: 'done' }),
      makeEvent({ id: '3', type: 'plan', title: 'C', status: 'done' }),
    ]
    const md = eventsToMarkdown(events)
    const idxA = md.indexOf('A')
    const idxB = md.indexOf('B')
    const idxC = md.indexOf('C')
    expect(idxA).toBeGreaterThan(-1)
    expect(idxB).toBeGreaterThan(idxA)
    expect(idxC).toBeGreaterThan(idxB)
  })

  it('count 反映数组长度', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: `e${i}`, type: 'plan', title: `e${i}` }),
    )
    const md = eventsToMarkdown(events)
    expect(md).toContain('# 时间线 (5 events)')
  })
})
