// @vitest-environment happy-dom
/**
 * TimelineStore upsertEvent + Subagent SSE 集成测试(2026-07-29 立,Phase 21)
 *
 * 覆盖:
 * - upsertEvent:不存在时 addEvent / 存在时 updateEvent(merge)
 * - upsertEvent 保留原有字段(shallow merge 语义)
 * - upsertEvent 与 addEvent / updateEvent 共存
 * - Subagent SSE 全链路:spawn → progress → end
 * - 并行 subagent 场景
 * - 网络乱序(progress 先于 spawn)→ upsertEvent 自动创建
 *
 * 注意:zustand getState() 返回状态快照,调用 action 后必须重新 getState() 才能读到最新数据。
 * AGENTS.md §3:测试文件允许 any(mock 场景)。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '@/stores/timeline-store'
import type { TimelineEvent } from '@/stores/timeline-store'
import {
  mapSpawnToTimelineEvent,
  mapProgressToTimelineUpdate,
  mapEndToTimelineUpdate,
} from '@/lib/subagent-timeline-mapper'
import type { SubagentSpawnEvent, SubagentEndEvent, SubagentProgressEvent } from '@ihui/api-client'

// ─── 工具:获取最新 events(zustand getState() 返回快照,每次需重新获取) ──
function events(): TimelineEvent[] {
  return useTimelineStore.getState().events
}

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? 'evt-1',
    type: overrides.type ?? 'subagent',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:00.000Z',
    title: overrides.title ?? 'test-event',
    description: overrides.description,
    status: overrides.status ?? 'running',
    messageId: overrides.messageId,
    planStepId: overrides.planStepId,
    toolCallId: overrides.toolCallId,
    children: overrides.children,
    meta: overrides.meta,
  }
}

function makeSpawnEvent(overrides: Partial<SubagentSpawnEvent> = {}): SubagentSpawnEvent {
  return {
    id: overrides.id ?? 'sub-1',
    role: overrides.role ?? 'code-reviewer',
    task: overrides.task ?? '审查 auth 模块',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:00.000Z',
  }
}

function makeProgressEvent(overrides: Partial<SubagentProgressEvent> = {}): SubagentProgressEvent {
  return {
    id: overrides.id ?? 'sub-1',
    phase: overrides.phase ?? 'thinking',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:01.000Z',
    iteration: overrides.iteration,
    tool: overrides.tool,
    ok: overrides.ok,
    outputPreview: overrides.outputPreview,
    agentName: overrides.agentName,
  }
}

function makeEndEvent(overrides: Partial<SubagentEndEvent> = {}): SubagentEndEvent {
  return {
    id: overrides.id ?? 'sub-1',
    status: overrides.status ?? 'done',
    failureReason: overrides.failureReason,
    timestamp: overrides.timestamp ?? '2026-07-29T10:01:00.000Z',
  }
}

// ─── upsertEvent 单元测试 ─────────────────────────────────────────
describe('TimelineStore — upsertEvent', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })

  it('空 store + upsertEvent → events 长度=1', () => {
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'up-1' }))
    expect(events().length).toBe(1)
    expect(events()[0]!.id).toBe('up-1')
  })

  it('已存在 id + upsertEvent → events 长度不变,内容被 merge 更新', () => {
    useTimelineStore
      .getState()
      .addEvent(makeTimelineEvent({ id: 'up-2', title: '原始标题', status: 'running' }))
    expect(events().length).toBe(1)
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'up-2', title: '更新标题', status: 'done' }))
    expect(events().length).toBe(1)
    expect(events()[0]!.title).toBe('更新标题')
    expect(events()[0]!.status).toBe('done')
  })

  it('不存在 id + upsertEvent → events 长度+1', () => {
    useTimelineStore.getState().addEvent(makeTimelineEvent({ id: 'up-3a' }))
    expect(events().length).toBe(1)
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'up-3b' }))
    expect(events().length).toBe(2)
  })

  it('upsertEvent 后再 upsertEvent 同一 id → 长度不变,内容为第二次 merge', () => {
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'up-4', title: '第一次', status: 'running' }))
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'up-4', title: '第二次', status: 'done' }))
    expect(events().length).toBe(1)
    expect(events()[0]!.title).toBe('第二次')
    expect(events()[0]!.status).toBe('done')
  })

  it('upsertEvent 保留原有字段(只更新新事件中存在的字段)', () => {
    useTimelineStore.getState().addEvent(
      makeTimelineEvent({
        id: 'up-5',
        title: '原标题',
        description: '原描述',
        status: 'running',
        meta: { phase: 'spawn', subagentId: 'up-5' },
      }),
    )
    // upsertEvent 只传部分字段(omit description + meta)
    useTimelineStore.getState().upsertEvent({
      id: 'up-5',
      type: 'subagent',
      timestamp: '2026-07-29T10:00:00.000Z',
      title: '新标题',
      status: 'done',
    })
    expect(events()[0]!.title).toBe('新标题')
    expect(events()[0]!.status).toBe('done')
    // description 应保留(shallow merge:newEvent 未传 description,不覆盖)
    expect(events()[0]!.description).toBe('原描述')
    // meta 应保留
    expect(events()[0]!.meta).toEqual({ phase: 'spawn', subagentId: 'up-5' })
  })

  it('upsertEvent 后 events 顺序(新事件追加到末尾)', () => {
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'up-6a', title: 'A' }))
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'up-6b', title: 'B' }))
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'up-6c', title: 'C' }))
    expect(events().length).toBe(3)
    expect(events()[0]!.id).toBe('up-6a')
    expect(events()[1]!.id).toBe('up-6b')
    expect(events()[2]!.id).toBe('up-6c')
  })

  it('upsertEvent 与 addEvent 共存(先 addEvent 再 upsertEvent 同一 id → merge)', () => {
    useTimelineStore
      .getState()
      .addEvent(makeTimelineEvent({ id: 'up-7', title: 'addEvent', status: 'running' }))
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'up-7', title: 'upsertEvent', status: 'done' }))
    expect(events().length).toBe(1)
    expect(events()[0]!.title).toBe('upsertEvent')
    expect(events()[0]!.status).toBe('done')
  })

  it('upsertEvent 与 updateEvent 共存(先 upsertEvent 再 updateEvent 同一 id → merge)', () => {
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'up-8', title: 'upsertEvent', status: 'running' }))
    // updateEvent 用 Partial 更新
    useTimelineStore.getState().updateEvent('up-8', {
      status: 'done',
      description: 'updateEvent 添加描述',
    })
    expect(events().length).toBe(1)
    expect(events()[0]!.title).toBe('upsertEvent') // 保留
    expect(events()[0]!.status).toBe('done') // 更新
    expect(events()[0]!.description).toBe('updateEvent 添加描述') // 新增
  })
})

// ─── Subagent SSE → Timeline 集成测试 ─────────────────────────────
describe('TimelineStore — Subagent SSE → Timeline 集成', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })

  it('模拟 spawn 事件 → addEvent(mapSpawnToTimelineEvent(evt)) → events[0].type="subagent"', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sse-1', role: 'code-reviewer', task: '审查' })
    useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(spawnEvt))
    expect(events().length).toBe(1)
    expect(events()[0]!.type).toBe('subagent')
    expect(events()[0]!.title).toBe('code-reviewer')
    expect(events()[0]!.status).toBe('running')
  })

  it('模拟 spawn + progress(thinking) → addEvent + updateEvent → events[0].description 含 "思考中"', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sse-2' })
    const progressEvt = makeProgressEvent({ id: 'sse-2', phase: 'thinking', iteration: 1 })

    useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(spawnEvt))
    const progressResult = mapProgressToTimelineUpdate(progressEvt)!
    useTimelineStore.getState().updateEvent(progressResult.id, progressResult.updates)

    expect(events().length).toBe(1)
    expect(events()[0]!.description).toContain('思考中')
    expect(events()[0]!.meta?.phase).toBe('thinking')
  })

  it('模拟 spawn + progress(tool_call) + progress(tool_result) → events[0].description 最终为 tool_result', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sse-3' })
    const toolCallEvt = makeProgressEvent({
      id: 'sse-3',
      phase: 'tool_call',
      tool: 'search',
      iteration: 1,
    })
    const toolResultEvt = makeProgressEvent({
      id: 'sse-3',
      phase: 'tool_result',
      tool: 'search',
      ok: true,
    })

    // spawn
    useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(spawnEvt))
    // tool_call
    const callResult = mapProgressToTimelineUpdate(toolCallEvt)!
    useTimelineStore.getState().updateEvent(callResult.id, callResult.updates)
    expect(events()[0]!.description).toContain('调用工具')
    // tool_result(覆盖 tool_call 的 description)
    const resultResult = mapProgressToTimelineUpdate(toolResultEvt)!
    useTimelineStore.getState().updateEvent(resultResult.id, resultResult.updates)

    expect(events()[0]!.description).toContain('工具返回')
    expect(events()[0]!.description).not.toContain('调用工具')
    expect(events()[0]!.meta?.phase).toBe('tool_result')
  })

  it('模拟 spawn + end(done) → events[0].status="done"', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sse-4' })
    const endEvt = makeEndEvent({ id: 'sse-4', status: 'done' })

    useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(spawnEvt))
    const endResult = mapEndToTimelineUpdate(endEvt)
    useTimelineStore.getState().updateEvent(endResult.id, endResult.updates)

    expect(events()[0]!.status).toBe('done')
    expect(events()[0]!.description).toContain('完成')
    expect(events()[0]!.meta?.phase).toBe('end')
  })

  it('模拟 spawn + end(failed) → events[0].status="failed"', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sse-5' })
    const endEvt = makeEndEvent({ id: 'sse-5', status: 'failed', failureReason: 'timeout' })

    useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(spawnEvt))
    const endResult = mapEndToTimelineUpdate(endEvt)
    useTimelineStore.getState().updateEvent(endResult.id, endResult.updates)

    expect(events()[0]!.status).toBe('failed')
    expect(events()[0]!.description).toContain('失败')
    expect(events()[0]!.description).toContain('timeout')
  })

  it('模拟 2 个 subagent 并行(spawn1 + spawn2 + progress1 + end1 + end2)→ events 长度=2', () => {
    const store = useTimelineStore.getState()
    // spawn1
    store.addEvent(mapSpawnToTimelineEvent(makeSpawnEvent({ id: 'par-1', role: 'reviewer' })))
    // spawn2
    store.addEvent(mapSpawnToTimelineEvent(makeSpawnEvent({ id: 'par-2', role: 'tester' })))
    expect(events().length).toBe(2)

    // progress1(thinking)
    const p1 = mapProgressToTimelineUpdate(
      makeProgressEvent({ id: 'par-1', phase: 'thinking', iteration: 1 }),
    )!
    useTimelineStore.getState().updateEvent(p1.id, p1.updates)

    // end1(done)
    const e1 = mapEndToTimelineUpdate(makeEndEvent({ id: 'par-1', status: 'done' }))
    useTimelineStore.getState().updateEvent(e1.id, e1.updates)

    // end2(failed)
    const e2 = mapEndToTimelineUpdate(
      makeEndEvent({ id: 'par-2', status: 'failed', failureReason: 'error' }),
    )
    useTimelineStore.getState().updateEvent(e2.id, e2.updates)

    expect(events().length).toBe(2)
    // par-1 done
    const ev1 = events().find((e) => e.id === 'par-1')!
    expect(ev1.status).toBe('done')
    expect(ev1.title).toBe('reviewer')
    // par-2 failed
    const ev2 = events().find((e) => e.id === 'par-2')!
    expect(ev2.status).toBe('failed')
    expect(ev2.title).toBe('tester')
  })

  it('模拟 progress 先于 spawn 到达(网络乱序)→ upsertEvent 自动创建事件', () => {
    const progressEvt = makeProgressEvent({ id: 'ooo-1', phase: 'thinking', iteration: 1 })
    const spawnEvt = makeSpawnEvent({ id: 'ooo-1', role: 'researcher', task: '研究 X' })

    // progress 先到:用 upsertEvent 创建一个最小事件
    const progressResult = mapProgressToTimelineUpdate(progressEvt)!
    useTimelineStore.getState().upsertEvent({
      id: progressResult.id,
      type: 'subagent',
      timestamp: progressEvt.timestamp,
      title: '',
      status: 'running',
      ...progressResult.updates,
    })
    expect(events().length).toBe(1)
    expect(events()[0]!.description).toContain('思考中')

    // spawn 后到:upsertEvent merge 进去
    useTimelineStore.getState().upsertEvent(mapSpawnToTimelineEvent(spawnEvt))
    expect(events().length).toBe(1) // 仍是 1(merge,不新增)
    expect(events()[0]!.title).toBe('researcher') // spawn 的 title 覆盖空 title
    // spawn 的 description 覆盖 progress 的 description(shallow merge)
    expect(events()[0]!.description).toContain('研究')
  })
})

// ─── upsertEvent 边界场景 ─────────────────────────────────────────
describe('TimelineStore — upsertEvent 边界场景', () => {
  beforeEach(() => {
    useTimelineStore.getState().reset()
  })

  it('upsertEvent 同 id 多次 merge:最后一次写入胜出', () => {
    const store = useTimelineStore.getState()
    store.upsertEvent(makeTimelineEvent({ id: 'edge-1', title: 'A', status: 'running' }))
    store.upsertEvent(makeTimelineEvent({ id: 'edge-1', title: 'B', status: 'running' }))
    store.upsertEvent(makeTimelineEvent({ id: 'edge-1', title: 'C', status: 'done' }))
    expect(events().length).toBe(1)
    expect(events()[0]!.title).toBe('C')
    expect(events()[0]!.status).toBe('done')
  })

  it('upsertEvent 后 removeEvent → events 长度=0', () => {
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'edge-2' }))
    expect(events().length).toBe(1)
    useTimelineStore.getState().removeEvent('edge-2')
    expect(events().length).toBe(0)
  })

  it('upsertEvent 与 setEvents 共存:setEvents 覆盖后 upsertEvent 仍可工作', () => {
    useTimelineStore
      .getState()
      .setEvents([
        makeTimelineEvent({ id: 'edge-3a', title: '预设 A' }),
        makeTimelineEvent({ id: 'edge-3b', title: '预设 B' }),
      ])
    expect(events().length).toBe(2)
    // upsertEvent 更新其中一个
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'edge-3a', title: '更新 A', status: 'done' }))
    expect(events().length).toBe(2)
    expect(events()[0]!.title).toBe('更新 A')
    // upsertEvent 新增一个
    useTimelineStore.getState().upsertEvent(makeTimelineEvent({ id: 'edge-3c', title: '新增 C' }))
    expect(events().length).toBe(3)
  })

  it('upsertEvent meta 浅合并:新 meta 覆盖旧 meta(不深度合并)', () => {
    useTimelineStore.getState().addEvent(
      makeTimelineEvent({
        id: 'edge-4',
        meta: { phase: 'spawn', subagentId: 'edge-4', extra: 'keep' },
      }),
    )
    // upsertEvent 传入新的 meta(整体替换,不深合并)
    useTimelineStore.getState().upsertEvent(
      makeTimelineEvent({
        id: 'edge-4',
        meta: { phase: 'thinking', iteration: 1 },
      }),
    )
    // meta 被整体替换为新值(shallow merge 语义)
    expect(events()[0]!.meta).toEqual({ phase: 'thinking', iteration: 1 })
  })

  it('upsertEvent children 字段:新 children 覆盖旧 children', () => {
    const oldChildren: TimelineEvent[] = [
      { id: 'c1', type: 'tool', timestamp: '2026-07-29T10:00:00Z', title: 'old', status: 'done' },
    ]
    const newChildren: TimelineEvent[] = [
      { id: 'c2', type: 'tool', timestamp: '2026-07-29T10:01:00Z', title: 'new', status: 'done' },
    ]
    useTimelineStore.getState().addEvent(makeTimelineEvent({ id: 'edge-5', children: oldChildren }))
    useTimelineStore
      .getState()
      .upsertEvent(makeTimelineEvent({ id: 'edge-5', children: newChildren }))
    expect(events()[0]!.children).toBe(newChildren)
    expect(events()[0]!.children?.length).toBe(1)
    expect(events()[0]!.children?.[0]?.id).toBe('c2')
  })
})
