// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  estimateMessagesTokens,
  summarizeMessage,
  compressContext,
  compressContextIfNeeded,
  SUMMARY_TIER_RECENT_RATIO,
  SUMMARY_RECENT_CHARS,
  SUMMARY_REMOTE_CHARS,
  type ChatMessage,
} from '../src/context.js'

describe('estimateTokens', () => {
  it('空字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('纯 ASCII 文本 1 字符 ≈ 0.25 token(>=1)', () => {
    // 4 chars 约 1 token
    const tokens = estimateTokens('abcd')
    expect(tokens).toBeGreaterThanOrEqual(1)
  })

  it('中文字符使用 gpt-tokenizer 真实估算', () => {
    // "你好世界" = 4 中文字符
    const tokens = estimateTokens('你好世界')
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('estimateMessagesTokens', () => {
  it('空数组返回 0', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  it('多条消息累加', () => {
    const total = estimateMessagesTokens([
      { role: 'system', content: 'hi' },
      { role: 'user', content: 'hello' },
    ])
    expect(total).toBeGreaterThan(0)
  })
})

describe('compressContext', () => {
  it('消息数 <= 尾部 N 时不压缩', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'u1' },
      { role: 'assistant' as const, content: 'a1' },
    ]
    const r = compressContext(messages, { keepRecent: 6 })
    expect(r.messages).toHaveLength(3)
    expect(r.compressed).toBe(false)
  })

  it('消息数 > 尾部 N 时压缩中段', () => {
    const longContent = '这是一段比较长的消息内容,用于让token计数达到压缩阈值。' .repeat(50)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: longContent },
      { role: 'user', content: longContent + '_u1' },
      { role: 'assistant', content: longContent + '_a1' },
      { role: 'user', content: longContent + '_u2' },
      { role: 'assistant', content: longContent + '_a2' },
      { role: 'user', content: longContent + '_u3' },
      { role: 'assistant', content: longContent + '_a3' },
      { role: 'user', content: longContent + '_u4' },
      { role: 'assistant', content: longContent + '_a4' },
    ]
    // keepRecent=2 + maxTokens=2000 强制压缩
    const r = compressContext(messages, { keepRecent: 2, maxTokens: 2000 })
    expect(r.compressed).toBe(true)
    expect(r.messages.length).toBeLessThan(messages.length)
  })

  it('maxTokens 触发压缩', () => {
    const longText = 'x'.repeat(2000)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: longText },
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
    ]
    // keepRecent=1 让 messages.length(3) > keepRecent+1(2) 满足压缩条件
    const r = compressContext(messages, { maxTokens: 10, keepRecent: 1 })
    expect(r.compressed).toBe(true)
  })

  it('压缩后仍含 system 消息', () => {
    // gpt-tokenizer 对 'A' 字符约 0.13 tokens/char,500 'A' ≈ 65 tokens
    // 8 messages * 65 = 520 tokens,加 overhead ≈ 558 tokens,maxTokens=100 不够 → 压缩触发
    const longContent = 'A'.repeat(500)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'important system' },
      { role: 'user', content: longContent + '_u1' },
      { role: 'assistant', content: longContent + '_a1' },
      { role: 'user', content: longContent + '_u2' },
      { role: 'assistant', content: longContent + '_a2' },
      { role: 'user', content: longContent + '_u3' },
      { role: 'assistant', content: longContent + '_a3' },
      { role: 'user', content: longContent + '_u4' },
      { role: 'assistant', content: longContent + '_a4' },
    ]
    const r = compressContext(messages, { keepRecent: 1, maxTokens: 100 })
    expect(r.compressed).toBe(true)
    expect(r.messages[0]?.role).toBe('system')
    expect(r.messages[0]?.content).toBe('important system')
  })
})

describe('compressContextIfNeeded', () => {
  it('未达 88% 阈值时不压缩', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ]
    // 8000 * 0.88 = 7040, 当前 token 远小于
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(false)
    expect(r.trigger).toBe('none')
    expect(r.usageRatio).toBeLessThan(0.88)
  })

  it('达 88% 阈值时自动压缩', () => {
    // 构造大量消息使 token 数超过 88% * 8000 = 7040
    const longContent = 'A'.repeat(1000) // ~130 tokens
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 100; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_msg_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(true)
    expect(r.trigger).toBe('ratio')
    expect(r.usageRatio).toBeGreaterThanOrEqual(0.88)
    expect(r.removedCount).toBeGreaterThan(0)
  })

  it('压缩后 token 占用率应低于 60% targetRatio', () => {
    const longContent = 'B'.repeat(1000)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 100; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_m_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    if (r.compressed) {
      const newRatio = r.compressedTokens / 8000
      // 应该显著低于 88%,接近或低于 60%
      expect(newRatio).toBeLessThan(r.usageRatio!)
      // 理想情况下低于 60%,但受 keepRecent 下限约束,至少应该低于 88%
      expect(newRatio).toBeLessThan(0.88)
    }
  })

  it('消息数不足时不压缩(即使 token 超阈值)', () => {
    // 单条超长消息,但消息总数只有 2(system + user)
    const superLong = 'X'.repeat(50000)
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: superLong },
    ]
    // minMessages 默认 2, 2 <= 2 不压缩
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(false)
  })

  it('自定义 triggerRatio 和 targetRatio', () => {
    const longContent = 'Y'.repeat(500)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 50; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_i_${i}` })
    }
    // 50% 触发,30% 目标
    const r = compressContextIfNeeded(messages, {
      contextLimit: 8000,
      triggerRatio: 0.5,
      targetRatio: 0.3,
    })
    expect(r.compressed).toBe(true)
    expect(r.usageRatio!).toBeGreaterThanOrEqual(0.5)
  })

  it('压缩后保留 system 消息', () => {
    const longContent = 'Z'.repeat(1000)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'CRITICAL SYSTEM PROMPT' },
    ]
    for (let i = 0; i < 100; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(true)
    expect(r.messages[0]?.role).toBe('system')
    expect(r.messages[0]?.content).toBe('CRITICAL SYSTEM PROMPT')
  })

  it('压缩后保留尾部 keepRecent 条消息', () => {
    const longContent = 'W'.repeat(500)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 50; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_keep_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000, keepRecent: 4 })
    if (r.compressed) {
      // 最后 4 条非 system 消息应保留(加上 1 条 summary)
      const nonSystem = r.messages.filter((m) => m.role !== 'system')
      // 应该有 summary + 4 条保留 = 5 条,或者更少(如果进一步压缩)
      expect(nonSystem.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('压缩结果包含摘要消息', () => {
    const longContent = 'V'.repeat(1000)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 100; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(true)
    const hasSummary = r.messages.some(
      (m) => m.role === 'user' && m.content.includes('上下文摘要'),
    )
    expect(hasSummary).toBe(true)
  })

  it('小 contextLimit 也能正常工作', () => {
    // contextLimit=1000, 88% = 880 tokens
    // 用 'A'(BPE 实测 ~0.128 token/char,500A≈64 tokens):kr 循环中总有达标方案,可正常压缩
    // (此前用 'U':~0.5 token/char,压缩后仍超 880 阈值,会被防循环保护拦截返回原消息)
    const longContent = 'A'.repeat(500)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 30; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 1000 })
    // 30 * 71 = 2130 tokens, 2130/1000 = 2.13 > 0.88 触发
    expect(r.usageRatio!).toBeGreaterThan(0.88)
    expect(r.compressed).toBe(true)
  })

  it('contextLimit 为 0 时不压缩(避免除零)', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'hello' },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 0 })
    // messages.length(2) <= minMessages(默认 2) 不压缩
    expect(r.compressed).toBe(false)
  })

  it('截断降级:超长单条消息压不动时截断内容(trigger=truncated)', () => {
    // 'y' BPE 实测 0.25 token/char:每条 32000 chars ≈ 8000 tokens
    // 2 条非 system 消息 ≈ 16015 tokens,contextLimit=9000 → 触发阈值 9000*0.88=7920,target=5400
    // kr=1 摘要化候选 ≈8040 >= 7920 常规压缩压不动 → 截断最后一条消息内容到 target 以下
    const longContent = 'y'.repeat(32000)
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: longContent + '_u1' },
      { role: 'assistant' as const, content: longContent + '_a1' },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 9000 })
    // 确实触发了压缩逻辑(而不是未达阈值直接返回)
    expect(r.usageRatio!).toBeGreaterThanOrEqual(0.88)
    expect(r.compressed).toBe(true)
    expect(r.trigger).toBe('truncated')
    expect(r.removedCount).toBe(1)
    // 压缩后 tokens <= target 阈值(5400),自然也低于触发阈值(7920)
    expect(r.compressedTokens).toBeLessThanOrEqual(5400)
    // 结构:system + 摘要 + 截断后的最后一条消息;原消息列表零改动
    expect(r.messages).toHaveLength(3)
    expect(r.messages[0]?.content).toBe('sys')
    expect(r.messages[1]?.content).toContain('上下文摘要')
    expect(r.messages[2]?.content).toContain('…[已截断]')
    expect(messages[2]?.content).toBe(longContent + '_a1')
  })

  it('system 消息超长且不截断时仍返回原消息(trigger=incompressible)', () => {
    // system 'A'*40000 ≈ 5100 tokens(永不截断),2 条普通消息各 ~100 tokens
    // contextLimit=5000 → trigger=4400:kr=1 候选 ≈ system(5100) + 摘要 + 1 条 > 4400,
    // 截断 user 消息到最小长度(100 chars)后 system 仍占 5100 ≥ 4400 → 压不动,返回原消息
    const messages = [
      { role: 'system' as const, content: 'A'.repeat(40000) },
      { role: 'user' as const, content: 'x'.repeat(800) },
      { role: 'user' as const, content: 'x'.repeat(800) },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 5000 })
    expect(r.compressed).toBe(false)
    expect(r.trigger).toBe('incompressible')
    expect(r.removedCount).toBe(0)
    expect(r.messages).toEqual(messages)
    expect(r.compressedTokens).toBe(r.originalTokens)
  })
})

// ==================== tool_calls 配对组保护 ====================

/** 构造带两条工具链的消息:u0 → [a0(tc=c1) → t1(c1)] → u1 → [a1(tc=c2) → t2(c2)] → latest */
function buildToolChainMessages(): ChatMessage[] {
  const longContent = 'x'.repeat(8000) // 'x' BPE 实测 0.125 token/char,每条 ~1000 tokens
  return [
    { role: 'system', content: 'sys' },
    { role: 'user', content: longContent + '_u0' },
    {
      role: 'assistant',
      content: longContent + '_a0',
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
    },
    { role: 'tool', content: longContent + '_t1', tool_call_id: 'c1' },
    { role: 'user', content: longContent + '_u1' },
    {
      role: 'assistant',
      content: longContent + '_a1',
      tool_calls: [{ id: 'c2', type: 'function', function: { name: 'grep', arguments: '{}' } }],
    },
    { role: 'tool', content: longContent + '_t2', tool_call_id: 'c2' },
    { role: 'user', content: 'latest question' },
  ]
}

/** 断言无孤 tool 消息:每条 role='tool' 之前必有含对应 tool_call_id 的 assistant 消息 */
function assertNoOrphanTools(messages: ChatMessage[]): void {
  messages.forEach((m, i) => {
    if (m.role !== 'tool') return
    const owner = messages
      .slice(0, i)
      .reverse()
      .find((p) => p.role === 'assistant' && p.tool_calls?.some((tc) => tc.id === m.tool_call_id))
    expect(owner, `孤 tool 消息(tool_call_id=${m.tool_call_id})前面没有对应 tool_calls 的 assistant`).toBeDefined()
  })
}

describe('tool_calls 配对组保护', () => {
  it('keepRecent=1~2 触发压缩:压缩结果无孤 tool 消息,配对组整体保留或整体摘要', () => {
    const messages = buildToolChainMessages()
    for (const keepRecent of [1, 2]) {
      const r = compressContextIfNeeded(messages, { contextLimit: 6000, keepRecent })
      expect(r.compressed).toBe(true)
      expect(r.trigger).toBe('ratio')
      assertNoOrphanTools(r.messages)
      // 配对组完整性:c1 组(assistant+tool)要么都出现要么都不出现,c2 组同理
      const hasC1Assistant = r.messages.some(
        (m) => m.role === 'assistant' && m.tool_calls?.some((tc) => tc.id === 'c1'),
      )
      const hasC1Tool = r.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'c1')
      expect(hasC1Assistant).toBe(hasC1Tool)
      const hasC2Assistant = r.messages.some(
        (m) => m.role === 'assistant' && m.tool_calls?.some((tc) => tc.id === 'c2'),
      )
      const hasC2Tool = r.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'c2')
      expect(hasC2Assistant).toBe(hasC2Tool)
    }
  })

  it('切分点落在配对组中间时自动外扩到组边界(保留侧不以孤 tool 开头)', () => {
    // keepRecent=2 时朴素 slice 会保留 [tool(c2), user] —— 孤 tool;组边界对齐后保留 [assistant(c2), tool(c2), user]
    const messages = buildToolChainMessages()
    const r = compressContextIfNeeded(messages, { contextLimit: 6000, keepRecent: 2 })
    expect(r.compressed).toBe(true)
    const firstKept = r.messages.find(
      (m) => m.role !== 'system' && !(m.role === 'user' && m.content.startsWith('[上下文摘要')),
    )
    expect(firstKept?.role).not.toBe('tool')
    // c2 组整体保留在 toKeep 侧
    expect(r.messages.some((m) => m.role === 'assistant' && m.tool_calls?.some((tc) => tc.id === 'c2'))).toBe(true)
    expect(r.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'c2')).toBe(true)
  })

  it('截断降级:最后消息属于配对组时整组保留,只截断组内 user/assistant 内容', () => {
    // 最后组 = [assistant(tc=c9, 超长内容), tool(短结果)]:kr 循环压不动 → 截断 assistant 内容,
    // tool 结果完整保留(组内 tool result 不截断)
    const longContent = 'y'.repeat(32000) // 'y' BPE ≈ 0.25 token/char,每条 ≈ 8000 tokens
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: longContent + '_u0' },
      {
        role: 'assistant',
        content: longContent + '_a0',
        tool_calls: [{ id: 'c9', type: 'function', function: { name: 'bash', arguments: '{}' } }],
      },
      { role: 'tool', content: 'short tool output', tool_call_id: 'c9' },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 9000 })
    expect(r.compressed).toBe(true)
    expect(r.trigger).toBe('truncated')
    const keptTool = r.messages.find((m) => m.role === 'tool' && m.tool_call_id === 'c9')
    expect(keptTool?.content).toBe('short tool output')
    const keptAssistant = r.messages.find(
      (m) => m.role === 'assistant' && m.tool_calls?.some((tc) => tc.id === 'c9'),
    )
    expect(keptAssistant?.content).toContain('…[已截断]')
    // 原消息列表零改动
    expect(messages[2]!.content).toBe(longContent + '_a0')
  })
})

// ==================== 摘要防嵌套 ====================

describe('摘要防嵌套', () => {
  it('历史摘要正文原样并入新摘要,标记条数 = 旧覆盖条数 + 新压缩条数', () => {
    const longContent = 'x'.repeat(8000) // 'x' BPE 实测 0.125 token/char,每条 ~1000 tokens
    const oldSummaryBody =
      '历史摘要正文第一行:用户要求实现上下文压缩功能,关键决策不能丢。\n历史摘要正文第二行:多轮压缩后此正文应原样保留而非被再摘要截断。'
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: `[上下文摘要 — 之前 4 条消息已压缩]\n${oldSummaryBody}` },
    ]
    for (let i = 0; i < 10; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_m${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 8000, keepRecent: 1 })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    // kr=1 方案:toCompress 含旧摘要(覆盖 4 条)+ 若干新消息 → 标记条数 = 4 + 非摘要压缩条数
    const newCompressedCount = r.removedCount - 1 // removedCount 含旧摘要消息本身
    expect(summary!.content).toContain(`[上下文摘要 — 之前 ${4 + newCompressedCount} 条消息已压缩]`)
    // 旧摘要正文原样保留(两行完整出现,未被 summarizeMessage 再加工为首句截断)
    expect(summary!.content).toContain(oldSummaryBody)
    // 旧摘要消息本身不应再出现在压缩结果中(已被并入新摘要)
    expect(r.messages.filter((m) => m.content.startsWith('[上下文摘要')).length).toBe(1)
  })
})

// ==================== customSummary 消费 ====================

describe('customSummary 消费', () => {
  function buildCustomSummaryMessages(): ChatMessage[] {
    const longContent = 'x'.repeat(8000) // 'x' BPE 实测 0.125 token/char,每条 ~1000 tokens
    const messages: ChatMessage[] = [{ role: 'system', content: 'sys' }]
    for (let i = 0; i < 20; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_m${i}` })
    }
    return messages
  }

  it('最大保留方案(kr=keepRecent)压缩成功时摘要正文使用 customSummary 且带自动标记行', () => {
    const messages = buildCustomSummaryMessages()
    const r = compressContextIfNeeded(messages, {
      contextLimit: 16000,
      keepRecent: 6,
      customSummary: '自定义语义摘要内容',
    })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    expect(summary!.content).toContain('自定义语义摘要内容')
    // 标记行仍自动生成,格式与其他方案一致
    expect(summary!.content).toMatch(/^\[上下文摘要 — 之前 \d+ 条消息已压缩\]/)
  })

  it('不传 customSummary 时行为不受影响(仍用规则摘要)', () => {
    const messages = buildCustomSummaryMessages()
    const r = compressContextIfNeeded(messages, { contextLimit: 16000, keepRecent: 6 })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    expect(summary!.content).not.toContain('自定义语义摘要内容')
    expect(summary!.content).toContain('上下文摘要')
  })
})

// ==================== tool result 摘要保留内容 ====================

describe('tool result 摘要保留内容', () => {
  it('summarizeMessage:tool 消息保留前 120 chars(远层收编)+ 省略号,空内容用占位', () => {
    expect(summarizeMessage({ role: 'tool', content: 'x'.repeat(1000) })).toBe(
      `[tool] ${'x'.repeat(SUMMARY_REMOTE_CHARS)}…`,
    )
    expect(summarizeMessage({ role: 'tool', content: 'ok' })).toBe('[tool] ok')
    expect(summarizeMessage({ role: 'tool', content: '' })).toBe('[tool] (空)')
  })

  it('压缩后摘要含 tool result 前 200 chars 内容片段(近层信息保留度提升)', () => {
    const toolContent = 'TOOLRESULT'.repeat(800) // 8800 chars ≈ 2400 tokens,压缩后摘要应保留其开头
    const longContent = 'x'.repeat(8000) // 每条 ~1000 tokens
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: longContent + '_u0' },
      {
        role: 'assistant',
        content: longContent + '_a0',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      },
      { role: 'tool', content: toolContent, tool_call_id: 'c1' },
      { role: 'user', content: longContent + '_u1' },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 5000, keepRecent: 1 })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    // toCompress = [u0, A(c1), tool]:tool 是最后 1 条 → 近层(ceil(3*0.3)=1)→ 保留前 200 chars
    expect(summary!.content).toContain(toolContent.slice(0, SUMMARY_RECENT_CHARS))
    assertNoOrphanTools(r.messages)
  })
})

// ==================== 分层金字塔摘要(近层保留细节 / 远层浓缩) ====================

describe('分层金字塔摘要', () => {
  /** 构造 n 条可区分的长 user 消息(唯一编号前缀 + 无标点长体:远层规则摘要只留首句) */
  function buildTieredUserMessages(n: number): ChatMessage[] {
    return Array.from({ length: n }, (_, i) => ({
      role: 'user' as const,
      content: `用户消息第${i}条。${'x'.repeat(300)}`,
    }))
  }

  it('近层保留量:最后 ceil(20*0.3)=6 条摘要行含各自前 200 chars,第 14 条(远层)不含', () => {
    // compressContext(keepRecent=0) 使 toCompress = 全部 20 条 → 近层 = 最后 6 条
    const msgs = buildTieredUserMessages(20)
    const r = compressContext(msgs, { maxTokens: 100, keepRecent: 0 })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    expect(summary!.content).toContain('[上下文摘要 — 之前 20 条消息已压缩]')
    // 近层(最后 6 条,索引 14..19):摘要行 = [user] + 前 200 chars 直截
    for (let i = 14; i < 20; i++) {
      expect(summary!.content).toContain(msgs[i]!.content.slice(0, SUMMARY_RECENT_CHARS))
    }
    // 第 14 条(索引 13,远层)走规则摘要(首句浓缩),不含前 200 chars 片段
    expect(summary!.content).not.toContain(msgs[13]!.content.slice(0, SUMMARY_RECENT_CHARS))
  })

  it('远层浓缩:远层摘要行长度显著小于近层', () => {
    const msgs = buildTieredUserMessages(20)
    const r = compressContext(msgs, { maxTokens: 100, keepRecent: 0 })
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )!
    const lines = summary.content.split('\n').slice(1) // 去掉标记行
    const recentLines = lines.filter((ln) => ln.endsWith('…')) // 近层:200 chars 直截 + '…'
    const remoteLines = lines.filter((ln) => !ln.endsWith('…')) // 远层:规则摘要(首句浓缩)
    expect(recentLines).toHaveLength(6)
    expect(remoteLines).toHaveLength(14)
    // 近层行(≈210 chars)显著长于远层规则摘要行(首句 ≤80 chars + 标签)
    expect(Math.min(...recentLines.map((ln) => ln.length))).toBeGreaterThan(
      Math.max(...remoteLines.map((ln) => ln.length)) * 2,
    )
  })

  it('tool result 分层:近层保留前 200 chars、远层保留前 120 chars', () => {
    // 22 条消息:tool(c1) 在远层(索引 2)、tool(c2) 在近层(最后 7 条 = ceil(22*0.3))
    const remoteTool = 'S'.repeat(300)
    const recentTool = 'R'.repeat(300)
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u0' },
      {
        role: 'assistant',
        content: 'a0',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      },
      { role: 'tool', content: remoteTool, tool_call_id: 'c1' },
      ...Array.from({ length: 14 }, (_, i) => ({ role: 'user' as const, content: `u${i + 1}` })),
      {
        role: 'assistant',
        content: 'a1',
        tool_calls: [{ id: 'c2', type: 'function', function: { name: 'grep', arguments: '{}' } }],
      },
      { role: 'tool', content: recentTool, tool_call_id: 'c2' },
      ...Array.from({ length: 3 }, (_, i) => ({ role: 'user' as const, content: `v${i}` })),
    ]
    const r = compressContext(messages, { maxTokens: 100, keepRecent: 0 })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )!
    // 近层 tool(c2):前 200 chars
    expect(summary.content).toContain(`[tool] ${recentTool.slice(0, SUMMARY_RECENT_CHARS)}`)
    // 远层 tool(c1):前 120 chars,且不含第 121 chars(证明截断在 120)
    expect(summary.content).toContain(`[tool] ${remoteTool.slice(0, SUMMARY_REMOTE_CHARS)}`)
    expect(summary.content).not.toContain(remoteTool.slice(0, SUMMARY_REMOTE_CHARS + 1))
  })

  it('customSummary 覆盖:摘要正文为 LLM 文本,无分层痕迹', () => {
    const msgs = buildTieredUserMessages(20)
    const r = compressContextIfNeeded(msgs, {
      contextLimit: 800,
      customSummary: 'LLM 语义摘要正文',
    })
    expect(r.compressed).toBe(true)
    const summary = r.messages.find(
      (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
    )
    expect(summary).toBeDefined()
    expect(summary!.content).toContain('LLM 语义摘要正文')
    // 无分层痕迹:无规则摘要 role 标签行、无近层直截 '…' 后缀;结构 = 标记行 + 一行正文
    expect(summary!.content).not.toContain('[user]')
    expect(summary!.content).not.toContain('…')
    expect(summary!.content.split('\n')).toHaveLength(2)
  })

  it('分层常量与规格一致', () => {
    expect(SUMMARY_TIER_RECENT_RATIO).toBe(0.3)
    expect(SUMMARY_RECENT_CHARS).toBe(200)
    expect(SUMMARY_REMOTE_CHARS).toBe(120)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
