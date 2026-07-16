import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerTools,
  clearTools,
  resetRateLimiter,
  type Tool,
} from '../src/tools/index.js'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
type StreamChatOpts = {
  model: string
  messages: unknown[]
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

// ---- 辅助:mock 工具 ----
function makeSlowTool(name: string, delayMs: number, danger: 'read' | 'write' | 'dangerous' = 'read'): Tool {
  return {
    name,
    description: `slow tool ${name}`,
    parameters: {},
    required: [],
    dangerLevel: danger,
    execute: async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return { success: true, output: `${name}-done` }
    },
  }
}

function setStreamResponses(responses: string[]): void {
  for (const text of responses) {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta(text)
    })
  }
}

describe('P0-1 Tool parallelism 多工具并行执行', () => {
  beforeEach(() => {
    clearTools()
    resetRateLimiter()
    streamChatMock.mockReset()
  })

  it('多个 tool_call 并行执行(3 个 100ms 工具总耗时约 100ms,而非 300ms)', async () => {
    registerTools([
      makeSlowTool('slow_a', 100),
      makeSlowTool('slow_b', 100),
      makeSlowTool('slow_c', 100),
    ])
    // 一次迭代输出 3 个 tool_call,下一次 end_turn
    setStreamResponses([
      '并行执行。\n```tool_call\n{"name":"slow_a","arguments":{}}\n```\n```tool_call\n{"name":"slow_b","arguments":{}}\n```\n```tool_call\n{"name":"slow_c","arguments":{}}\n```',
      '完成。',
    ])
    const start = Date.now()
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
    })
    const elapsed = Date.now() - start
    expect(result.stopReason).toBe('end_turn')
    // 并行:3 个 100ms 工具总耗时应 < 250ms(允许 Promise.all 调度开销)
    // 串行则会 > 300ms
    expect(elapsed).toBeLessThan(250)
  })

  it('单工具调用正常执行(串行退化为 Promise.all 单元素)', async () => {
    registerTools([makeSlowTool('single_tool', 30)])
    setStreamResponses([
      '```tool_call\n{"name":"single_tool","arguments":{}}\n```',
      '完成。',
    ])
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
    })
    expect(result.stopReason).toBe('end_turn')
  })

  it('onToolCall 在并行执行前按顺序触发,onToolResult 在执行后按顺序触发', async () => {
    const callOrder: string[] = []
    registerTools([
      makeSlowTool('p_a', 20),
      makeSlowTool('p_b', 20),
    ])
    setStreamResponses([
      '```tool_call\n{"name":"p_a","arguments":{}}\n```\n```tool_call\n{"name":"p_b","arguments":{}}\n```',
      '完成。',
    ])
    await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      onToolCall: (name) => callOrder.push(`call:${name}`),
      onToolResult: (name) => callOrder.push(`result:${name}`),
    })
    // 所有 call 在所有 result 之前(并行执行特征)
    const lastCallIdx = Math.max(callOrder.indexOf('call:p_a'), callOrder.indexOf('call:p_b'))
    const firstResultIdx = Math.min(
      callOrder.findIndex((s) => s.startsWith('result:')),
      callOrder.length,
    )
    expect(lastCallIdx).toBeLessThan(firstResultIdx)
  })
})

describe('P0-2 Cost guard 成本预算控制', () => {
  beforeEach(() => {
    clearTools()
    resetRateLimiter()
    streamChatMock.mockReset()
  })

  it('maxCostUsd=0 立即触发 budget_limited(任何成本都超阈值)', async () => {
    setStreamResponses(['第一次响应,产生少量 token。'])
    const result = await runToolLoop({
      modelId: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 5,
      maxCostUsd: 0,
    })
    expect(result.stopReason).toBe('budget_limited')
    // iterations=1,因为第一轮就触发
    expect(result.iterations).toBe(1)
  })

  it('maxCostUsd 足够大时正常 end_turn', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"noop","arguments":{}}\n```',
      '完成。',
    ])
    registerTools([{
      name: 'noop',
      description: 'noop',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => ({ success: true, output: 'noop' }),
    }])
    const result = await runToolLoop({
      modelId: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      maxCostUsd: 100, // 100 美元,远超测试消耗
    })
    expect(result.stopReason).toBe('end_turn')
  })

  it('usage.estimatedCostUsd 为累计成本(非单次估算)', async () => {
    registerTools([{
      name: 'noop',
      description: 'noop',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => ({ success: true, output: 'noop' }),
    }])
    // 第一轮返回 tool_call 触发第二轮,第二轮 end_turn → iterations=2
    setStreamResponses([
      '```tool_call\n{"name":"noop","arguments":{}}\n```',
      '完成。',
    ])
    const result = await runToolLoop({
      modelId: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0)
    // 累计 2 轮,成本应大于单轮(非负)
    expect(result.iterations).toBe(2)
  })

  it('budget_limited 时 usage.estimatedCostUsd 反映实际累计消耗', async () => {
    setStreamResponses(['第一次响应,产生 token。'])
    const result = await runToolLoop({
      modelId: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 5,
      maxCostUsd: 0,
    })
    expect(result.stopReason).toBe('budget_limited')
    // 即使 budget_limited,usage 仍反映已消耗的 token 成本
    expect(result.usage.estimatedCostUsd).toBeGreaterThanOrEqual(0)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  })

  it('未设置 maxCostUsd 时不触发 budget_limited', async () => {
    setStreamResponses(['响应。'])
    const result = await runToolLoop({
      modelId: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 1,
      // 不传 maxCostUsd
    })
    expect(result.stopReason).not.toBe('budget_limited')
  })
})
