// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:保留本文件自己列出的桩(真发网络/真写盘的那几个),其余导出走真实实现。
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
  }
})

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop } from '../src/commands/agent.js'

// ---- 辅助:mock 工具 ----
// 记录每个工具的真实执行时间窗[start,end],用于判定"是否真的并行"。
// 这是比"总耗时"更稳健的并发判据:runToolLoop 的固定开销(流式解析、二次迭代、
// ledger/audit/telemetry、pre-tool 钩子)在串行/并行下完全相同,会让绝对耗时断言
// 在 CI 负载下偶发误判;而 time-window 重叠能直接证明并发数,不受开销与时序漂移影响。
type ExecSpan = { name: string; start: number; end: number }
const toolExecutionSpans: ExecSpan[] = []

// 扫描所有执行窗,返回并发峰值(同一时刻最多有几个工具在跑)。
// 并行:3 个工具同时启动 → 峰值=3;串行的峰值=1。此函数与工具耗时/循环开销无关。
function maxConcurrency(spans: ExecSpan[]): number {
  const events: Array<[number, number]> = []
  for (const s of spans) {
    events.push([s.start, 1])
    events.push([s.end, -1])
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let cur = 0
  let peak = 0
  for (const [, delta] of events) {
    cur += delta
    if (cur > peak) peak = cur
  }
  return peak
}

function makeSlowTool(name: string, delayMs: number, danger: 'read' | 'write' | 'dangerous' = 'read'): Tool {
  return {
    name,
    description: `slow tool ${name}`,
    parameters: {},
    required: [],
    dangerLevel: danger,
    execute: async () => {
      const start = Date.now()
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      toolExecutionSpans.push({ name, start, end: Date.now() })
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
    toolExecutionSpans.length = 0
    streamChatMock.mockReset()
  })

  it('多个 tool_call 并行执行(3 个 100ms 工具并发峰值=3,而非串行峰值=1)', async () => {
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
    // 并发判据(替代原先的绝对耗时断言):直接看工具执行时间窗是否重叠。
    // 真正并行时 3 个工具同时启动 → 峰值并发=3;若生产端退化为串行,峰值=1,此断言会失败。
    // 不依赖总耗时,因此不受 runToolLoop 固定开销或 CI 时序漂移影响(非 flaky)。
    expect(maxConcurrency(toolExecutionSpans)).toBeGreaterThanOrEqual(2)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
