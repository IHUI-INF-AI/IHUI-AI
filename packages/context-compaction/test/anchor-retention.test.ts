// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 保留锚点(任务锚 + pinned)测试 — 与 ai-service context_compaction.py 的 ANCHOR_* 段对齐。
 *
 * 断言要点:
 *   1) 任务锚(head 首个 user 组)原文保留在 system 之后、摘要之前,不折进摘要;
 *   2) pinned 组(含 assistant(tool_calls)+tool 结果)整组保留,配对不被拆散;
 *   3) 超长任务锚(> ANCHOR_MAX_TASK_TOKENS)不保留,交给摘要;
 *   4) 历史摘要消息不会被当作锚点原文保留(防摘要套摘要);
 *   5) 待压缩区全是锚点时不做"空摘要"压缩,返回原消息。
 */
import { describe, expect, it } from 'vitest'

import {
  ANCHOR_MAX_TASK_TOKENS,
  SUMMARY_MARKER,
  compressContext,
  compressContextIfNeeded,
  type ChatMessage,
} from '../src/index.js'

function user(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { role: 'user', content, ...extra }
}

function assistantToolCall(id: string): ChatMessage {
  return {
    role: 'assistant',
    content: '',
    tool_calls: [{ id, type: 'function', function: { name: 'read_file', arguments: '{}' } }],
  }
}

function toolResult(id: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { role: 'tool', content, tool_call_id: id, ...extra }
}

describe('保留锚点:任务锚', () => {
  it('压缩后首条任务陈述原文保留在 summary 之前', () => {
    const firstTask = '把 src/ 重构为 ESM 并保持所有导出兼容,这是本会话的硬约束。'
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      user(firstTask),
      ...Array.from({ length: 12 }, (_, i) => user(`历史消息 ${i} ` + 'x'.repeat(2000))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })

    expect(result.compressed).toBe(true)
    expect(result.anchoredCount).toBe(1)
    // system → 任务锚 → 摘要 → 尾部保留
    expect(result.messages[0]).toEqual(messages[0])
    expect(result.messages[1]!.content).toBe(firstTask)
    expect(result.messages[2]!.content.startsWith(SUMMARY_MARKER)).toBe(true)
    // 任务锚不再计入"被摘要条数"
    expect(result.removedCount).toBe(
      messages.filter((m) => m.role !== 'system').length - 1 - (result.messages.length - 3),
    )
  })

  it('无 system 消息时任务锚排在首位、摘要紧随其后', () => {
    const messages: ChatMessage[] = [
      user('第一条任务'),
      ...Array.from({ length: 12 }, (_, i) => user(`历史消息 ${i} ` + 'x'.repeat(2000))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })
    expect(result.messages[0]!.content).toBe('第一条任务')
    expect(result.messages[1]!.content.startsWith(SUMMARY_MARKER)).toBe(true)
  })

  it('超长任务锚不保留(交给摘要,避免锚点吃掉压缩收益)', () => {
    const messages: ChatMessage[] = [
      user('x'.repeat(ANCHOR_MAX_TASK_TOKENS * 5)),
      ...Array.from({ length: 12 }, (_, i) => user(`历史消息 ${i} ` + 'x'.repeat(2000))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })
    expect(result.anchoredCount).toBe(0)
    expect(result.messages[0]!.content.startsWith(SUMMARY_MARKER)).toBe(true)
  })

  it('历史摘要不会被当成锚点原文保留', () => {
    const messages: ChatMessage[] = [
      user(`${SUMMARY_MARKER} — 之前 8 条消息已压缩]\n旧摘要正文`),
      ...Array.from({ length: 12 }, (_, i) => user(`历史消息 ${i} ` + 'x'.repeat(2000))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })
    expect(result.anchoredCount).toBe(0)
    expect(result.messages[0]!.content.startsWith(SUMMARY_MARKER)).toBe(true)
  })
})

describe('保留锚点:pinned 组', () => {
  it('pinned 组(assistant tool_calls + tool 结果)整组原文保留且配对完整', () => {
    const messages: ChatMessage[] = [
      user('任务 ' + 'x'.repeat(2000)),
      ...Array.from({ length: 8 }, (_, i) => user(`历史 ${i} ` + 'x'.repeat(2000))),
      assistantToolCall('call_pin'),
      toolResult('call_pin', '关键工具输出,不能丢', { pinned: true }),
      ...Array.from({ length: 6 }, (_, i) => user(`尾部 ${i} ` + 't'.repeat(100))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })

    expect(result.anchoredCount).toBe(2)
    const anchorStart = result.messages.findIndex((m) => m.tool_call_id === 'call_pin')
    expect(anchorStart).toBeGreaterThan(0)
    // 配对组两条相邻且在摘要之前
    expect(result.messages[anchorStart - 1]!.tool_calls?.[0]?.id).toBe('call_pin')
    const summaryIdx = result.messages.findIndex((m) => m.content.startsWith(SUMMARY_MARKER))
    expect(anchorStart).toBeLessThan(summaryIdx)
  })

  it('metadata.pinned 与顶层 pinned 等价', () => {
    const messages: ChatMessage[] = [
      user('任务 ' + 'x'.repeat(2000)),
      ...Array.from({ length: 8 }, (_, i) => user(`历史 ${i} ` + 'x'.repeat(2000))),
      user('元数据钉住的消息', { metadata: { pinned: true } }),
      ...Array.from({ length: 6 }, (_, i) => user(`尾部 ${i} ` + 't'.repeat(100))),
    ]
    const result = compressContextIfNeeded(messages, { contextLimit: 2000 })
    expect(result.anchoredCount).toBe(1)
    expect(result.messages.some((m) => m.content === '元数据钉住的消息')).toBe(true)
  })

  it('绝对阈值压缩同样保留锚点', () => {
    const firstTask = '绝对阈值入口的任务锚'
    const messages: ChatMessage[] = [
      user(firstTask),
      ...Array.from({ length: 12 }, (_, i) => user(`历史 ${i} ` + 'x'.repeat(2000))),
    ]
    const result = compressContext(messages, { maxTokens: 1000, keepRecent: 6 })
    expect(result.compressed).toBe(true)
    expect(result.anchoredCount).toBe(1)
    expect(result.messages[0]!.content).toBe(firstTask)
    expect(result.messages[1]!.content.startsWith(SUMMARY_MARKER)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
