/**
 * 原生 function calling 持久化配置(nativeFunctionCalling)测试。
 *
 * 覆盖 settings.nativeFunctionCalling 三态与 runToolLoop 的解析优先级:
 *   1. settings.nativeFunctionCalling = false → 不携带 extraBody.tools,走 prompt 正则路径
 *   2. 显式传 providerSupportsTools 优先于 settings(显式 true 覆盖 settings false /
 *      显式 false 覆盖 settings true)
 *   3. 默认(未配置)auto 行为不变:携带 tools 下发
 *
 * mock 策略(参考 tests/native-function-calling.test.ts):
 *   - mock @ihui/api-client 的 streamChat(避免真实网络调用)
 *   - mock src/audit.js 的 auditLog(避免写文件)
 *   - mock src/commands/settings.js 的 loadSettings(注入任意 settings,避免读写真实 ~/.ihui/settings.json)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerTools,
  clearTools,
  resetRateLimiter,
  type Tool,
} from '../src/tools/index.js'
import type { Settings } from '../src/commands/settings.js'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
type StreamChatOpts = {
  model: string
  messages: unknown[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (err: string) => void
  onDone?: () => void
  extraBody?: Record<string, unknown>
  onToolCall?: (event: {
    type: 'tool-call-start' | 'tool-result'
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
  }) => void
}
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>

const { streamChatMock, settingsState } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
  settingsState: { value: {} as Record<string, unknown> },
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

// mock loadSettings:注入 settingsState(其余导出保留原实现,避免破坏其他模块)
vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    loadSettings: () => settingsState.value as Settings,
  }
})

import { runToolLoop } from '../src/commands/agent.js'

// ---- 辅助:mock 工具 ----
let lastToolArgs: Record<string, unknown> | undefined
const mockTool: Tool = {
  name: 'mock',
  description: 'mock tool for testing',
  parameters: { x: { type: 'string', description: 'x 参数' } },
  required: ['x'],
  execute: async (args) => {
    lastToolArgs = args
    return { success: true, output: 'mock-ok' }
  },
}

/** 注入 settings(模拟 settings.json 内容) */
function setSettings(s: Settings): void {
  settingsState.value = s
}

describe('runToolLoop + settings.nativeFunctionCalling 持久化配置', () => {
  beforeEach(() => {
    lastToolArgs = undefined
    resetRateLimiter()
    clearTools()
    registerTools([mockTool])
    streamChatMock.mockReset()
    setSettings({})
  })

  it('settings.nativeFunctionCalling = false → 不携带 extraBody.tools,正则 tool_call 正常执行', async () => {
    setSettings({ nativeFunctionCalling: false })
    // 第 1 轮:不携带 tools,prompt 正则路径
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('```tool_call\n{"name":"mock","arguments":{"x":"from-settings-false"}}\n```')
    })
    // 第 2 轮:纯文本 → end_turn
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('完成。')
    })
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      // 不传 providerSupportsTools → 用 settings.nativeFunctionCalling
    })
    expect(result.stopReason).toBe('end_turn')
    expect(lastToolArgs).toEqual({ x: 'from-settings-false' })
  })

  it('显式 providerSupportsTools: true 优先于 settings.nativeFunctionCalling = false → tools 原生下发', async () => {
    setSettings({ nativeFunctionCalling: false })
    // 第 1 轮:显式 true 覆盖 settings false → 携带 tools + 原生 tool-call 事件
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody?.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({ name: 'mock' }),
          }),
        ]),
      )
      opts.onDelta('好的,我来调用工具。')
      opts.onToolCall?.({
        type: 'tool-call-start',
        toolCallId: 'call_1',
        toolName: 'mock',
        args: { x: 'explicit-true' },
      })
    })
    // 第 2 轮:纯文本 → end_turn
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta('完成。')
    })
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      providerSupportsTools: true,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(lastToolArgs).toEqual({ x: 'explicit-true' })
  })

  it('显式 providerSupportsTools: false 优先于 settings.nativeFunctionCalling = true → 不携带 tools', async () => {
    setSettings({ nativeFunctionCalling: true })
    // 第 1 轮:显式 false 覆盖 settings true → 不携带 tools,正则路径
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('```tool_call\n{"name":"mock","arguments":{"x":"explicit-false"}}\n```')
    })
    // 第 2 轮:纯文本 → end_turn
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('完成。')
    })
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      providerSupportsTools: false,
    })
    expect(result.stopReason).toBe('end_turn')
    expect(lastToolArgs).toEqual({ x: 'explicit-false' })
  })

  it('settings.nativeFunctionCalling 未配置(默认 auto)→ 行为不变:携带 tools 下发', async () => {
    setSettings({})
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody?.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({ name: 'mock' }),
          }),
        ]),
      )
      opts.onDelta('普通回复,无需工具。')
    })
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
    expect(lastToolArgs).toBeUndefined()
  })

  it("settings.nativeFunctionCalling = 'auto' 显式配置 → 与默认等价:携带 tools,探测降级可用", async () => {
    setSettings({ nativeFunctionCalling: 'auto' })
    // 第 1 次调用:携带 tools 被 provider 拒绝
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody?.tools).toBeDefined()
      throw new Error("400: 'tools' is not supported by this model")
    })
    // 降级重试(不携带 tools):返回正则 tool_call 块 → 工具执行
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('```tool_call\n{"name":"mock","arguments":{"x":"auto-fallback"}}\n```')
    })
    // 下一轮:纯文本 → end_turn
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('完成。')
    })
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
    expect(lastToolArgs).toEqual({ x: 'auto-fallback' })
    expect(streamChatMock).toHaveBeenCalledTimes(3)
  })
})
