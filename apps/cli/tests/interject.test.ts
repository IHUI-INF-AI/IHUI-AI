import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerTools,
  clearTools,
  resetRateLimiter,
} from '../src/tools/index.js'

// ---- mock streamChat + auditLog ----
type StreamChatOpts = {
  model: string
  messages: unknown[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (err: string) => void
  onDone?: () => void
}
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
}))

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
  parseStreamLine: (line: string) => {
    const m = line.match(/^data:\s*(.+)$/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return m[1];
    }
  },
}))

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop, type InterjectionBlock } from '../src/commands/agent.js'

function setStreamResponses(responses: string[]): void {
  for (const text of responses) {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta(text)
    })
  }
}

describe('P0-2 Interject 中途插话', () => {
  beforeEach(() => {
    clearTools()
    resetRateLimiter()
    streamChatMock.mockReset()
  })

  it('无 drainInterjections 时正常 end_turn', async () => {
    setStreamResponses(['直接回复,不调用工具。'])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(result.iterations).toBe(1)
  })

  it('end_turn 时 drain 到 interjection → 继续下一轮处理', async () => {
    const drained: InterjectionBlock[] = []
    let drainCallCount = 0
    const drainInterjections = (): InterjectionBlock[] => {
      drainCallCount++
      if (drainCallCount === 1) return []
      if (drainCallCount === 2) {
        const block: InterjectionBlock = { type: 'text', text: '顺便也加上 X' }
        drained.push(block)
        return [block]
      }
      return []
    }
    setStreamResponses([
      '任务完成。',
      '好的,已加上 X。',
    ])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 5,
      drainInterjections,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(result.iterations).toBe(2)
    expect(drained).toEqual([{ type: 'text', text: '顺便也加上 X' }])
  })

  it('工具执行期间 drain 到 interjection → 下一轮 LLM 看到 interjection', async () => {
    registerTools([{
      name: 'noop',
      description: 'noop',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => ({ success: true, output: 'noop done' }),
    }])
    let drainCallCount = 0
    const drainInterjections = (): InterjectionBlock[] => {
      drainCallCount++
      if (drainCallCount === 2) {
        return [{ type: 'text', text: '顺便检查 Y' }]
      }
      return []
    }
    setStreamResponses([
      '```tool_call\n{"name":"noop","arguments":{}}\n```',
      '已完成,也检查了 Y。',
    ])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 5,
      drainInterjections,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(result.iterations).toBe(2)
    expect(drainCallCount).toBeGreaterThanOrEqual(2)
  })

  it('interjection 不会无限循环(第二轮 end_turn 后 drain 为空 → break)', async () => {
    let drainCallCount = 0
    const drainInterjections = (): InterjectionBlock[] => {
      drainCallCount++
      if (drainCallCount === 2) return [{ type: 'text', text: 'interject 1' }]
      return []
    }
    setStreamResponses([
      'end_turn 1',
      '处理 interject 1',
    ])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 10,
      drainInterjections,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(result.iterations).toBe(2)
  })

  it('maxIterations 限制下 interjection 不超出迭代预算', async () => {
    let drainCallCount = 0
    const drainInterjections = (): InterjectionBlock[] => {
      drainCallCount++
      return [{ type: 'text', text: `interject ${drainCallCount}` }]
    }
    setStreamResponses([
      'resp 1',
      'resp 2',
      'resp 3',
    ])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      drainInterjections,
    })
    expect(result.stopReason).toBe('max_iterations')
    expect(result.iterations).toBe(3)
  })
})
