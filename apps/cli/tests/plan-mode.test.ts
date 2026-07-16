import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  parsePlanBlock,
  registerTools,
  clearTools,
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

// ---- parsePlanBlock 单元测试 ----
describe('parsePlanBlock', () => {
  it('正常 plan 块返回内容(去掉包裹与首尾空白)', () => {
    const text = '```plan\n1. 步骤一\n2. 步骤二\n```'
    expect(parsePlanBlock(text)).toBe('1. 步骤一\n2. 步骤二')
  })

  it('无 plan 块返回 null', () => {
    expect(parsePlanBlock('hello world')).toBeNull()
    expect(parsePlanBlock('```tool_call\n{"name":"x","arguments":{}}\n```')).toBeNull()
  })

  it('多个 plan 块取第一个', () => {
    const text = '```plan\n第一个\n```\n中间\n```plan\n第二个\n```'
    expect(parsePlanBlock(text)).toBe('第一个')
  })

  it('空 plan 块返回空字符串(非 null)', () => {
    expect(parsePlanBlock('```plan\n```')).toBe('')
  })
})

// ---- runToolLoop Plan Mode 阻断逻辑 ----
describe('runToolLoop Plan Mode 阻断', () => {
  beforeEach(() => {
    toolCallCount = 0
    clearTools()
    registerTools([mockTool])
    streamChatMock.mockReset()
  })

  it('planFirst=true 且无 plan 块 → 工具不执行,追加"请先输出 plan"提示', async () => {
    setStreamResponses([
      '我来执行。\n```tool_call\n{"name":"mock","arguments":{}}\n```',
      '好的,我先规划。',
    ])
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'do task' },
    ]
    await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      planFirst: true,
      planApproved: false,
    })
    expect(toolCallCount).toBe(0)
    expect(
      messages.some((m) => m.role === 'user' && m.content.includes('请先输出')),
    ).toBe(true)
  })

  it('planFirst=true 且有 plan 块 → planApproved 置 true,本迭代跳过工具,下一迭代执行', async () => {
    setStreamResponses([
      '```plan\n1. 步骤\n```\n```tool_call\n{"name":"mock","arguments":{}}\n```',
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const opts = {
      modelId: 'test',
      messages: [
        { role: 'system' as const, content: 'sys' },
        { role: 'user' as const, content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 5,
      planFirst: true,
      planApproved: false,
    }
    await runToolLoop(opts)
    expect(opts.planApproved).toBe(true)
    expect(toolCallCount).toBe(1)
  })

  it('planFirst=true 且 planApproved=true → 工具正常执行', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'do task' },
    ]
    await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      planFirst: true,
      planApproved: true,
    })
    expect(toolCallCount).toBe(1)
  })

  it('planFirst=false → 工具正常执行,不检查 plan 块', async () => {
    setStreamResponses([
      '```tool_call\n{"name":"mock","arguments":{}}\n```',
      '完成。',
    ])
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'do task' },
    ]
    await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      planFirst: false,
    })
    expect(toolCallCount).toBe(1)
  })
})
