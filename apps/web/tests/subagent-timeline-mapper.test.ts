/**
 * subagent-timeline-mapper 纯函数单元测试(2026-07-29 立,Phase 21)
 *
 * 覆盖:
 * - mapSpawnToTimelineEvent:SubagentSpawnEvent → TimelineEvent 映射
 * - mapProgressToTimelineUpdate:SubagentProgressEvent → Partial<TimelineEvent> 映射
 * - mapEndToTimelineUpdate:SubagentEndEvent → Partial<TimelineEvent> 映射
 * - 边界:空字段 / 超长字段截断 / 缺失可选字段 / id 一致性
 *
 * 被测契约见任务说明,AGENTS.md §3:测试文件允许 any(mock 场景)。
 */

import { describe, it, expect } from 'vitest'
import {
  mapSpawnToTimelineEvent,
  mapProgressToTimelineUpdate,
  mapEndToTimelineUpdate,
} from '@/lib/subagent-timeline-mapper'
import type { SubagentSpawnEvent, SubagentEndEvent, SubagentProgressEvent } from '@ihui/api-client'
import type { TimelineEvent } from '@/stores/timeline-store'

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeSpawnEvent(overrides: Partial<SubagentSpawnEvent> = {}): SubagentSpawnEvent {
  return {
    id: overrides.id ?? 'sub-abc123',
    role: overrides.role ?? 'code-reviewer',
    task: overrides.task ?? '审查 auth 模块',
    timestamp: overrides.timestamp ?? '2026-07-29T10:00:00.000Z',
  }
}

function makeProgressEvent(overrides: Partial<SubagentProgressEvent> = {}): SubagentProgressEvent {
  return {
    id: overrides.id ?? 'sub-abc123',
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
    id: overrides.id ?? 'sub-abc123',
    status: overrides.status ?? 'done',
    failureReason: overrides.failureReason,
    timestamp: overrides.timestamp ?? '2026-07-29T10:01:00.000Z',
  }
}

// ─── mapSpawnToTimelineEvent ──────────────────────────────────────
describe('mapSpawnToTimelineEvent', () => {
  it('基本映射:role/task/timestamp 正确映射到 title/description/timestamp', () => {
    const event = makeSpawnEvent({
      id: 'sub-1',
      role: 'code-reviewer',
      task: '审查 auth 模块',
      timestamp: '2026-07-29T10:00:00.000Z',
    })
    const result = mapSpawnToTimelineEvent(event)
    expect(result.title).toBe('code-reviewer')
    expect(result.description).toBe('审查 auth 模块')
    expect(result.timestamp).toBe('2026-07-29T10:00:00.000Z')
    expect(result.id).toBe('sub-1')
  })

  it('type="subagent"', () => {
    const result = mapSpawnToTimelineEvent(makeSpawnEvent())
    expect(result.type).toBe('subagent')
  })

  it('status="running"', () => {
    const result = mapSpawnToTimelineEvent(makeSpawnEvent())
    expect(result.status).toBe('running')
  })

  it('meta 含 subagentId + phase="spawn"', () => {
    const event = makeSpawnEvent({ id: 'sub-meta-1' })
    const result = mapSpawnToTimelineEvent(event)
    expect(result.meta).toBeDefined()
    expect(result.meta?.subagentId).toBe('sub-meta-1')
    expect(result.meta?.phase).toBe('spawn')
  })

  it('空 role → title 为空字符串(不报错)', () => {
    const event = makeSpawnEvent({ role: '' })
    const result = mapSpawnToTimelineEvent(event)
    expect(result.title).toBe('')
  })

  it('空 task → description 为空字符串(不报错)', () => {
    const event = makeSpawnEvent({ task: '' })
    const result = mapSpawnToTimelineEvent(event)
    expect(result.description).toBe('')
  })

  it('超长 task(>80 字符)→ description 截断到 80 字符(含省略号)', () => {
    const longTask = 'A'.repeat(120)
    const event = makeSpawnEvent({ task: longTask })
    const result = mapSpawnToTimelineEvent(event)
    expect(result.description?.length).toBeLessThanOrEqual(80)
    // 截断后不应是原始超长文本
    expect(result.description).not.toBe(longTask)
    // 截断标识:应包含省略号或截断标记
    expect(result.description).toContain('…')
    // 应包含前部分字符
    expect(result.description).toContain('A')
  })
})

// ─── mapProgressToTimelineUpdate ──────────────────────────────────
describe('mapProgressToTimelineUpdate', () => {
  // --- phase='thinking' ---
  it('phase="thinking" + iteration=1 → description 含 "思考中" + "第 1 轮"', () => {
    const event = makeProgressEvent({ phase: 'thinking', iteration: 1 })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('思考中')
    expect(result!.updates.description).toContain('第 1 轮')
  })

  it('phase="thinking" + iteration=5 → description 含 "第 5 轮"', () => {
    const event = makeProgressEvent({ phase: 'thinking', iteration: 5 })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('第 5 轮')
  })

  it('phase="thinking" + 无 iteration → description 含 "思考中"(不报错)', () => {
    const event = makeProgressEvent({ phase: 'thinking' })
    // iteration 未设置
    delete event.iteration
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('思考中')
    // 无 iteration 时不应包含 "第 undefined 轮" 这种破损文本
    expect(result!.updates.description).not.toContain('undefined')
  })

  // --- phase='tool_call' ---
  it('phase="tool_call" + tool="search" + iteration=2 → description 含 "调用工具" + "search" + "第 2 轮"', () => {
    const event = makeProgressEvent({ phase: 'tool_call', tool: 'search', iteration: 2 })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('调用工具')
    expect(result!.updates.description).toContain('search')
    expect(result!.updates.description).toContain('第 2 轮')
  })

  it('phase="tool_call" + 无 tool → 返回 null(缺少必要字段,实现选择跳过更新)', () => {
    const event = makeProgressEvent({ phase: 'tool_call', iteration: 1 })
    delete event.tool
    const result = mapProgressToTimelineUpdate(event)
    // 实现对缺少 tool 的 tool_call 事件返回 null(不更新)
    expect(result).toBeNull()
  })

  // --- phase='tool_result' ---
  it('phase="tool_result" + tool="search" + ok=true → description 含 "工具返回" + "search" + "ok" 或 "成功"', () => {
    const event = makeProgressEvent({ phase: 'tool_result', tool: 'search', ok: true })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('工具返回')
    expect(result!.updates.description).toContain('search')
    // 接受 "ok" 或 "成功" 两种实现
    expect(result!.updates.description!.match(/(ok|成功)/i)).not.toBeNull()
  })

  it('phase="tool_result" + tool="search" + ok=false → description 含 "failed" 或 "失败"', () => {
    const event = makeProgressEvent({ phase: 'tool_result', tool: 'search', ok: false })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('工具返回')
    expect(result!.updates.description).toContain('search')
    // 接受 "failed" 或 "失败" 两种实现
    expect(result!.updates.description!.match(/(failed|失败)/i)).not.toBeNull()
  })

  // --- phase='output_ready' ---
  it('phase="output_ready" + outputPreview="Hello World" → description 含 "输出就绪" + "Hello World"', () => {
    const event = makeProgressEvent({ phase: 'output_ready', outputPreview: 'Hello World' })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('输出就绪')
    expect(result!.updates.description).toContain('Hello World')
  })

  it('phase="output_ready" + outputPreview 超 60 字符 → 截断到 60 字符', () => {
    const longPreview = 'B'.repeat(100)
    const event = makeProgressEvent({ phase: 'output_ready', outputPreview: longPreview })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    // description 中 "B" 连续段不应超过 60 字符
    const desc = result!.updates.description ?? ''
    const matches = desc.match(/B+/g) ?? []
    expect(matches.every((s) => s.length <= 60)).toBe(true)
    // 应包含至少 60 个 B
    expect(desc).toContain('B'.repeat(60))
  })

  it('phase="output_ready" + 无 outputPreview → description 含 "输出就绪"(不报错)', () => {
    const event = makeProgressEvent({ phase: 'output_ready' })
    delete event.outputPreview
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description).toContain('输出就绪')
    // 不应包含 "undefined" 破损文本
    expect(result!.updates.description).not.toContain('undefined')
  })

  // --- meta 正确性 ---
  it('meta 正确设置(phase / iteration / tool / ok / outputPreview)', () => {
    // thinking
    const r1 = mapProgressToTimelineUpdate(makeProgressEvent({ phase: 'thinking', iteration: 3 }))!
    expect(r1.updates.meta?.phase).toBe('thinking')
    expect(r1.updates.meta?.iteration).toBe(3)

    // tool_call
    const r2 = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_call', tool: 'edit', iteration: 2 }),
    )!
    expect(r2.updates.meta?.phase).toBe('tool_call')
    expect(r2.updates.meta?.tool).toBe('edit')
    expect(r2.updates.meta?.iteration).toBe(2)

    // tool_result
    const r3 = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'tool_result', tool: 'edit', ok: true }),
    )!
    expect(r3.updates.meta?.phase).toBe('tool_result')
    expect(r3.updates.meta?.tool).toBe('edit')
    expect(r3.updates.meta?.ok).toBe(true)

    // output_ready
    const r4 = mapProgressToTimelineUpdate(
      makeProgressEvent({ phase: 'output_ready', outputPreview: 'preview text' }),
    )!
    expect(r4.updates.meta?.phase).toBe('output_ready')
    expect(r4.updates.meta?.outputPreview).toBe('preview text')
  })

  it('description 截断到 80 字符(超长 tool name)', () => {
    const longTool = 'T'.repeat(100)
    const event = makeProgressEvent({ phase: 'tool_call', tool: longTool, iteration: 1 })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.updates.description?.length).toBeLessThanOrEqual(80)
  })

  it('返回的 id 与输入 event.id 一致', () => {
    const event = makeProgressEvent({ id: 'sub-id-42', phase: 'thinking', iteration: 1 })
    const result = mapProgressToTimelineUpdate(event)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('sub-id-42')
  })
})

// ─── mapEndToTimelineUpdate ───────────────────────────────────────
describe('mapEndToTimelineUpdate', () => {
  it('status="done" → updates.status="done"', () => {
    const event = makeEndEvent({ status: 'done' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.status).toBe('done')
  })

  it('status="done" → updates.description 含 "完成"', () => {
    const event = makeEndEvent({ status: 'done' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.description).toContain('完成')
  })

  it('status="done" → updates.meta 含 phase="end" + status="done"', () => {
    const event = makeEndEvent({ status: 'done' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.meta?.phase).toBe('end')
    expect(result.updates.meta?.status).toBe('done')
  })

  it('status="failed" → updates.status="failed"', () => {
    const event = makeEndEvent({ status: 'failed', failureReason: 'timeout' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.status).toBe('failed')
  })

  it('status="failed" + failureReason="timeout" → updates.description 含 "失败" + "timeout"', () => {
    const event = makeEndEvent({ status: 'failed', failureReason: 'timeout' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.description).toContain('失败')
    expect(result.updates.description).toContain('timeout')
  })

  it('status="failed" + failureReason 超长(>100 字符)→ description 被截断(不超过 80 字符)', () => {
    const longReason = 'E'.repeat(150)
    const event = makeEndEvent({ status: 'failed', failureReason: longReason })
    const result = mapEndToTimelineUpdate(event)
    const desc = result.updates.description ?? ''
    // description 最终被 truncate 到 80 字符(failureReason 先 slice(0,100),再整体 truncate(80))
    expect(desc.length).toBeLessThanOrEqual(80)
    // 不应包含完整的 150 字符 reason
    expect(desc).not.toContain(longReason)
    // 应包含截断标识
    expect(desc).toContain('…')
    // meta.failureReason 保留原始值(未截断)
    expect(result.updates.meta?.failureReason).toBe(longReason)
  })

  it('status="failed" + 无 failureReason → description 含 "失败"(不报错)', () => {
    const event = makeEndEvent({ status: 'failed' })
    delete event.failureReason
    const result = mapEndToTimelineUpdate(event)
    expect(result.updates.description).toContain('失败')
    // 不应包含 "undefined" 破损文本
    expect(result.updates.description).not.toContain('undefined')
  })

  it('返回的 id 与输入 event.id 一致', () => {
    const event = makeEndEvent({ id: 'sub-end-99', status: 'done' })
    const result = mapEndToTimelineUpdate(event)
    expect(result.id).toBe('sub-end-99')
  })
})

// ─── 综合边界场景 ──────────────────────────────────────────────────
describe('subagent-timeline-mapper 综合边界', () => {
  it('spawn → progress → end 全链路:meta.phase 演进 spawn→thinking→end', () => {
    const spawnEvt = makeSpawnEvent({ id: 'sub-flow-1' })
    const spawned = mapSpawnToTimelineEvent(spawnEvt)
    expect(spawned.meta?.phase).toBe('spawn')

    const progressEvt = makeProgressEvent({ id: 'sub-flow-1', phase: 'thinking', iteration: 1 })
    const progressResult = mapProgressToTimelineUpdate(progressEvt)
    expect(progressResult!.updates.meta?.phase).toBe('thinking')

    const endEvt = makeEndEvent({ id: 'sub-flow-1', status: 'done' })
    const endResult = mapEndToTimelineUpdate(endEvt)
    expect(endResult.updates.meta?.phase).toBe('end')
  })

  it('spawn 映射结果符合 TimelineEvent 接口(可安全写入 store)', () => {
    const event = makeSpawnEvent({ id: 'sub-store-1' })
    const result = mapSpawnToTimelineEvent(event)
    // 验证所有 TimelineEvent 必填字段
    expect(typeof result.id).toBe('string')
    expect(typeof result.type).toBe('string')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.title).toBe('string')
    expect(typeof result.status).toBe('string')
    // 可赋值给 TimelineEvent 类型(编译时保证,运行时再验字段)
    const _: TimelineEvent = result
    expect(_).toBeDefined()
  })

  it('progress 映射结果 updates 是 Partial<TimelineEvent>(只含被更新字段)', () => {
    const event = makeProgressEvent({ phase: 'thinking', iteration: 1 })
    const result = mapProgressToTimelineUpdate(event)!
    // updates 应包含 description + meta,不应包含 id/type/timestamp 等无关字段
    expect(result.updates.description).toBeDefined()
    expect(result.updates.meta).toBeDefined()
    // 不应包含 type(progress 不改变 type)
    expect(result.updates.type).toBeUndefined()
  })
})
