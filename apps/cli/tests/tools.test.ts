import { describe, expect, it, beforeEach } from 'vitest'
import {
  registerTools,
  parseToolCalls,
  buildSystemPrompt,
  listTools,
  clearTools,
  executeToolCall,
  formatToolResult,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'

describe('Tool 注册与查询', () => {
  beforeEach(() => {
    clearTools()
  })

  it('registerTools 注册多个工具,listTools 返回', () => {
    const t1: Tool = {
      name: 't1',
      description: 'first',
      parameters: { x: { type: 'string', description: 'x' } },
      required: ['x'],
      execute: async () => ({ success: true, output: 't1-ok' }),
    }
    const t2: Tool = {
      name: 't2',
      description: 'second',
      parameters: { y: { type: 'number', description: 'y' } },
      required: [],
      execute: async () => ({ success: true, output: 't2-ok' }),
    }
    registerTools([t1, t2])
    const list = listTools()
    expect(list).toHaveLength(2)
    expect(list.map((t) => t.name).sort()).toEqual(['t1', 't2'])
  })

  it('clearTools 清空注册器', () => {
    const t: Tool = {
      name: 't',
      description: 'd',
      parameters: {},
      required: [],
      execute: async () => ({ success: true, output: 'ok' }),
    }
    registerTools([t])
    expect(listTools()).toHaveLength(1)
    clearTools()
    expect(listTools()).toHaveLength(0)
  })
})

describe('parseToolCalls', () => {
  it('解析单个 tool_call 块', () => {
    const text = `我先读取文件。
\`\`\`tool_call
{"name":"read_file","arguments":{"path":"src/index.ts"}}
\`\`\`
读取完成。`
    const calls = parseToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      name: 'read_file',
      arguments: { path: 'src/index.ts' },
    })
  })

  it('解析多个 tool_call 块', () => {
    const text = `\`\`\`tool_call
{"name":"a","arguments":{}}
\`\`\`
\`\`\`tool_call
{"name":"b","arguments":{"x":1}}
\`\`\``
    const calls = parseToolCalls(text)
    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.name)).toEqual(['a', 'b'])
  })

  it('忽略 JSON 解析失败的块', () => {
    const text = `\`\`\`tool_call
not-json
\`\`\`
\`\`\`tool_call
{"name":"valid","arguments":{}}
\`\`\``
    const calls = parseToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('valid')
  })

  it('文本无 tool_call 返回空数组', () => {
    expect(parseToolCalls('hello world')).toEqual([])
  })
})

describe('buildSystemPrompt', () => {
  it('包含工具名/描述/参数', () => {
    const tools: Tool[] = [
      {
        name: 'echo',
        description: '回显输入',
        parameters: {
          msg: { type: 'string', description: '消息内容' },
        },
        required: ['msg'],
        execute: async () => ({ success: true, output: '' }),
      },
    ]
    const prompt = buildSystemPrompt(tools)
    expect(prompt).toContain('echo')
    expect(prompt).toContain('回显输入')
    expect(prompt).toContain('msg')
    expect(prompt).toContain('必填')
    expect(prompt).toContain('tool_call')
  })

  it('extraContext 注入"项目上下文"区块', () => {
    const prompt = buildSystemPrompt([], 'PROJECT-X v1.0')
    expect(prompt).toContain('项目上下文')
    expect(prompt).toContain('PROJECT-X v1.0')
  })

  it('planFirst=true 注入"任务规划"块', () => {
    const prompt = buildSystemPrompt([], undefined, true)
    expect(prompt).toContain('任务规划')
    expect(prompt).toContain('plan')
  })
})

describe('executeToolCall', () => {
  beforeEach(() => clearTools())

  it('未知工具返回 success=false', async () => {
    const result = await executeToolCall(
      { name: 'no-such-tool', arguments: {} },
      { workspacePath: '.' },
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('未知工具')
  })

  it('dangerous 工具未提供 confirmDangerous 时拒绝', async () => {
    const dangerous: Tool = {
      name: 'rm',
      description: 'rm',
      parameters: {},
      required: [],
      dangerLevel: 'dangerous',
      execute: async () => ({ success: true, output: 'deleted' }),
    }
    registerTools([dangerous])
    const r = await executeToolCall({ name: 'rm', arguments: {} }, { workspacePath: '.' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('被拒绝')
  })

  it('dangerous 工具 confirmDangerous=true 时执行', async () => {
    const dangerous: Tool = {
      name: 'rm',
      description: 'rm',
      parameters: {},
      required: [],
      dangerLevel: 'dangerous',
      execute: async () => ({ success: true, output: 'deleted' }),
    }
    registerTools([dangerous])
    const ctx: ToolContext = {
      workspacePath: '.',
      confirmDangerous: async () => true,
    }
    const r = await executeToolCall({ name: 'rm', arguments: {} }, ctx)
    expect(r.success).toBe(true)
    expect(r.output).toBe('deleted')
  })

  it('工具抛出异常被捕获', async () => {
    const t: Tool = {
      name: 'fail',
      description: 'fail',
      parameters: {},
      required: [],
      execute: async () => {
        throw new Error('boom')
      },
    }
    registerTools([t])
    const r = await executeToolCall({ name: 'fail', arguments: {} }, { workspacePath: '.' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('boom')
  })
})

describe('formatToolResult', () => {
  it('success 状态显示 ✓', () => {
    const out = formatToolResult(
      { name: 't', arguments: {} },
      { success: true, output: 'ok' },
    )
    expect(out).toContain('✓')
    expect(out).toContain('ok')
  })

  it('failure 状态显示 ✗ + 错误', () => {
    const out = formatToolResult(
      { name: 't', arguments: {} },
      { success: false, output: 'partial', error: 'bad' },
    )
    expect(out).toContain('✗')
    expect(out).toContain('错误: bad')
  })

  it('对 output 应用 redactSecrets', () => {
    const out = formatToolResult(
      { name: 't', arguments: {} },
      { success: true, output: 'token=sk-abcdefghijklmnopqrstuv' },
    )
    expect(out).toContain('***REDACTED***')
    expect(out).not.toContain('qrstuv')
  })
})
