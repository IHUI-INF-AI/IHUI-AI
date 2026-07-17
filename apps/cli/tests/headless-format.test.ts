import { describe, expect, it } from 'vitest'
import {
  toYaml,
  eventToMarkdown,
  parseOutputFormat,
  formatHeadlessEvent,
  type OutputFormat,
  type HeadlessEvent,
} from '../src/headless-format.js'

describe('P1-5 parseOutputFormat', () => {
  it('合法格式直接返回', () => {
    expect(parseOutputFormat('text')).toBe('text')
    expect(parseOutputFormat('json')).toBe('json')
    expect(parseOutputFormat('markdown')).toBe('markdown')
    expect(parseOutputFormat('yaml')).toBe('yaml')
  })

  it('非法值默认 text', () => {
    expect(parseOutputFormat('xml')).toBe('text')
    expect(parseOutputFormat('')).toBe('text')
    expect(parseOutputFormat(undefined)).toBe('text')
    expect(parseOutputFormat(null)).toBe('text')
    expect(parseOutputFormat(123)).toBe('text')
  })
})

describe('P1-5 toYaml 序列化', () => {
  it('null / undefined → null', () => {
    expect(toYaml(null)).toBe('null')
    expect(toYaml(undefined)).toBe('null')
  })

  it('boolean → true / false', () => {
    expect(toYaml(true)).toBe('true')
    expect(toYaml(false)).toBe('false')
  })

  it('number 原样输出,NaN/Infinity → null', () => {
    expect(toYaml(42)).toBe('42')
    expect(toYaml(3.14)).toBe('3.14')
    expect(toYaml(0)).toBe('0')
    expect(toYaml(-1)).toBe('-1')
    expect(toYaml(NaN)).toBe('null')
    expect(toYaml(Infinity)).toBe('null')
  })

  it('简单字符串直接输出', () => {
    expect(toYaml('hello')).toBe('hello')
    expect(toYaml('hello world')).toBe('hello world')
    expect(toYaml('foo-bar_baz')).toBe('foo-bar_baz')
  })

  it('空字符串 → ""', () => {
    expect(toYaml('')).toBe('""')
  })

  it('特殊字符字符串用 JSON 双引号', () => {
    expect(toYaml('hello: world')).toBe('"hello: world"')
    expect(toYaml('line\nbreak')).toBe('"line\\nbreak"')
    expect(toYaml('quote " inside')).toBe('"quote \\" inside"')
  })

  it('yaml 保留字(true/false/null/数字开头)用双引号', () => {
    expect(toYaml('true')).toBe('"true"')
    expect(toYaml('false')).toBe('"false"')
    expect(toYaml('null')).toBe('"null"')
    expect(toYaml('123abc')).toBe('"123abc"')
  })

  it('空数组 → []', () => {
    expect(toYaml([])).toBe('[]')
  })

  it('空对象 → {}', () => {
    expect(toYaml({})).toBe('{}')
  })

  it('标量数组', () => {
    const result = toYaml(['a', 'b', 'c'])
    expect(result).toContain('- a')
    expect(result).toContain('- b')
    expect(result).toContain('- c')
  })

  it('对象数组', () => {
    const result = toYaml([{ name: 'a' }, { name: 'b' }])
    expect(result).toContain('- name: a')
    expect(result).toContain('- name: b')
  })

  it('嵌套对象', () => {
    const result = toYaml({ outer: { inner: 'value', num: 42 } })
    expect(result).toContain('outer:')
    expect(result).toContain('inner: value')
    expect(result).toContain('num: 42')
  })

  it('复杂对象(模拟 HeadlessEvent)', () => {
    const event = {
      type: 'start',
      prompt: '修复 bug',
      model: 'gpt-4o',
      workspace: '/tmp/project',
    }
    const result = toYaml(event)
    expect(result).toContain('type: start')
    expect(result).toContain('prompt: 修复 bug')
    expect(result).toContain('model: gpt-4o')
    expect(result).toContain('workspace: /tmp/project')
  })

  it('null 值字段', () => {
    const result = toYaml({ a: null, b: 'ok' })
    expect(result).toContain('a: null')
    expect(result).toContain('b: ok')
  })
})

describe('P1-5 eventToMarkdown', () => {
  it('start 事件生成 markdown 标题块', () => {
    const event: HeadlessEvent = {
      type: 'start',
      prompt: '修复 bug',
      model: 'gpt-4o',
      workspace: '/tmp',
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('## 🤖 Agent 启动')
    expect(md).toContain('**模型**: gpt-4o')
    expect(md).toContain('**工作区**: /tmp')
    expect(md).toContain('**任务**: 修复 bug')
  })

  it('message_delta 事件原样输出文本', () => {
    const event: HeadlessEvent = { type: 'message_delta', text: 'hello world' }
    expect(eventToMarkdown(event)).toBe('hello world')
  })

  it('tool_call 事件生成 ### 标题 + json 代码块', () => {
    const event: HeadlessEvent = {
      type: 'tool_call',
      name: 'read_file',
      arguments: { path: 'src/index.ts' },
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('### 🔧 工具调用: `read_file`')
    expect(md).toContain('```json')
    expect(md).toContain('"path": "src/index.ts"')
  })

  it('tool_result 成功事件含 ✓ 与 成功', () => {
    const event: HeadlessEvent = {
      type: 'tool_result',
      name: 'read_file',
      success: true,
      output: 'file content',
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('✓')
    expect(md).toContain('成功')
    expect(md).toContain('file content')
  })

  it('tool_result 失败事件含 ✗ 与 失败', () => {
    const event: HeadlessEvent = {
      type: 'tool_result',
      name: 'write_file',
      success: false,
      output: 'permission denied',
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('✗')
    expect(md).toContain('失败')
    expect(md).toContain('permission denied')
  })

  it('tool_result 长输出被截断到 1000 字符', () => {
    const longOutput = 'x'.repeat(1500)
    const event: HeadlessEvent = {
      type: 'tool_result',
      name: 'big_tool',
      success: true,
      output: longOutput,
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('...(truncated)')
    expect(md.length).toBeLessThan(longOutput.length + 200)
  })

  it('iteration 事件输出 html 注释', () => {
    const event: HeadlessEvent = { type: 'iteration', count: 3, max: 10 }
    const md = eventToMarkdown(event)
    expect(md).toContain('<!-- iteration 3/10 -->')
  })

  it('error 事件生成 blockquote', () => {
    const event: HeadlessEvent = { type: 'error', message: 'something failed' }
    const md = eventToMarkdown(event)
    expect(md).toContain('> ❌')
    expect(md).toContain('something failed')
  })

  it('complete 事件生成总结块 + --- 分隔', () => {
    const event: HeadlessEvent = {
      type: 'complete',
      stopReason: 'end_turn',
      iterations: 5,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCostUsd: 0.001 },
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('## ✨ 完成')
    expect(md).toContain('end_turn')
    expect(md).toContain('5')
    expect(md).toContain('150')
    expect(md).toContain('$0.0010')
  })

  it('complete 事件零成本显示 plan 套餐', () => {
    const event: HeadlessEvent = {
      type: 'complete',
      stopReason: 'end_turn',
      iterations: 1,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    }
    const md = eventToMarkdown(event)
    expect(md).toContain('plan 套餐')
  })
})

describe('P1-5 formatHeadlessEvent 统一格式化', () => {
  const sampleEvent: HeadlessEvent = {
    type: 'start',
    prompt: 'task',
    model: 'm',
    workspace: '/w',
  }

  it('text 格式返回空字符串(由 chalk/ora 路径处理)', () => {
    expect(formatHeadlessEvent(sampleEvent, 'text')).toBe('')
  })

  it('json 格式返回 NDJSON 单行(末尾换行)', () => {
    const out = formatHeadlessEvent(sampleEvent, 'json')
    expect(out.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(out)
    expect(parsed.type).toBe('start')
    expect(parsed.prompt).toBe('task')
  })

  it('markdown 格式返回 eventToMarkdown 输出', () => {
    const out = formatHeadlessEvent(sampleEvent, 'markdown')
    expect(out).toContain('## 🤖 Agent 启动')
  })

  it('yaml 格式以 --- 开头(文档分隔符)', () => {
    const out = formatHeadlessEvent(sampleEvent, 'yaml')
    expect(out.startsWith('---\n')).toBe(true)
    expect(out).toContain('type: start')
    expect(out).toContain('prompt: task')
  })

  it('4 种格式都为字符串(text 非空时与其他一致)', () => {
    const formats: OutputFormat[] = ['text', 'json', 'markdown', 'yaml']
    for (const f of formats) {
      const out = formatHeadlessEvent(sampleEvent, f)
      expect(typeof out).toBe('string')
    }
  })
})
