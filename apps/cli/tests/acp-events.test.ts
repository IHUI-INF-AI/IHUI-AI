// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * W3(2026-09-18)ACP 会话事件转发单测。
 *
 * 背景:此前 ACP 只转发 onDelta → agent_message_chunk,IDE(Zed/VSCode/Cursor)内
 * 工具执行与思考过程**全程黑盒**。本测试锁定补齐后的四类 SessionUpdate 转发契约:
 *   - onReasoning   → agent_thought_chunk(思考可视化)
 *   - onToolCall    → tool_call(in_progress,含 toolCallId/title/kind/rawInput)
 *   - onToolResult  → tool_call_update(completed|failed,结果文本 ≤8000 字符截断)
 * 并锁定防御分支:notify 抛错不得中断 agent;toolCallId 配对失败时宁缺勿假。
 *
 * 测试策略:mock `../src/commands/agent.js` 的 runToolLoop/setupAgentTools,
 * 用假 AgentContext 捕获 notify 载荷,端到端驱动 `IhuiAcpAgent.prompt()`
 * (而非只测拼接函数),确保回调确实接线到 ACP 协议层。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import os from 'node:os'
import path from 'node:path'

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

/** 假 ACP 连接上下文:只记录 notify(server 侧只用到 notify/request) */
function makeCx(records: NotifyRecord[], opts: { throwOnNotify?: boolean } = {}) {
  return {
    notify: async (method: string, params: NotifyRecord['params']) => {
      if (opts.throwOnNotify) throw new Error('IDE render failed')
      records.push({ method, params })
    },
    request: async () => ({ outcome: { outcome: 'cancelled' } }),
  }
}

const WORKSPACE = path.join(os.tmpdir(), 'ihui-acp-events-test')

function makeAgent() {
  return new IhuiAcpAgent({
    apiUrl: 'http://localhost:8803',
    modelId: 'test-model',
    maxIterations: 3,
    planFirst: false,
    allowDangerous: false,
  })
}

/** 从捕获的 notify 里挑出某类 sessionUpdate 载荷 */
function updatesOf(records: NotifyRecord[], kind: string): Array<Record<string, unknown>> {
  return records
    .map((r) => r.params.update)
    .filter((u): u is Record<string, unknown> => !!u && u.sessionUpdate === kind)
}

describe('W3 ACP 事件转发', () => {
  beforeEach(() => {
    mocks.loopImpl = null
    mocks.setupAgentTools.mockReset()
    mocks.setupAgentTools.mockResolvedValue({ systemPrompt: 'sys-prompt', ctx: {} })
  })

  async function runPrompt(
    loopImpl: (opts: Record<string, unknown>) => Promise<unknown>,
    cxOpts: { throwOnNotify?: boolean } = {},
  ) {
    mocks.loopImpl = loopImpl
    const agent = makeAgent()
    const { sessionId } = await agent.newSession({
      cwd: WORKSPACE,
      mcpServers: [],
    } as never)
    const records: NotifyRecord[] = []
    const cx = makeCx(records, cxOpts)
    const res = await agent.prompt(
      { sessionId, prompt: [{ type: 'text', text: 'hi' }] } as never,
      cx as never,
    )
    return { records, res, sessionId }
  }

  it('onReasoning → agent_thought_chunk(content.type=text)', async () => {
    const { records } = await runPrompt(async (opts) => {
      await (opts.onReasoning as (d: string) => Promise<void>)('先看看依赖树')
      return { assistantText: 'done' }
    })

    const thoughts = updatesOf(records, 'agent_thought_chunk')
    expect(thoughts).toHaveLength(1)
    expect(thoughts[0]).toEqual({
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: '先看看依赖树' },
    })
  })

  it('onToolCall → tool_call(in_progress,字段符合 ACP schema)', async () => {
    const { records } = await runPrompt(async (opts) => {
      await (opts.onToolCall as (n: string, a: unknown) => Promise<void>)('read_file', {
        path: 'a.ts',
      })
      return { assistantText: 'done' }
    })

    const calls = updatesOf(records, 'tool_call')
    expect(calls).toHaveLength(1)
    const c = calls[0]!
    expect(typeof c.toolCallId).toBe('string')
    expect((c.toolCallId as string).length).toBeGreaterThan(0)
    expect(c.title).toBe('read_file')
    expect(c.kind).toBe('read')
    expect(c.status).toBe('in_progress')
    expect(c.rawInput).toEqual({ path: 'a.ts' })
    expect(c.content).toEqual([])
  })

  it('onToolResult 与 onToolCall 按 FIFO 配对,completed → tool_call_update', async () => {
    const { records } = await runPrompt(async (opts) => {
      const onToolCall = opts.onToolCall as (n: string, a: unknown) => Promise<void>
      const onToolResult = opts.onToolResult as (
        n: string,
        ok: boolean,
        out: string,
      ) => Promise<void>
      await onToolCall('read_file', { path: 'a.ts' })
      await onToolCall('exec', { cmd: 'ls' })
      await onToolResult('read_file', true, 'file-content')
      await onToolResult('exec', false, 'boom')
      return { assistantText: 'done' }
    })

    const calls = updatesOf(records, 'tool_call')
    const results = updatesOf(records, 'tool_call_update')
    expect(results).toHaveLength(2)
    // 配对:FIFO 顺序与 tool_call 一致
    expect(results[0]!.toolCallId).toBe(calls[0]!.toolCallId)
    expect(results[1]!.toolCallId).toBe(calls[1]!.toolCallId)
    expect(results[0]!.status).toBe('completed')
    expect(results[1]!.status).toBe('failed')
    // content 是 [{type:'content', content:{type:'text', text}}] 嵌套形态
    expect(results[0]!.content).toEqual([
      { type: 'content', content: { type: 'text', text: 'file-content' } },
    ])
  })

  it('工具结果超长时安全截断(≤8000 字符 + 截断标记)', async () => {
    const long = 'x'.repeat(9000)
    const { records } = await runPrompt(async (opts) => {
      await (opts.onToolCall as (n: string, a: unknown) => Promise<void>)('exec', {})
      await (opts.onToolResult as (n: string, ok: boolean, out: string) => Promise<void>)(
        'exec',
        true,
        long,
      )
      return { assistantText: 'done' }
    })

    const results = updatesOf(records, 'tool_call_update')
    expect(results).toHaveLength(1)
    const content = results[0]!.content as Array<{
      content: { text: string }
    }>
    const text = content[0]!.content.text
    expect(text.length).toBeLessThanOrEqual(8000 + '…(结果已截断)'.length)
    expect(text.endsWith('…(结果已截断)')).toBe(true)
    expect(text.startsWith('x'.repeat(100))).toBe(true)
  })

  it('未配对(无对应 onToolCall)时跳过转发,宁缺勿假', async () => {
    const { records } = await runPrompt(async (opts) => {
      await (opts.onToolResult as (n: string, ok: boolean, out: string) => Promise<void>)(
        'exec',
        true,
        'orphan',
      )
      return { assistantText: 'done' }
    })

    expect(updatesOf(records, 'tool_call_update')).toHaveLength(0)
  })

  it('notify 抛错被吞:IDE 渲染失败不得中断 agent 执行', async () => {
    const { res } = await runPrompt(
      async (opts) => {
        await (opts.onReasoning as (d: string) => Promise<void>)('think')
        await (opts.onToolCall as (n: string, a: unknown) => Promise<void>)('exec', {})
        await (opts.onToolResult as (n: string, ok: boolean, out: string) => Promise<void>)(
          'exec',
          true,
          'out',
        )
        return { assistantText: 'still-fine' }
      },
      { throwOnNotify: true },
    )

    expect((res as { stopReason: string }).stopReason).toBe('refusal')
  })

  it('onDelta 仍走 agent_message_chunk(既有行为零回归)', async () => {
    const { records } = await runPrompt(async (opts) => {
      await (opts.onDelta as (d: string) => Promise<void>)('正文增量')
      return { assistantText: 'done' }
    })

    const chunks = updatesOf(records, 'agent_message_chunk')
    expect(chunks[0]).toEqual({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: '正文增量' },
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
