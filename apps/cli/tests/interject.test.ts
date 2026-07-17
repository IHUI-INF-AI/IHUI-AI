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
}))

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop } from '../src/commands/agent.js'

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
    // 第一轮:end_turn;drain 到 interjection 后继续;第二轮:end_turn
    const drained: string[] = []
    let drainCallCount = 0
    const drainInterjections = (): string[] => {
      drainCallCount++
      if (drainCallCount === 1) {
        // runToolLoop 开始时 drain(无内容)
        return []
      }
      if (drainCallCount === 2) {
        // end_turn 时 drain(有 interjection)
        drained.push('顺便也加上 X')
        return ['顺便也加上 X']
      }
      return []
    }
    setStreamResponses([
      '任务完成。',                                  // 第一轮 end_turn
      '好的,已加上 X。',                            // 第二轮 end_turn(处理 interjection)
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
    expect(drained).toEqual(['顺便也加上 X'])
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
    const drainInterjections = (): string[] => {
      drainCallCount++
      if (drainCallCount === 2) {
        // 第二轮开始时 drain(第一轮工具执行期间用户输入了 interjection)
        return ['顺便检查 Y']
      }
      return []
    }
    setStreamResponses([
      '```tool_call\n{"name":"noop","arguments":{}}\n```',  // 第一轮 tool_call
      '已完成,也检查了 Y。',                                // 第二轮 end_turn
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
    // 通过 drainCallCount 验证 drain 被调用(messages 不在 result 中)
    expect(drainCallCount).toBeGreaterThanOrEqual(2)
  })

  it('interjection 不会无限循环(第二轮 end_turn 后 drain 为空 → break)', async () => {
    let drainCallCount = 0
    const drainInterjections = (): string[] => {
      drainCallCount++
      if (drainCallCount === 2) return ['interject 1']
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
    const drainInterjections = (): string[] => {
      drainCallCount++
      // 每次都返回 interjection(会持续 continue)
      return [`interject ${drainCallCount}`]
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
    // 应该在 maxIterations 处停止
    expect(result.stopReason).toBe('max_iterations')
    expect(result.iterations).toBe(3)
  })
})
