// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-639(2026-09-29)每个 tool_call 各自的 cancelled 合成帧。
 *
 * 票面判据:取消时不得只发一帧整体 cancelled,须逐未完成的 tool_call 合成;
 * 用例 "两个 in-flight tool_call ⇒ 两帧"。
 *
 * 两层判据:
 *  - 纯函数面(stream-cancel-frames):N 个未完成调用 ⇒ N 帧,一一对应、
 *    按建卡顺序、id 逐字保留;空在途 ⇒ 空帧列(一帧都不发);非法 id 跳过。
 *  - ACP 接线面(mock runToolLoop,复用 acp-events 的假 AgentContext 骨架):
 *    正常取消返回与 abort 抛错两条取消出口都逐卡发帧;映射口径
 *    status:'failed' + rawOutput.cancelled=true(ACP 词表无 'cancelled' 档)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import os from 'node:os'
import path from 'node:path'

import {
  synthesizeCancelledToolFrames,
} from '../src/stream-cancel-frames.js'

// ---------- 纯函数面 ----------

describe('G-639 逐未完成 tool_call 合成 cancelled 帧(纯函数面)', () => {
  it('两个 in-flight tool_call ⇒ 两帧(票面判据)', () => {
    const frames = synthesizeCancelledToolFrames([
      { toolCallId: 'call-a', toolName: 'read_file' },
      { toolCallId: 'call-b', toolName: 'exec' },
    ])
    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual({ toolCallId: 'call-a', toolName: 'read_file', terminal: 'cancelled' })
    expect(frames[1]).toEqual({ toolCallId: 'call-b', toolName: 'exec', terminal: 'cancelled' })
  })

  it('帧按建卡顺序一一对应,id 逐字保留(N 个 ⇒ N 帧)', () => {
    const ids = ['c1', 'c2', 'c3', 'c4']
    const frames = synthesizeCancelledToolFrames(ids.map((toolCallId) => ({ toolCallId })))
    expect(frames.map((f) => f.toolCallId)).toEqual(ids)
    expect(frames.every((f) => f.terminal === 'cancelled')).toBe(true)
  })

  it('空在途 ⇒ 空帧列;空/非法 id 跳过(宁缺勿假)', () => {
    expect(synthesizeCancelledToolFrames([])).toEqual([])
    const frames = synthesizeCancelledToolFrames([
      { toolCallId: '' },
      { toolCallId: 'ok' },
      { toolCallId: undefined as unknown as string },
    ])
    expect(frames).toHaveLength(1)
    expect(frames[0]!.toolCallId).toBe('ok')
  })
})

// ---------- ACP 接线面 ----------

const mocks = vi.hoisted(() => ({
  setupAgentTools: vi.fn(),
  /** 由每个用例注入:假 tool loop 会按需触发 ACP 回调 */
  loopImpl: null as null | ((opts: Record<string, unknown>) => Promise<unknown>),
}))

vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: mocks.setupAgentTools,
  runToolLoop: vi.fn(async (opts: Record<string, unknown>) => {
    if (!mocks.loopImpl) throw new Error('loopImpl not set')
    return mocks.loopImpl(opts)
  }),
}))

const { IhuiAcpAgent } = await import('../src/acp/server.js')

interface NotifyRecord {
  method: string
  params: { sessionId?: string; update?: Record<string, unknown> }
}

function makeCx(records: NotifyRecord[]) {
  return {
    notify: async (method: string, params: NotifyRecord['params']) => {
      records.push({ method, params })
    },
    request: async () => ({ outcome: { outcome: 'cancelled' } }),
  }
}

const WORKSPACE = path.join(os.tmpdir(), 'ihui-cancel-frames-test')

function makeAgent() {
  return new IhuiAcpAgent({
    apiUrl: 'http://localhost:8803',
    modelId: 'test-model',
    maxIterations: 3,
    planFirst: false,
    allowDangerous: false,
  })
}

function updatesOf(records: NotifyRecord[], kind: string): Array<Record<string, unknown>> {
  return records
    .map((r) => r.params.update)
    .filter((u): u is Record<string, unknown> => !!u && u.sessionUpdate === kind)
}

describe('G-639 ACP 取消出口逐卡发帧(两个 in-flight ⇒ 两帧)', () => {
  beforeEach(() => {
    mocks.loopImpl = null
    mocks.setupAgentTools.mockReset()
    mocks.setupAgentTools.mockResolvedValue({ systemPrompt: 'sys-prompt', ctx: {} })
  })

  async function runPrompt(
    sessionId: string,
    agent: InstanceType<typeof IhuiAcpAgent>,
    loopImpl: (opts: Record<string, unknown>) => Promise<unknown>,
  ) {
    mocks.loopImpl = loopImpl
    const records: NotifyRecord[] = []
    const cx = makeCx(records)
    const res = await agent.prompt(
      { sessionId, prompt: [{ type: 'text', text: 'hi' }] } as never,
      cx as never,
    )
    return { records, res }
  }

  it('取消返回路径:两个已建卡未出结果的 tool_call ⇒ 两帧 cancelled(failed+cancelled 标记)', async () => {
    const agent = makeAgent()
    const { sessionId } = await agent.newSession({ cwd: WORKSPACE, mcpServers: [] } as never)
    const { records, res } = await runPrompt(sessionId, agent, async (opts) => {
      const onToolCall = opts.onToolCall as (n: string, a: unknown) => Promise<void>
      await onToolCall('read_file', { path: 'a.ts' })
      await onToolCall('exec', { cmd: 'ls' })
      // 没有任何 onToolResult:两个 in-flight,回合被取消
      return { assistantText: '', stopReason: 'cancelled' }
    })

    expect((res as { stopReason: string }).stopReason).toBe('cancelled')
    const calls = updatesOf(records, 'tool_call')
    const updates = updatesOf(records, 'tool_call_update')
    expect(calls).toHaveLength(2)
    expect(updates).toHaveLength(2) // 两帧,不是一帧整体 cancelled
    expect(updates.map((u) => u.toolCallId)).toEqual(calls.map((c) => c.toolCallId))
    for (const u of updates) {
      expect(u.status).toBe('failed') // ACP 词表映射
      expect(u.rawOutput).toEqual({ cancelled: true })
    }
  })

  it('abort 抛错路径:同样逐卡发帧,卡不悬空', async () => {
    const agent = makeAgent()
    const { sessionId } = await agent.newSession({ cwd: WORKSPACE, mcpServers: [] } as never)
    const { records, res } = await runPrompt(sessionId, agent, async (opts) => {
      const onToolCall = opts.onToolCall as (n: string, a: unknown) => Promise<void>
      await onToolCall('read_file', { path: 'a.ts' })
      await onToolCall('exec', { cmd: 'ls' })
      agent.cancel({ sessionId }) // 中止内部 abort 控制器,模拟编辑器侧 cancel
      throw new Error('aborted mid-turn')
    })

    expect((res as { stopReason: string }).stopReason).toBe('cancelled')
    const calls = updatesOf(records, 'tool_call')
    const updates = updatesOf(records, 'tool_call_update')
    expect(calls).toHaveLength(2)
    expect(updates).toHaveLength(2)
    expect(updates.map((u) => u.toolCallId)).toEqual(calls.map((c) => c.toolCallId))
    expect(updates.every((u) => u.rawOutput != null && (u.rawOutput as Record<string, unknown>).cancelled === true)).toBe(true)
  })

  it('正常完成(end_turn)不触发取消帧:既有行为零回归', async () => {
    const agent = makeAgent()
    const { sessionId } = await agent.newSession({ cwd: WORKSPACE, mcpServers: [] } as never)
    const { records } = await runPrompt(sessionId, agent, async (opts) => {
      const onToolCall = opts.onToolCall as (n: string, a: unknown) => Promise<void>
      const onToolResult = opts.onToolResult as (n: string, ok: boolean, out: string) => Promise<void>
      await onToolCall('read_file', { path: 'a.ts' })
      await onToolResult('read_file', true, 'out')
      return { assistantText: 'done' }
    })

    const updates = updatesOf(records, 'tool_call_update')
    expect(updates).toHaveLength(1)
    expect(updates[0]!.status).toBe('completed')
    expect(updates[0]!.rawOutput).toBeUndefined()
  })
})
