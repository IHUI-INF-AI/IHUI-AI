/**
 * Agent 主循环集成测试 — Plugins + PlanMachine 接入 runToolLoop。
 *
 * 覆盖:
 *   1. plugins 传入空 PluginRegistry → 行为与不传 plugins 一致(工具正常执行)
 *   2. plugins 传入带 preToolCall hook 声明的注册表 → runHook 被调用(hook 入口触发)
 *   3. planMachine 传入 initialized 状态 → isWriteBlocked=false,工具正常执行
 *   4. planMachine 传入 gathering 状态 → isWriteBlocked=true,工具不执行,追加阻断提示
 *   5. 不传 planMachine → 行为不变(向后兼容,现有测试通过)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerTools,
  clearTools,
  type Tool,
} from '../src/tools/index.js'
import { PluginRegistry } from '../src/plugins/index.js'
import { PlanMachine } from '../src/plan/index.js'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
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
}))

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop } from '../src/commands/agent.js'

// ---- 辅助:mock 工具 + 流式响应 ----
let toolCallCount = 0
const mockTool: Tool = {
  name: 'mock',
  description: 'mock tool for testing',
  parameters: {},
  required: [],
  execute: async () => {
    toolCallCount++
    return { success: true, output: `mock-called-${toolCallCount}` }
  },
}

function setStreamResponses(responses: string[]): void {
  for (const text of responses) {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta(text)
    })
  }
}

describe('runToolLoop + Plugins 集成', () => {
  beforeEach(() => {
    toolCallCount = 0
    clearTools()
    registerTools([mockTool])
    streamChatMock.mockReset()
  })

  it('传入空 PluginRegistry → 工具正常执行(行为与不传 plugins 一致)', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const registry = new PluginRegistry()
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      plugins: registry,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(toolCallCount).toBe(1)
    expect(registry.size()).toBe(0)
  })

  it('传入带 preToolCall hook 声明的 PluginRegistry → runHook 被调用(hook 入口触发)', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const registry = new PluginRegistry()
    registry.register({
      name: 'test-plugin',
      version: '1.0.0',
      hooks: ['preToolCall', 'postToolCall'],
      tools: ['mock'],
    })
    const spy = vi.spyOn(registry, 'runHook')
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      plugins: registry,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(toolCallCount).toBe(1)
    // runHook 至少被调用 2 次(preToolCall + postToolCall)
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2)
    // 调用事件包含 preToolCall 和 postToolCall
    const events = spy.mock.calls.map((c) => c[0])
    expect(events).toContain('preToolCall')
    expect(events).toContain('postToolCall')
  })

  it('不传 plugins → 行为不变(向后兼容,工具正常执行)', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
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
    expect(toolCallCount).toBe(1)
  })
})

describe('runToolLoop + PlanMachine 集成', () => {
  beforeEach(() => {
    toolCallCount = 0
    clearTools()
    registerTools([mockTool])
    streamChatMock.mockReset()
  })

  it('planMachine=initialized → isWriteBlocked=false,工具正常执行', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const planMachine = new PlanMachine('initialized')
    expect(planMachine.isWriteBlocked()).toBe(false)
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      planMachine,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(toolCallCount).toBe(1)
    expect(planMachine.getCurrentState()).toBe('initialized')
  })

  it('planMachine=gathering → isWriteBlocked=true,工具不执行,追加阻断提示', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const planMachine = new PlanMachine('gathering')
    expect(planMachine.isWriteBlocked()).toBe(true)
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'do task' },
    ]
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      planMachine,
    })
    expect(toolCallCount).toBe(0)
    expect(
      messages.some((m) => m.role === 'user' && m.content.includes('plan gathering 中,跳过写操作')),
    ).toBe(true)
    // 状态机保持 gathering(未触发 transition)
    expect(planMachine.getCurrentState()).toBe('gathering')
    expect(result.stopReason).toBe('end_turn')
  })

  it('不传 planMachine → 行为不变(向后兼容,工具正常执行)', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
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
    expect(toolCallCount).toBe(1)
  })
})
