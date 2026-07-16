import { describe, expect, it } from 'vitest'
import {
  summarizeMessage,
  buildStructuredSummary,
  compressContext,
  compressContextIfNeeded,
  type ChatMessage,
} from '../src/context.js'

describe('summarizeMessage 结构化摘要', () => {
  it('空内容返回 (空) 标记', () => {
    expect(summarizeMessage({ role: 'assistant', content: '' })).toBe('[assistant] (空)')
  })

  it('assistant 消息提取 tool_call 名称', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: '我来读取文件。\n```tool_call\n{"name":"read_file","arguments":{"path":"src/index.ts"}}\n```\n继续处理。',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('[assistant]')
    expect(summary).toContain('工具调用: read_file')
  })

  it('assistant 消息提取多个 tool_call 名称', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: '```tool_call\n{"name":"read_file","arguments":{}}\n```\n```tool_call\n{"name":"grep","arguments":{}}\n```',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('工具调用: read_file, grep')
  })

  it('assistant 消息提取代码块语言标识', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: '这是代码:\n```typescript\nconst x = 1;\n```\n```python\nprint(1)\n```',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('代码块: typescript, python')
  })

  it('user 消息提取 tool_result 状态', () => {
    const msg: ChatMessage = {
      role: 'user',
      content: '[工具结果 ✓] read_file\n文件内容...\n[工具结果 ✗] grep\n未找到',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('[user]')
    expect(summary).toContain('工具结果: read_file, grep')
  })

  it('提取首句(去掉 markdown 标记)', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: '**首先**我需要分析这个文件。然后做其他事。',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('首先')
    expect(summary).toContain('分析')
  })

  it('代码块内容不出现在首句中', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: '开始。\n```typescript\nconst secret = "should_not_appear";\n```\n结束。',
    }
    const summary = summarizeMessage(msg)
    expect(summary).not.toContain('should_not_appear')
    expect(summary).toContain('开始')
  })

  it('超长摘要截断到 MAX_SUMMARY_LEN', () => {
    // 用超长 tool name 让 parts 总长超过 160,触发截断
    const longName = 'A'.repeat(300)
    const msg: ChatMessage = {
      role: 'assistant',
      content: `\`\`\`tool_call\n{"name":"${longName}","arguments":{}}\n\`\`\``,
    }
    const summary = summarizeMessage(msg)
    expect(summary.length).toBeLessThanOrEqual(160)
    expect(summary).toContain('...')
  })

  it('system 消息只提取首句', () => {
    const msg: ChatMessage = {
      role: 'system',
      content: '你是一个编码助手。不要编造内容。',
    }
    const summary = summarizeMessage(msg)
    expect(summary).toContain('[system]')
    expect(summary).toContain('编码助手')
    expect(summary).not.toContain('工具调用')
    expect(summary).not.toContain('代码块')
  })
})

describe('buildStructuredSummary 批量摘要', () => {
  it('多条消息拼接', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', content: '读取文件' },
      { role: 'assistant', content: '```tool_call\n{"name":"read_file","arguments":{}}\n```' },
      { role: 'user', content: '[工具结果 ✓] read_file\n内容' },
    ]
    const summary = buildStructuredSummary(msgs)
    expect(summary).toContain('[user]')
    expect(summary).toContain('[assistant]')
    expect(summary).toContain('工具调用: read_file')
    expect(summary).toContain('工具结果: read_file')
    // 多条消息用换行分隔
    expect(summary.split('\n').length).toBe(3)
  })

  it('空数组返回空字符串', () => {
    expect(buildStructuredSummary([])).toBe('')
  })
})

describe('compressContext 集成结构化摘要', () => {
  it('压缩后摘要包含 tool_call 名称(而非粗暴 slice)', () => {
    // 构造 10 条消息,触发压缩
    const msgs: ChatMessage[] = [{ role: 'system', content: 'sys' }]
    for (let i = 0; i < 10; i++) {
      msgs.push({
        role: i % 2 === 0 ? 'assistant' : 'user',
        content: `迭代 ${i}。\n\`\`\`tool_call\n{"name":"tool_${i}","arguments":{}}\n\`\`\``,
      })
    }
    const result = compressContext(msgs, { maxTokens: 100, keepRecent: 3 })
    expect(result.compressed).toBe(true)
    const summaryMsg = result.messages.find(
      (m) => m.role === 'user' && m.content.includes('上下文摘要'),
    )
    expect(summaryMsg).toBeDefined()
    // 摘要中应包含 tool_N 名称(结构化提取),而非粗暴截断
    expect(summaryMsg!.content).toContain('工具调用: tool_')
  })

  it('compressContextIfNeeded 同样使用结构化摘要', () => {
    const msgs: ChatMessage[] = [{ role: 'system', content: 'sys' }]
    for (let i = 0; i < 20; i++) {
      msgs.push({
        role: 'user',
        content: `[工具结果 ✓] tool_${i}\n${'x'.repeat(200)}`,
      })
    }
    const result = compressContextIfNeeded(msgs, { contextLimit: 800, triggerRatio: 0.5, targetRatio: 0.3 })
    expect(result.compressed).toBe(true)
    const summaryMsg = result.messages.find(
      (m) => m.role === 'user' && m.content.includes('上下文摘要'),
    )
    expect(summaryMsg).toBeDefined()
    // 应包含工具结果状态提取
    expect(summaryMsg!.content).toContain('工具结果: tool_')
  })
})
