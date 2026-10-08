// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 原生 function calling 支持测试。
 *
 * 覆盖:
 *   1. toolsToProviderSchema:Tool[] → OpenAI 兼容 tools schema 数组(name/description/parameters/required,
 *      含 enum / 嵌套 object / array items 递归转换)
 *   2. parseNativeToolCalls:按 content 结构解析原生 tool_calls(OpenAI 消息 / 裸 tool_calls 容器 /
 *      Anthropic content block 数组 / 非法条目安全跳过)
 *   3. extractToolCalls:原生优先,解析不到降级走 parseToolCalls 正则
 *   4. runToolLoop 集成:原生 tool_calls 响应(mock SSE tool-call 事件)→ 工具执行;
 *      纯文本响应(无工具调用)→ end_turn;provider 不支持 tools → 探测降级重试
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  registerTools,
  clearTools,
  resetRateLimiter,
  toolsToProviderSchema,
  parseNativeToolCalls,
  extractToolCalls,
  type Tool,
} from '../src/tools/index.js'

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

describe('toolsToProviderSchema', () => {
  it('把 Tool[] 转为 OpenAI 兼容 tools schema 数组(name/description/parameters/required)', () => {
    const tool: Tool = {
      name: 'read_file',
      description: '读取文件内容',
      parameters: {
        path: { type: 'string', description: '文件路径' },
        encoding: {
          type: 'string',
          description: '编码',
          enum: ['utf-8', 'gbk'],
        },
      },
      required: ['path'],
      execute: async () => ({ success: true, output: '' }),
    }
    const schema = toolsToProviderSchema([tool])
    expect(schema).toHaveLength(1)
    expect(schema[0]!.type).toBe('function')
    expect(schema[0]!.function.name).toBe('read_file')
    expect(schema[0]!.function.description).toBe('读取文件内容')
    expect(schema[0]!.function.parameters.type).toBe('object')
    expect(schema[0]!.function.parameters.required).toEqual(['path'])
    expect(schema[0]!.function.parameters.properties.path).toEqual({
      type: 'string',
      description: '文件路径',
    })
    expect(schema[0]!.function.parameters.properties.encoding).toEqual({
      type: 'string',
      description: '编码',
      enum: ['utf-8', 'gbk'],
    })
  })

  it('嵌套 object 与 array items 递归转换(含子级 required)', () => {
    const tool: Tool = {
      name: 'edit_file',
      description: '编辑文件',
      parameters: {
        edits: {
          type: 'array',
          description: '编辑列表',
          items: { type: 'string', description: '单个编辑' },
        },
        options: {
          type: 'object',
          description: '选项',
          properties: {
            backup: { type: 'boolean', description: '是否备份' },
          },
          required: ['backup'],
        },
      },
      required: ['edits'],
      execute: async () => ({ success: true, output: '' }),
    }
    const schema = toolsToProviderSchema([tool])
    const props = schema[0]!.function.parameters.properties
    expect(props.edits).toEqual({
      type: 'array',
      description: '编辑列表',
      items: { type: 'string', description: '单个编辑' },
    })
    expect(props.options).toEqual({
      type: 'object',
      description: '选项',
      properties: { backup: { type: 'boolean', description: '是否备份' } },
      required: ['backup'],
    })
  })

  it('空工具数组返回空数组;输出为深拷贝(不共享 enum/required 引用)', () => {
    expect(toolsToProviderSchema([])).toEqual([])
    const tool: Tool = {
      name: 't',
      description: 'd',
      parameters: { mode: { type: 'string', description: 'm', enum: ['a', 'b'] } },
      required: ['mode'],
      execute: async () => ({ success: true, output: '' }),
    }
    const schema = toolsToProviderSchema([tool])
    const modeProp = schema[0]!.function.parameters.properties.mode as { enum: string[] }
    modeProp.enum.push('c')
    expect(tool.parameters.mode.enum).toEqual(['a', 'b'])
  })
})

describe('parseNativeToolCalls', () => {
  it('解析 OpenAI 消息形态 tool_calls(arguments 为 JSON 字符串)', () => {
    const content = {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"src/index.ts"}' },
        },
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'list_dir', arguments: '{"path":"."}' },
        },
      ],
    }
    expect(parseNativeToolCalls(content)).toEqual([
      { name: 'read_file', arguments: { path: 'src/index.ts' } },
      { name: 'list_dir', arguments: { path: '.' } },
    ])
  })

  it('解析 arguments 为对象的 tool_calls 与裸 tool_calls 数组容器', () => {
    expect(
      parseNativeToolCalls({
        tool_calls: [{ function: { name: 'mock', arguments: { x: '1' } } }],
      }),
    ).toEqual([{ name: 'mock', arguments: { x: '1' } }])
  })

  it('解析 Anthropic 风格 content block 数组(type: tool_use + input 字段)', () => {
    const content = [
      { type: 'text', text: '我先读取文件。' },
      { type: 'tool_use', name: 'read_file', input: { path: 'a.ts' } },
    ]
    expect(parseNativeToolCalls(content)).toEqual([
      { name: 'read_file', arguments: { path: 'a.ts' } },
    ])
  })

  it('非法条目安全跳过(缺 name / arguments 非法 JSON),纯文本消息返回空数组', () => {
    expect(
      parseNativeToolCalls({
        role: 'assistant',
        content: '普通回复',
        tool_calls: [
          { id: 'x', type: 'function', function: { arguments: '{}' } }, // 缺 name
          { function: { name: 't', arguments: '{bad json' } }, // arguments 解析失败 → {}
        ],
      }),
    ).toEqual([{ name: 't', arguments: {} }])
    expect(parseNativeToolCalls({ role: 'assistant', content: '纯文本' })).toEqual([])
    expect(parseNativeToolCalls('纯文本字符串')).toEqual([])
    expect(parseNativeToolCalls(null)).toEqual([])
  })
})

describe('extractToolCalls', () => {
  it('原生 tool_calls 优先(content 结构解析命中时不再走正则)', () => {
    const text = '```tool_call\n{"name":"regex_tool","arguments":{}}\n```'
    const content = { tool_calls: [{ function: { name: 'native_tool', arguments: '{"a":1}' } }] }
    expect(extractToolCalls(content, text)).toEqual([
      { name: 'native_tool', arguments: { a: 1 } },
    ])
  })

  it('原生解析不到时降级走 parseToolCalls 正则(无 function calling 模型路径)', () => {
    const text = '```tool_call\n{"name":"regex_tool","arguments":{"k":"v"}}\n```'
    expect(extractToolCalls(null, text)).toEqual([
      { name: 'regex_tool', arguments: { k: 'v' } },
    ])
    expect(extractToolCalls({ role: 'assistant', content: '普通回复' }, '普通回复')).toEqual([])
  })
})

describe('runToolLoop + 原生 function calling 集成', () => {
  beforeEach(() => {
    lastToolArgs = undefined
    resetRateLimiter()
    clearTools()
    registerTools([mockTool])
    streamChatMock.mockReset()
  })

  it('providerSupportsTools: true + 原生 tool_calls 响应 → tools 原生下发,工具按原生参数执行', async () => {
    // 第 1 轮:mock LLM 返回原生 tool-call 事件 + 文本 delta
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      // 验证请求路径携带了原生 tools schema(OpenAI 兼容)
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
        args: { x: 'hello' },
      })
    })
    // 第 2 轮:纯文本 → end_turn
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta('完成。')
    })
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'do task' },
    ]
    const result = await runToolLoop({
      modelId: 'test',
      messages,
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      providerSupportsTools: true,
    })
    expect(result.stopReason).toBe('end_turn')
    // 原生 tool_calls 被解析并执行(参数来自 SSE tool-call 事件)
    expect(lastToolArgs).toEqual({ x: 'hello' })
    // 工具结果以 user 消息回传(prompt 模式协议不变)
    expect(messages.some((m) => m.role === 'user' && m.content.includes('mock-ok'))).toBe(true)
  })

  it('纯文本响应(无原生 tool_calls、无正则块)→ 不执行工具,end_turn', async () => {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta('这是一个普通回复,无需工具。')
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
    expect(lastToolArgs).toBeUndefined()
    expect(result.assistantText).toContain('普通回复')
  })

  it("provider 不支持 tools(auto 探测)→ 降级为 prompt 模式重试,正则 tool_call 正常执行", async () => {
    // 第 1 次调用:携带 tools 被 provider 拒绝
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody?.tools).toBeDefined()
      throw new Error("400: 'tools' is not supported by this model")
    })
    // 降级重试(不携带 tools):返回正则 tool_call 块 → 工具执行
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('```tool_call\n{"name":"mock","arguments":{"x":"fallback"}}\n```')
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
      // 默认 'auto':探测降级
    })
    expect(result.stopReason).toBe('end_turn')
    expect(lastToolArgs).toEqual({ x: 'fallback' })
    // 共 3 次 LLM 调用:1 次探测失败 + 1 次降级重试 + 1 次 end_turn
    expect(streamChatMock).toHaveBeenCalledTimes(3)
  })

  it('providerSupportsTools: false → 完全走原 prompt 路径(不携带 tools,正则解析)', async () => {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      expect(opts.extraBody).toBeUndefined()
      opts.onDelta('```tool_call\n{"name":"mock","arguments":{"x":"legacy"}}\n```')
    })
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
    expect(lastToolArgs).toEqual({ x: 'legacy' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
