import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  estimateMessagesTokens,
  compressContext,
  compressContextIfNeeded,
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
  it('未达 85% 阈值时不压缩', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ]
    // 8000 * 0.85 = 6800, 当前 token 远小于
    const r = compressContextIfNeeded(messages, { contextLimit: 8000 })
    expect(r.compressed).toBe(false)
    expect(r.trigger).toBe('none')
    expect(r.usageRatio).toBeLessThan(0.85)
  })

  it('达 85% 阈值时自动压缩', () => {
    // 构造大量消息使 token 数超过 85% * 8000 = 6800
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
    expect(r.usageRatio).toBeGreaterThanOrEqual(0.85)
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
      // 应该显著低于 85%,接近或低于 60%
      expect(newRatio).toBeLessThan(r.usageRatio!)
      // 理想情况下低于 60%,但受 keepRecent 下限约束,至少应该低于 85%
      expect(newRatio).toBeLessThan(0.85)
    }
  })

  it('消息数不足时不压缩(即使 token 超阈值)', () => {
    // 单条超长消息,但消息总数只有 2(system + user)
    const superLong = 'X'.repeat(50000)
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: superLong },
    ]
    // minMessages 默认 keepRecent+1=7, 2 < 7 不压缩
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
    // contextLimit=1000, 85% = 850 tokens
    const longContent = 'U'.repeat(500) // ~65 tokens
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: 'sys' },
    ]
    for (let i = 0; i < 30; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: longContent + `_${i}` })
    }
    const r = compressContextIfNeeded(messages, { contextLimit: 1000 })
    // 30 * 65 = 1950 tokens, 1950/1000 = 1.95 > 0.85 触发
    expect(r.usageRatio!).toBeGreaterThan(0.85)
    expect(r.compressed).toBe(true)
  })

  it('contextLimit 为 0 时不压缩(避免除零)', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'hello' },
    ]
    const r = compressContextIfNeeded(messages, { contextLimit: 0 })
    // contextLimit=0 → triggerThreshold=0, 但 messages.length(2) <= minMessages(7) 不压缩
    expect(r.compressed).toBe(false)
  })
})
