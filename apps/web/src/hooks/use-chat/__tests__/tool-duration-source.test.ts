// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具耗时来源切换(D49② / G-61②,2026-09-24 立)。
 *
 * 修复前:stream-handlers 只在 tool-call-start 记本地时钟、result 到达时相减,
 * 后端帧不带 durationMs ⇒ 断线 / 刷新 / 回放即拿不到耗时。
 * 修复后:后端 durationMs 优先,缺省时才回退本地时钟,两条分支各钉一条用例。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createToolCallHandler,
  resolveToolDurationMs,
  type ResolvedToolDuration,
} from '../stream-handlers'

const { mockAddToolCall, mockUpdateToolCall } = vi.hoisted(() => ({
  mockAddToolCall: vi.fn(),
  mockUpdateToolCall: vi.fn(),
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({ addToolCall: mockAddToolCall, updateToolCall: mockUpdateToolCall }),
  },
}))
vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: { getState: () => ({ openPanel: vi.fn() }) },
}))
vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@ihui/api-client', () => ({ PROVIDER_QUOTA_EXHAUSTED: 'PROVIDER_QUOTA_EXHAUSTED' }))

/** 取 updateToolCall 收到的 updates 载荷(第三参数) */
function lastUpdates(): Record<string, unknown> {
  expect(mockUpdateToolCall).toHaveBeenCalledTimes(1)
  const call = mockUpdateToolCall.mock.calls[0]
  expect(call).toBeDefined()
  return (call as unknown as [string, string, Record<string, unknown>])[2]
}

describe('resolveToolDurationMs 两条分支', () => {
  it('后端下发 → 用后端值,source=server(哪怕本地时钟差完全不同)', () => {
    const resolved: ResolvedToolDuration | null = resolveToolDurationMs({
      serverDurationMs: 1234,
      startedAt: 1_000,
      now: 99_000,
    })
    expect(resolved).toEqual({ durationMs: 1234, source: 'server' })
  })

  it('后端未下发(undefined)→ 回退本地时钟,source=client', () => {
    const resolved = resolveToolDurationMs({ serverDurationMs: undefined, startedAt: 1_000, now: 1_500 })
    expect(resolved).toEqual({ durationMs: 500, source: 'client' })
  })

  it('后端下发非法值(负数 / NaN)→ 视为未下发,仍回退本地时钟', () => {
    expect(resolveToolDurationMs({ serverDurationMs: -5, startedAt: 1_000, now: 1_500 })).toEqual({
      durationMs: 500,
      source: 'client',
    })
    expect(resolveToolDurationMs({ serverDurationMs: Number.NaN, startedAt: 1_000, now: 1_500 })).toEqual(
      { durationMs: 500, source: 'client' },
    )
  })

  it('两者都没有 → null(不写 durationMs,卡片不给假耗时)', () => {
    expect(resolveToolDurationMs({ now: 5_000 })).toBeNull()
  })

  it('后端下发 0 是合法值(去重跳过的工具耗时≈0),不得被"假值"判断吃掉', () => {
    expect(resolveToolDurationMs({ serverDurationMs: 0, startedAt: 1_000, now: 9_000 })).toEqual({
      durationMs: 0,
      source: 'server',
    })
  })
})

describe('createToolCallHandler 的耗时接线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_700_000_000_000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('分支①:后端下发 durationMs 时写入后端值(与本地推进的 9s 无关)', () => {
    const handler = createToolCallHandler('msg-1')
    handler({ type: 'tool-call-start', toolCallId: 'tc-1', toolName: 'read_file', args: {} })
    vi.advanceTimersByTime(9_000)
    handler({
      type: 'tool-result',
      toolCallId: 'tc-1',
      toolName: 'read_file',
      result: { ok: true },
      durationMs: 250,
    })

    const updates = lastUpdates()
    expect(updates.durationMs).toBe(250)
    expect(updates.status).toBe('success')
  })

  it('分支②:后端未下发时回退本地时钟(旧版本帧不留白)', () => {
    const handler = createToolCallHandler('msg-2')
    handler({ type: 'tool-call-start', toolCallId: 'tc-2', toolName: 'read_file', args: {} })
    vi.advanceTimersByTime(1_200)
    handler({ type: 'tool-result', toolCallId: 'tc-2', toolName: 'read_file', result: { ok: true } })

    expect(lastUpdates().durationMs).toBe(1_200)
  })

  it('回放语义:没收到 tool-call-start 也能出耗时(断线重连只回放 result 帧)', () => {
    const handler = createToolCallHandler('msg-3')
    handler({
      type: 'tool-result',
      toolCallId: 'tc-replay',
      toolName: 'web_search',
      result: { ok: true },
      durationMs: 4_321,
    })
    expect(lastUpdates().durationMs).toBe(4_321)
  })

  it('起点即释:后端值到手后本地起点被清掉,同 id 第二帧不再回退到旧起点', () => {
    const handler = createToolCallHandler('msg-4')
    handler({ type: 'tool-call-start', toolCallId: 'tc-4', toolName: 'run_command', args: {} })
    handler({
      type: 'tool-result',
      toolCallId: 'tc-4',
      toolName: 'run_command',
      result: { ok: true },
      durationMs: 10,
    })
    vi.clearAllMocks()
    vi.advanceTimersByTime(5_000)
    handler({ type: 'tool-result', toolCallId: 'tc-4', toolName: 'run_command', result: { ok: true } })
    expect('durationMs' in lastUpdates()).toBe(false)
  })

  it('后端值为负数时按未下发处理(回退本地时钟而非写负值)', () => {
    const handler = createToolCallHandler('msg-5')
    handler({ type: 'tool-call-start', toolCallId: 'tc-5', toolName: 'read_file', args: {} })
    vi.advanceTimersByTime(800)
    handler({
      type: 'tool-result',
      toolCallId: 'tc-5',
      toolName: 'read_file',
      result: { ok: true },
      durationMs: -1,
    })
    expect(lastUpdates().durationMs).toBe(800)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
